import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';
import {
  AUDIO_FILES_TABLE_ID,
  AUDIO_FILES_FIELD_IDS,
} from '@/lib/types/teacher';
import { getTeacherService } from '@/lib/services/teacherService';
import { processAudioFile } from '@/lib/services/audioProcessingService';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET/POST /api/cron/audit-mp3r2key
 *
 * Daily safety net. Finds final-type AudioFiles whose downloads would (or once
 * would have) served raw WAV — i.e. r2_key is .wav and mp3_r2_key is empty —
 * and re-runs processAudioFile() to backfill them.
 *
 * Catches:
 *   - Records stuck in 'processing' because /api/audio/process never completed
 *     (network drop, function killed, client never called it).
 *   - Records in 'error' state needing retry.
 *   - The bug class that motivated this whole change in case the invariant
 *     somehow gets bypassed in the future.
 *
 * Runs at 16:00 UTC = 18:00 Berlin (CEST) / 17:00 Berlin (CET).
 * Vercel cron is UTC-only so accepting ±1h seasonal drift.
 */

function verifyCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[Audit mp3R2Key Cron] CRON_SECRET not set');
    return false;
  }
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7) === cronSecret;
  }
  const cronHeader = request.headers.get('X-Cron-Secret');
  return cronHeader === cronSecret;
}

interface OffenderSummary {
  audioFileId: string;
  r2Key: string;
  eventId: string;
  classId: string;
  songId?: string;
  status: string;
}

interface CronResult {
  status: 'ok' | 'unauthorized' | 'error';
  found: number;
  uniqueR2Keys: number;
  succeeded: number;
  failed: number;
  failures?: Array<{ r2Key: string; error: string }>;
  dryRun?: boolean;
  message?: string;
}

async function handleCron(request: NextRequest): Promise<NextResponse<CronResult>> {
  if (!verifyCronRequest(request)) {
    return NextResponse.json(
      { status: 'unauthorized', found: 0, uniqueR2Keys: 0, succeeded: 0, failed: 0 },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const isDryRun = url.searchParams.get('dryRun') === 'true';

  console.log(`[Audit mp3R2Key Cron] Starting${isDryRun ? ' (DRY RUN)' : ''}`);

  const base = Airtable.base(process.env.AIRTABLE_BASE_ID!);
  const records = await base(AUDIO_FILES_TABLE_ID)
    .select({
      filterByFormula: `AND({type} = 'final', OR({status} = 'processing', {status} = 'error', {status} = 'ready'))`,
    })
    .all();

  const offenders: OffenderSummary[] = [];
  for (const r of records) {
    const r2Key = (r.fields.r2_key ?? r.fields[AUDIO_FILES_FIELD_IDS.r2_key] ?? '') as string;
    const mp3Key = (r.fields.mp3_r2_key ?? r.fields[AUDIO_FILES_FIELD_IDS.mp3_r2_key] ?? '') as string;
    if (mp3Key) continue;
    if (!r2Key.toLowerCase().endsWith('.wav')) continue;
    const classId = (r.fields.class_id ?? r.fields[AUDIO_FILES_FIELD_IDS.class_id] ?? '') as string;
    const songId = (r.fields.song_id ?? r.fields[AUDIO_FILES_FIELD_IDS.song_id] ?? '') as string;
    const status = (r.fields.status ?? r.fields[AUDIO_FILES_FIELD_IDS.status] ?? '') as string;
    const eventMatch = r2Key.match(/^(?:recordings|events)\/([^/]+)\//);
    if (!eventMatch || !classId) continue;
    offenders.push({
      audioFileId: r.id,
      r2Key,
      eventId: eventMatch[1],
      classId,
      songId: songId || undefined,
      status,
    });
  }

  if (offenders.length === 0) {
    console.log('[Audit mp3R2Key Cron] No offenders found — invariant healthy.');
    return NextResponse.json({
      status: 'ok',
      found: 0,
      uniqueR2Keys: 0,
      succeeded: 0,
      failed: 0,
    });
  }

  // Drift means our invariant is leaking somewhere. console.error so it shows
  // up in Vercel log alerting if it ever exceeds zero.
  console.error(
    `[Audit mp3R2Key Cron] Found ${offenders.length} stuck AudioFile(s) — auto-healing.`,
    { ids: offenders.map(o => o.audioFileId) }
  );

  // Group by r2Key to avoid re-encoding duplicates.
  const byR2Key = new Map<string, OffenderSummary[]>();
  for (const o of offenders) {
    if (!byR2Key.has(o.r2Key)) byR2Key.set(o.r2Key, []);
    byR2Key.get(o.r2Key)!.push(o);
  }

  if (isDryRun) {
    return NextResponse.json({
      status: 'ok',
      found: offenders.length,
      uniqueR2Keys: byR2Key.size,
      succeeded: 0,
      failed: 0,
      dryRun: true,
    });
  }

  const teacherService = getTeacherService();
  const failures: Array<{ r2Key: string; error: string }> = [];
  let succeeded = 0;

  for (const [r2Key, group] of byR2Key) {
    const first = group[0];
    try {
      const result = await processAudioFile(
        r2Key,
        first.eventId,
        first.classId,
        first.songId || null
      );
      // processAudioFile updates one record. Fan out to duplicates.
      for (const o of group) {
        await teacherService.updateAudioFile(o.audioFileId, {
          status: 'ready',
          mp3R2Key: result.mp3Key,
          previewR2Key: result.previewKey,
          durationSeconds: result.durationSeconds,
        });
        succeeded++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push({ r2Key, error: msg });
      // Mark as error so engineer UI can surface retry; do not leave 'processing' stuck.
      for (const o of group) {
        try {
          await teacherService.updateAudioFile(o.audioFileId, { status: 'error' });
        } catch (markErr) {
          console.error('[Audit mp3R2Key Cron] Failed to mark error status:', markErr);
        }
      }
    }
  }

  console.log(
    `[Audit mp3R2Key Cron] Done: ${succeeded} healed, ${failures.length} failed across ${byR2Key.size} unique r2_key(s).`
  );

  return NextResponse.json({
    status: failures.length > 0 ? 'error' : 'ok',
    found: offenders.length,
    uniqueR2Keys: byR2Key.size,
    succeeded,
    failed: failures.length,
    failures: failures.length > 0 ? failures : undefined,
  });
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}
