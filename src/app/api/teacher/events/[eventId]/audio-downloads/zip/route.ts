import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';
import { AudioFile } from '@/lib/types/teacher';
import archiver from 'archiver';
import { PassThrough } from 'stream';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teacher/events/[eventId]/audio-downloads/zip
 * Stream a zip archive containing all final audio tracks for the event.
 *
 * Each non-default class gets one track (MP3 preferred over WAV).
 * If the event has a schulsong, it is included as "Schulsong.mp3/.wav".
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    // 1. Auth
    const session = verifyTeacherSession(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId: rawEventId } = await params;
    const eventId = decodeURIComponent(rawEventId);
    const teacherService = getTeacherService();

    // 2. Event access
    const event = await teacherService.getTeacherEventDetail(eventId, session.email);

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found or you do not have access to this event' },
        { status: 404 }
      );
    }

    // 3. Fetch audio files, filter to final + ready
    const allAudioFiles = await teacherService.getAudioFilesByEventId(eventId);
    const finalReadyFiles = allAudioFiles.filter(
      (f: AudioFile) => f.type === 'final' && f.status === 'ready'
    );

    if (finalReadyFiles.length === 0) {
      return NextResponse.json(
        { error: 'No final audio files available for download' },
        { status: 404 }
      );
    }

    // 4. Pick best file per class (prefer MP3 over WAV)
    const nonDefaultClasses = event.classes.filter((c) => !c.isDefault);
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

    // One track per non-default class
    for (const cls of nonDefaultClasses) {
      const candidates = filesByClass.get(cls.classId);
      if (!candidates || candidates.length === 0) continue;

      const best = pickBestFile(candidates);
      const extension = best.r2Key.endsWith('.mp3') ? '.mp3' : '.wav';
      const zipName = `${cls.className}${extension}`;

      const buffer = await r2Service.getFileBuffer(best.r2Key);
      if (buffer) {
        filesToZip.push({ buffer, zipName });
      }
    }

    // Schulsong track (if applicable)
    if (schulsongFiles.length > 0) {
      const best = pickBestFile(schulsongFiles);
      const extension = best.r2Key.endsWith('.mp3') ? '.mp3' : '.wav';
      const zipName = `Schulsong${extension}`;

      const buffer = await r2Service.getFileBuffer(best.r2Key);
      if (buffer) {
        filesToZip.push({ buffer, zipName });
      }
    }

    if (filesToZip.length === 0) {
      return NextResponse.json(
        { error: 'Could not retrieve any audio files from storage' },
        { status: 404 }
      );
    }

    // 5. Build zip via archiver, pipe through PassThrough, convert to Web ReadableStream
    const archive = archiver('zip', {
      zlib: { level: 1 }, // Fast compression — audio doesn't compress much
    });

    const passThrough = new PassThrough();
    archive.pipe(passThrough);

    // Append all files
    for (const { buffer, zipName } of filesToZip) {
      archive.append(buffer, { name: zipName });
    }

    // Finalize (no more files to add)
    archive.finalize();

    // Convert Node PassThrough to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        passThrough.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        passThrough.on('end', () => {
          controller.close();
        });
        passThrough.on('error', (err) => {
          controller.error(err);
        });
      },
      cancel() {
        passThrough.destroy();
        archive.abort();
      },
    });

    // 6. Build Content-Disposition filename
    const filename = `${event.schoolName} - Aufnahmen.zip`;

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating teacher audio ZIP:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate ZIP',
      },
      { status: 500 }
    );
  }
}

/**
 * Pick the best audio file from a list of candidates.
 * Prefers MP3 over WAV (smaller download for the teacher).
 */
function pickBestFile(candidates: AudioFile[]): AudioFile {
  const mp3 = candidates.find((f) => f.r2Key.endsWith('.mp3'));
  return mp3 ?? candidates[0];
}
