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
 * One track per song. Uses mp3R2Key when available.
 * Filenames: "SongTitle - ClassName.mp3" or "ClassName.mp3" as fallback.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = verifyTeacherSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId: rawEventId } = await params;
    const eventId = decodeURIComponent(rawEventId);
    const teacherService = getTeacherService();

    const event = await teacherService.getTeacherEventDetail(eventId, session.email);
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found or you do not have access to this event' },
        { status: 404 }
      );
    }

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

    const nonDefaultClasses = event.classes.filter((c) => !c.isDefault);
    const r2Service = getR2Service();
    const filesToZip: { buffer: Buffer; zipName: string }[] = [];
    const usedNames = new Set<string>();

    function deduplicateName(name: string): string {
      let candidate = name;
      let counter = 2;
      while (usedNames.has(candidate)) {
        const ext = name.lastIndexOf('.');
        candidate = `${name.slice(0, ext)} (${counter})${name.slice(ext)}`;
        counter++;
      }
      usedNames.add(candidate);
      return candidate;
    }

    // One file per song-level audio
    for (const cls of nonDefaultClasses) {
      const classFiles = finalReadyFiles.filter(
        (f) => f.classId === cls.classId && !f.isSchulsong
      );

      for (const af of classFiles) {
        const r2Key = af.mp3R2Key || af.r2Key;

        // Resolve song title
        const song = af.songId
          ? cls.songs.find((s) => s.id === af.songId)
          : cls.songs.length === 1
            ? cls.songs[0]
            : undefined;

        const baseName = song?.title
          ? `${song.title} - ${cls.className}`
          : cls.className;
        const extension = r2Key.endsWith('.wav') ? '.wav' : '.mp3';
        const zipName = deduplicateName(`${baseName}${extension}`);

        const buffer = await r2Service.getFileBuffer(r2Key);
        if (buffer) {
          filesToZip.push({ buffer, zipName });
        }
      }
    }

    // Schulsong
    if (event.isSchulsong) {
      const schulsongFiles = finalReadyFiles.filter(
        (f: AudioFile) => f.isSchulsong
      );
      if (schulsongFiles.length > 0) {
        const best = schulsongFiles[0];
        const r2Key = best.mp3R2Key || best.r2Key;
        const buffer = await r2Service.getFileBuffer(r2Key);
        if (buffer) {
          const ext = r2Key.endsWith('.wav') ? '.wav' : '.mp3';
          filesToZip.push({ buffer, zipName: deduplicateName(`Schulsong${ext}`) });
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

    const filename = `${event.schoolName} - Aufnahmen.zip`;

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="Aufnahmen.zip"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error('Error generating teacher audio ZIP:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to generate ZIP' },
      { status: 500 }
    );
  }
}
