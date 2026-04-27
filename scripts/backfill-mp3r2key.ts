/**
 * Backfill mp3_r2_key for AudioFiles whose downloads currently serve as .wav.
 *
 * Runs processAudioFile() on every final+ready AudioFile where:
 *   mp3_r2_key is empty AND r2_key ends with .wav
 *
 * This re-uses the production conversion pipeline (ffmpeg + R2 upload + Airtable
 * update), so the result is byte-identical to a freshly-uploaded file going
 * through the new flow.
 *
 * Run:   npx tsx scripts/backfill-mp3r2key.ts            # live
 *        npx tsx scripts/backfill-mp3r2key.ts --dry-run  # list only
 *        npx tsx scripts/backfill-mp3r2key.ts --limit 5  # process N then stop
 *        npx tsx scripts/backfill-mp3r2key.ts --record recXyZ123  # one record only
 */
import 'dotenv/config';
import Airtable from 'airtable';
import { processAudioFile } from '../src/lib/services/audioProcessingService';
import { getTeacherService } from '../src/lib/services/teacherService';

require('dotenv').config({ path: '.env.local' });

Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
const base = Airtable.base(process.env.AIRTABLE_BASE_ID!);

const AUDIO_FILES_TABLE = 'tbloCM4tmH7mYoyXR';

const F = {
  type:        'fldOMmFN7BqHVAqfH',
  status:      'fldCAcEMu0IF1bWgz',
  r2_key:      'fldvzj75CspwfOfPX',
  mp3_r2_key:  'fldzADPZjKEZbfy2i',
  filename:    'fldOTWiFz8G1lE04c',
  class_id:    'fldAYW88oxtF5L5Bf',
  song_id:     'fldehSfLpy3iozdBt',
};

function getField(rec: Airtable.Record<Airtable.FieldSet>, name: string, fieldId: string): string {
  return (rec.fields[name] ?? rec.fields[fieldId] ?? '') as string;
}

function parseEventIdFromR2Key(r2Key: string): string | null {
  const m = r2Key.match(/^(?:recordings|events)\/([^/]+)\//);
  return m ? m[1] : null;
}

interface Args {
  dryRun: boolean;
  limit: number | null;
  recordFilter: string | null;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const limitIdx = argv.indexOf('--limit');
  const limit = limitIdx >= 0 && argv[limitIdx + 1] ? parseInt(argv[limitIdx + 1], 10) : null;
  const recordIdx = argv.indexOf('--record');
  const recordFilter = recordIdx >= 0 && argv[recordIdx + 1] ? argv[recordIdx + 1] : null;
  return { dryRun, limit, recordFilter };
}

async function main() {
  const { dryRun, limit, recordFilter } = parseArgs();
  console.log('='.repeat(80));
  console.log('BACKFILL: mp3_r2_key for final+ready WAVs missing MP3 derivative');
  console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'LIVE'}`);
  if (limit !== null) console.log(`Limit: ${limit}`);
  if (recordFilter) console.log(`Record filter: ${recordFilter}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('='.repeat(80));

  const records = await base(AUDIO_FILES_TABLE).select({
    filterByFormula: `AND({type} = 'final', {status} = 'ready')`,
  }).all();

  const offenders = records.filter(r => {
    const r2Key = getField(r, 'r2_key', F.r2_key);
    const mp3Key = getField(r, 'mp3_r2_key', F.mp3_r2_key);
    if (mp3Key) return false;
    if (!r2Key.toLowerCase().endsWith('.wav')) return false;
    if (recordFilter && r.id !== recordFilter) return false;
    return true;
  });

  console.log(`\nFound ${offenders.length} offending record(s).`);
  if (offenders.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  const targets = limit !== null ? offenders.slice(0, limit) : offenders;

  // Group by r2_key — Schule an der Ruhr has multiple AudioFile rows pointing
  // to the same WAV. Process the encoding once per unique key, then fan out
  // the mp3_r2_key/previewR2Key update to every duplicate row.
  const groups = new Map<string, typeof targets>();
  for (const r of targets) {
    const key = getField(r, 'r2_key', F.r2_key);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  console.log(`Processing ${targets.length} record(s) across ${groups.size} unique r2_key(s)...\n`);

  const teacherService = getTeacherService();
  const results: Array<{ id: string; ok: boolean; mp3Key?: string; error?: string }> = [];

  let groupIdx = 0;
  for (const [r2Key, recs] of groups) {
    groupIdx++;
    const first = recs[0];
    const classId = getField(first, 'class_id', F.class_id);
    const songId = getField(first, 'song_id', F.song_id);
    const eventId = parseEventIdFromR2Key(r2Key);
    const filename = getField(first, 'filename', F.filename);
    const dupCount = recs.length;

    console.log(`[${groupIdx}/${groups.size}] r2_key with ${dupCount} record(s):`);
    console.log(`  filename: ${filename}`);
    console.log(`  r2_key:   ${r2Key}`);
    console.log(`  eventId:  ${eventId || '(could not parse)'}`);
    console.log(`  classId:  ${classId}`);
    console.log(`  songId:   ${songId || '(none — schulsong path)'}`);
    if (dupCount > 1) console.log(`  duplicates: ${recs.map(r => r.id).join(', ')}`);

    if (!eventId || !classId) {
      console.log(`  ✗ SKIP: missing eventId or classId`);
      for (const r of recs) results.push({ id: r.id, ok: false, error: 'missing eventId or classId' });
      console.log('');
      continue;
    }

    if (dryRun) {
      console.log(`  → would process and update ${dupCount} record(s)`);
      for (const r of recs) results.push({ id: r.id, ok: true });
      console.log('');
      continue;
    }

    const t0 = Date.now();
    let mp3Key: string;
    let previewKey: string;
    let durationSeconds: number;
    try {
      const result = await processAudioFile(r2Key, eventId, classId, songId || null);
      mp3Key = result.mp3Key;
      previewKey = result.previewKey;
      durationSeconds = result.durationSeconds;
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  ✓ encoded in ${elapsed}s → ${mp3Key}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ ENCODING FAILED: ${msg}`);
      for (const r of recs) results.push({ id: r.id, ok: false, error: msg });
      console.log('');
      continue;
    }

    // Fan-out: update every record pointing at this r2_key. processAudioFile
    // already updated one of them (whichever its lookup hit first) — re-updating
    // the same record by ID is idempotent.
    for (const r of recs) {
      try {
        await teacherService.updateAudioFile(r.id, {
          status: 'ready',
          durationSeconds,
          mp3R2Key: mp3Key,
          previewR2Key: previewKey,
        });
        results.push({ id: r.id, ok: true, mp3Key });
        if (dupCount > 1) console.log(`     ✓ updated ${r.id}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`     ✗ UPDATE FAILED for ${r.id}: ${msg}`);
        results.push({ id: r.id, ok: false, error: `update: ${msg}` });
      }
    }
    console.log('');
  }

  const successes = results.filter(r => r.ok).length;
  const failures = results.filter(r => !r.ok).length;
  console.log('='.repeat(80));
  console.log(`SUMMARY: ${successes} succeeded, ${failures} failed (of ${targets.length} attempted)`);
  if (failures > 0) {
    console.log('\nFailures:');
    for (const r of results.filter(x => !x.ok)) {
      console.log(`  - ${r.id}: ${r.error}`);
    }
  }
  console.log('='.repeat(80));

  if (failures > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
