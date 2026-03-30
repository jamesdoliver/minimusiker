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
    console.log(`[teacher-audio-debug] eventId=${eventId}, event found=${!!event}, classes=${event?.classes?.length ?? 'N/A'}`);
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
    console.log(`[teacher-audio-debug] allAudioFiles=${allAudioFiles.length}, finalReady=${finalReadyFiles.length}`);
    if (finalReadyFiles.length > 0) {
      console.log(`[teacher-audio-debug] sample file: classId=${finalReadyFiles[0].classId}, type=${finalReadyFiles[0].type}, status=${finalReadyFiles[0].status}, isSchulsong=${finalReadyFiles[0].isSchulsong}`);
    }

    if (finalReadyFiles.length === 0) {
      console.log(`[teacher-audio-debug] RETURNING EMPTY — no final+ready files`);
      return NextResponse.json({ success: true, tracks: [] });
    }

    const nonDefaultClasses = event.classes.filter((c) => !c.isDefault);
    console.log(`[teacher-audio-debug] nonDefaultClasses=${nonDefaultClasses.length}, classIds=${nonDefaultClasses.map(c => c.classId).join(',')}`);

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
    console.log(`[teacher-audio-debug] audioFile classIds=${[...new Set(finalReadyFiles.map(f => f.classId))].join(',')}`);
    for (const cls of nonDefaultClasses) {
      const classFiles = finalReadyFiles.filter(
        (f) => f.classId === cls.classId && !f.isSchulsong
      );
      console.log(`[teacher-audio-debug] class=${cls.className} (${cls.classId}): matched ${classFiles.length} files`);
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

    // Group tracks — groups store audio with groupId as classId
    try {
      const groups = await teacherService.getGroupsByEventId(eventId);
      for (const group of groups) {
        const groupFiles = finalReadyFiles.filter(
          (f) => f.classId === group.groupId && !f.isSchulsong
        );
        if (groupFiles.length === 0) continue;

        for (const af of groupFiles) {
          const song = af.songId
            ? group.songs.find((s) => s.id === af.songId)
            : group.songs.length === 1
              ? group.songs[0]
              : undefined;

          const songTitle = song?.title;
          const displayName = songTitle
            ? `${songTitle} - ${group.groupName}`
            : group.groupName;

          tracks.push({
            fileId: af.id,
            className: group.groupName,
            classType: 'group',
            songTitle,
            displayName,
            fileSizeBytes: af.fileSizeBytes,
            isSchulsong: false,
          });
        }
      }
    } catch (err) {
      // Groups are optional — don't fail the whole request
      console.error('[teacher-audio-debug] Error fetching group audio:', err);
    }

    // Schulsong track (include if any schulsong audio exists, regardless of event flag)
    {
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

    console.log(`[teacher-audio-debug] RETURNING ${tracks.length} tracks`);
    return NextResponse.json({ success: true, tracks });
  } catch (error) {
    console.error('[teacher-audio-debug] CAUGHT ERROR:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch audio downloads' },
      { status: 500 }
    );
  }
}
