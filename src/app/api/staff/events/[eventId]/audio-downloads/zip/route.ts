import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffSession } from '@/lib/auth/verifyStaffSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import { getR2Service } from '@/lib/services/r2Service';
import { AudioFile } from '@/lib/types/teacher';
import archiver from 'archiver';
import { PassThrough } from 'stream';

export const dynamic = 'force-dynamic';

/**
 * GET /api/staff/events/[eventId]/audio-downloads/zip
 * Stream a zip archive of all final audio tracks for the event.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyStaffSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const teacherService = getTeacherService();

    // Fetch event detail and audio files in parallel
    const [eventDetail, allAudioFiles] = await Promise.all([
      getAirtableService().getSchoolEventDetail(eventId),
      teacherService.getAudioFilesByEventId(eventId),
    ]);

    if (!eventDetail) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const finalReadyFiles = allAudioFiles.filter(
      (f: AudioFile) => f.type === 'final' && f.status === 'ready'
    );

    if (finalReadyFiles.length === 0) {
      return NextResponse.json(
        { error: 'No final audio files available for download' },
        { status: 404 }
      );
    }

    // Pick best file per class (prefer MP3 over WAV)
    const filesByClass = new Map<string, AudioFile[]>();
    const schulsongFiles: AudioFile[] = [];

    for (const f of finalReadyFiles) {
      if (f.isSchulsong) {
        schulsongFiles.push(f);
        continue;
      }
      const existing = filesByClass.get(f.classId) || [];
      existing.push(f);
      filesByClass.set(f.classId, existing);
    }

    const filesToZip: { buffer: Buffer; zipName: string }[] = [];
    const r2Service = getR2Service();

    for (const cls of eventDetail.classes) {
      const candidates = filesByClass.get(cls.classId);
      if (!candidates || candidates.length === 0) continue;

      const best = pickBestFile(candidates);
      const r2KeyIsMp3 = best.r2Key.toLowerCase().endsWith('.mp3');
      const mp3Key = best.mp3R2Key || (r2KeyIsMp3 ? best.r2Key : null);

      if (!mp3Key) {
        console.error('[staff zip] Skipping class — no MP3 source available', {
          audioFileId: best.id, r2Key: best.r2Key, eventId, classId: best.classId, songId: best.songId,
        });
        continue;
      }

      const buffer = await r2Service.getFileBuffer(mp3Key);
      if (buffer) {
        filesToZip.push({ buffer, zipName: `${cls.className}.mp3` });
      }
    }

    if (schulsongFiles.length > 0) {
      const best = pickBestFile(schulsongFiles);
      const r2KeyIsMp3 = best.r2Key.toLowerCase().endsWith('.mp3');
      const mp3Key = best.mp3R2Key || (r2KeyIsMp3 ? best.r2Key : null);

      if (!mp3Key) {
        console.error('[staff zip] Skipping schulsong — no MP3 source available', {
          audioFileId: best.id, r2Key: best.r2Key, eventId, classId: best.classId,
        });
      } else {
        const buffer = await r2Service.getFileBuffer(mp3Key);
        if (buffer) {
          filesToZip.push({ buffer, zipName: 'Schulsong.mp3' });
        }
      }
    }

    if (filesToZip.length === 0) {
      return NextResponse.json(
        { error: 'Could not retrieve any audio files from storage' },
        { status: 404 }
      );
    }

    // Build zip
    const archive = archiver('zip', { zlib: { level: 1 } });
    const passThrough = new PassThrough();
    archive.pipe(passThrough);

    for (const { buffer, zipName } of filesToZip) {
      archive.append(buffer, { name: zipName });
    }
    archive.finalize();

    const webStream = new ReadableStream({
      start(controller) {
        passThrough.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        passThrough.on('end', () => controller.close());
        passThrough.on('error', (err) => controller.error(err));
      },
      cancel() {
        passThrough.destroy();
        archive.abort();
      },
    });

    const filename = `${eventDetail.schoolName} - Aufnahmen.zip`;

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="Aufnahmen.zip"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error('Error generating staff audio ZIP:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to generate ZIP' },
      { status: 500 }
    );
  }
}

function pickBestFile(candidates: AudioFile[]): AudioFile {
  const playable = candidates.find((f) => f.mp3R2Key || f.r2Key.toLowerCase().endsWith('.mp3'));
  return playable ?? candidates[0];
}
