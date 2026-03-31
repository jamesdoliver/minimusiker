import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { AudioFile } from '@/lib/types/teacher';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teacher/events/[eventId]/audio-downloads
 * List downloadable audio tracks for a teacher's event.
 *
 * Returns tracks in album tracklist order (schulsong at position 1 when present).
 * Uses getAlbumTracksData as the ordering backbone and matches audio files by songId.
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
      return NextResponse.json({ success: true, tracks: [] });
    }

    // 2. Get album tracks — canonical order (schulsong at 1, groups included)
    const albumTracks = await teacherService.getAlbumTracksData(eventId);

    const tracks: {
      fileId: string;
      className: string;
      classType?: string;
      songTitle?: string;
      displayName: string;
      fileSizeBytes?: number;
      isSchulsong: boolean;
    }[] = [];

    if (albumTracks.length > 0) {
      // --- Primary path: album-track-based ordering ---

      // 3. Build audio lookup by songId + separate schulsong audio
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

      // 4. Fallback: match audio files without songId to single-song classes
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

      // 5. Build tracks in album order
      for (const albumTrack of albumTracks) {
        const audio = albumTrack.isSchulsong
          ? schulsongAudio
          : audioBySongId.get(albumTrack.songId);

        if (!audio) continue;

        const displayName = albumTrack.isSchulsong
          ? albumTrack.songTitle
          : `${albumTrack.songTitle} - ${albumTrack.className}`;

        tracks.push({
          fileId: audio.id,
          className: albumTrack.className,
          classType: albumTrack.classType !== 'regular' ? albumTrack.classType : undefined,
          songTitle: albumTrack.songTitle,
          displayName,
          fileSizeBytes: audio.fileSizeBytes,
          isSchulsong: albumTrack.isSchulsong || false,
        });
      }
    } else {
      // --- Fallback: class-based iteration for legacy events without Song records ---
      const nonDefaultClasses = event.classes.filter((c) => !c.isDefault);

      for (const cls of nonDefaultClasses) {
        const classFiles = finalReadyFiles.filter(
          (f) => f.classId === cls.classId && !f.isSchulsong
        );
        for (const af of classFiles) {
          const song = af.songId
            ? cls.songs.find((s) => s.id === af.songId)
            : cls.songs.length === 1 ? cls.songs[0] : undefined;

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

      // Schulsong fallback
      const schulsongFile = finalReadyFiles.find((f) => f.isSchulsong);
      if (schulsongFile) {
        tracks.push({
          fileId: schulsongFile.id,
          className: 'Schulsong',
          classType: undefined,
          songTitle: undefined,
          displayName: 'Schulsong',
          fileSizeBytes: schulsongFile.fileSizeBytes,
          isSchulsong: true,
        });
      }
    }

    return NextResponse.json({ success: true, tracks });
  } catch (error) {
    console.error('Error fetching teacher audio downloads:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch audio downloads' },
      { status: 500 }
    );
  }
}
