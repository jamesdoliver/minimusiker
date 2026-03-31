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
 * Tracks are ordered by album tracklist (schulsong at position 1 when present).
 * Filenames use padded track numbers: "01. Schulsong.mp3", "02. Song - Class.mp3"
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

    // 1. Get all final+ready audio files
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

    // 2. Get album tracks — canonical order (schulsong at 1, groups included)
    const albumTracks = await teacherService.getAlbumTracksData(eventId);

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

    if (albumTracks.length > 0) {
      // --- Primary path: album-track-based ordering ---
      const audioBySongId = new Map<string, AudioFile>();
      let schulsongAudio: AudioFile | undefined;

      for (const af of finalReadyFiles) {
        if (af.isSchulsong) {
          if (!schulsongAudio) schulsongAudio = af;
        } else if (af.songId) {
          if (!audioBySongId.has(af.songId)) {
            audioBySongId.set(af.songId, af);
          }
        }
      }

      // Match audio files without songId to single-song classes
      const songCountByClassId = new Map<string, string[]>();
      for (const at of albumTracks) {
        if (at.isSchulsong) continue;
        const songs = songCountByClassId.get(at.classId) || [];
        songs.push(at.songId);
        songCountByClassId.set(at.classId, songs);
      }

      for (const af of finalReadyFiles) {
        if (af.isSchulsong || af.songId) continue;
        const classSongs = songCountByClassId.get(af.classId);
        if (classSongs?.length === 1 && !audioBySongId.has(classSongs[0])) {
          audioBySongId.set(classSongs[0], af);
        }
      }

      for (const albumTrack of albumTracks) {
        const audio = albumTrack.isSchulsong
          ? schulsongAudio
          : audioBySongId.get(albumTrack.songId);

        if (!audio) continue;

        const r2Key = audio.mp3R2Key || audio.r2Key;
        if (!r2Key) continue;

        const buffer = await r2Service.getFileBuffer(r2Key);
        if (!buffer) continue;

        const padded = String(albumTrack.albumOrder).padStart(2, '0');
        const displayName = albumTrack.isSchulsong
          ? albumTrack.songTitle
          : `${albumTrack.songTitle} - ${albumTrack.className}`;
        const extension = r2Key.endsWith('.wav') ? '.wav' : '.mp3';
        const zipName = deduplicateName(`${padded}. ${displayName}${extension}`);

        filesToZip.push({ buffer, zipName });
      }
    } else {
      // --- Fallback: class-based iteration for legacy events without Song records ---
      const nonDefaultClasses = event.classes.filter((c) => !c.isDefault);

      for (const cls of nonDefaultClasses) {
        const classFiles = finalReadyFiles.filter(
          (f) => f.classId === cls.classId && !f.isSchulsong
        );
        for (const af of classFiles) {
          const r2Key = af.mp3R2Key || af.r2Key;
          if (!r2Key) continue;

          const buffer = await r2Service.getFileBuffer(r2Key);
          if (!buffer) continue;

          const song = af.songId
            ? cls.songs.find((s) => s.id === af.songId)
            : cls.songs.length === 1 ? cls.songs[0] : undefined;

          const baseName = song?.title
            ? `${song.title} - ${cls.className}`
            : cls.className;
          const extension = r2Key.endsWith('.wav') ? '.wav' : '.mp3';
          const zipName = deduplicateName(`${baseName}${extension}`);

          filesToZip.push({ buffer, zipName });
        }
      }

      // Schulsong fallback
      const schulsongFile = finalReadyFiles.find((f) => f.isSchulsong);
      if (schulsongFile) {
        const r2Key = schulsongFile.mp3R2Key || schulsongFile.r2Key;
        if (r2Key) {
          const buffer = await r2Service.getFileBuffer(r2Key);
          if (buffer) {
            const ext = r2Key.endsWith('.wav') ? '.wav' : '.mp3';
            filesToZip.push({ buffer, zipName: deduplicateName(`Schulsong${ext}`) });
          }
        }
      }
    }

    if (filesToZip.length === 0) {
      return NextResponse.json(
        { error: 'Could not retrieve any audio files from storage' },
        { status: 404 }
      );
    }

    // 5. Build zip
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
