import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { AudioFile } from '@/lib/types/teacher';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teacher/events/[eventId]/audio-downloads
 * List downloadable audio tracks for a teacher's event.
 *
 * Returns metadata only (no actual file bytes).
 * Checks that ALL non-default classes have a final audio file before
 * exposing the track list. If the event has a schulsong, a final
 * schulsong file must also exist.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    // Verify teacher session
    const session = verifyTeacherSession(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId: rawEventId } = await params;
    const eventId = decodeURIComponent(rawEventId);
    const teacherService = getTeacherService();

    // Verify teacher has access to this event
    const event = await teacherService.getTeacherEventDetail(eventId, session.email);

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found or you do not have access to this event' },
        { status: 404 }
      );
    }

    // Fetch all audio files for this event
    const allAudioFiles = await teacherService.getAudioFilesByEventId(eventId);

    // Filter to final + ready files only
    const finalReadyFiles = allAudioFiles.filter(
      (f: AudioFile) => f.type === 'final' && f.status === 'ready'
    );

    // ---------------------------------------------------------------
    // Completeness gate: every non-default class must have >= 1 final
    // file, and if the event has a schulsong there must be a final
    // schulsong file too.
    // ---------------------------------------------------------------
    const nonDefaultClasses = event.classes.filter((c) => !c.isDefault);

    const classesWithFinal = new Set(
      finalReadyFiles.map((f: AudioFile) => f.classId)
    );

    const allClassesHaveFinal = nonDefaultClasses.every((c) =>
      classesWithFinal.has(c.classId)
    );

    const schulsongSatisfied = event.isSchulsong
      ? finalReadyFiles.some((f: AudioFile) => f.isSchulsong)
      : true;

    const allComplete = allClassesHaveFinal && schulsongSatisfied;

    if (!allComplete) {
      return NextResponse.json({
        success: true,
        allComplete: false,
        tracks: [],
      });
    }

    // ---------------------------------------------------------------
    // Pick best file per class: prefer MP3 over WAV
    // ---------------------------------------------------------------
    const buildTrackList = () => {
      // Group final files by classId
      const filesByClass = new Map<string, AudioFile[]>();
      for (const f of finalReadyFiles) {
        if (f.isSchulsong) continue; // handle schulsong separately
        const existing = filesByClass.get(f.classId) || [];
        existing.push(f);
        filesByClass.set(f.classId, existing);
      }

      const tracks: {
        fileId: string;
        className: string;
        classType?: string;
        songTitle?: string;
        fileSizeBytes?: number;
        isSchulsong: boolean;
      }[] = [];

      // One track per non-default class
      for (const cls of nonDefaultClasses) {
        const candidates = filesByClass.get(cls.classId);
        if (!candidates || candidates.length === 0) continue;

        const best = pickBestFile(candidates);

        // Try to resolve a song title from the class songs list
        const songTitle =
          best.songId
            ? cls.songs.find((s) => s.id === best.songId)?.title
            : cls.songs.length === 1
              ? cls.songs[0].title
              : undefined;

        tracks.push({
          fileId: best.id,
          className: cls.className,
          classType: cls.classType,
          songTitle,
          fileSizeBytes: best.fileSizeBytes,
          isSchulsong: false,
        });
      }

      // Schulsong track (if applicable)
      if (event.isSchulsong) {
        const schulsongFiles = finalReadyFiles.filter(
          (f: AudioFile) => f.isSchulsong
        );
        if (schulsongFiles.length > 0) {
          const best = pickBestFile(schulsongFiles);
          tracks.push({
            fileId: best.id,
            className: 'Schulsong',
            classType: undefined,
            songTitle: undefined,
            fileSizeBytes: best.fileSizeBytes,
            isSchulsong: true,
          });
        }
      }

      return tracks;
    };

    const tracks = buildTrackList();

    return NextResponse.json({
      success: true,
      allComplete: true,
      tracks,
    });
  } catch (error) {
    console.error('Error fetching audio downloads for teacher:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch audio downloads',
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
