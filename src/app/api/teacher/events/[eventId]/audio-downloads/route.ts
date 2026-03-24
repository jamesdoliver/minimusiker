import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { AudioFile } from '@/lib/types/teacher';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teacher/events/[eventId]/audio-downloads
 * List downloadable audio tracks for a teacher's event.
 *
 * Returns one track per song (not per class). Uses mp3R2Key when available.
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
      return NextResponse.json({ success: true, tracks: [] });
    }

    const nonDefaultClasses = event.classes.filter((c) => !c.isDefault);

    const tracks: {
      fileId: string;
      className: string;
      classType?: string;
      songTitle?: string;
      displayName: string;
      fileSizeBytes?: number;
      isSchulsong: boolean;
    }[] = [];

    // Build one track per song-level audio file
    for (const cls of nonDefaultClasses) {
      const classFiles = finalReadyFiles.filter(
        (f) => f.classId === cls.classId && !f.isSchulsong
      );
      if (classFiles.length === 0) continue;

      for (const af of classFiles) {
        // Resolve song title from class songs list
        const song = af.songId
          ? cls.songs.find((s) => s.id === af.songId)
          : cls.songs.length === 1
            ? cls.songs[0]
            : undefined;

        const songTitle = song?.title;
        const displayName = songTitle
          ? `${songTitle} - ${cls.className}`
          : cls.className;

        tracks.push({
          fileId: af.id,
          className: cls.className,
          classType: cls.classType,
          songTitle,
          displayName,
          fileSizeBytes: af.fileSizeBytes,
          isSchulsong: false,
        });
      }
    }

    // Schulsong track
    if (event.isSchulsong) {
      const schulsongFiles = finalReadyFiles.filter(
        (f: AudioFile) => f.isSchulsong
      );
      if (schulsongFiles.length > 0) {
        const best = schulsongFiles[0];
        tracks.push({
          fileId: best.id,
          className: 'Schulsong',
          classType: undefined,
          songTitle: undefined,
          displayName: 'Schulsong',
          fileSizeBytes: best.fileSizeBytes,
          isSchulsong: true,
        });
      }
    }

    return NextResponse.json({ success: true, tracks });
  } catch (error) {
    console.error('Error fetching audio downloads for teacher:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch audio downloads' },
      { status: 500 }
    );
  }
}
