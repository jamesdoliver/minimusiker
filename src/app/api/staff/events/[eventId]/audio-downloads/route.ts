import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffSession } from '@/lib/auth/verifyStaffSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import { AudioFile } from '@/lib/types/teacher';

export const dynamic = 'force-dynamic';

/**
 * GET /api/staff/events/[eventId]/audio-downloads
 * List downloadable audio tracks for a staff member's event.
 * Returns metadata only (no actual file bytes).
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

    // Fetch event detail (for class names) and audio files in parallel
    const [eventDetail, allAudioFiles] = await Promise.all([
      getAirtableService().getSchoolEventDetail(eventId),
      teacherService.getAudioFilesByEventId(eventId),
    ]);

    if (!eventDetail) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Filter to final + ready files only
    const finalReadyFiles = allAudioFiles.filter(
      (f: AudioFile) => f.type === 'final' && f.status === 'ready'
    );

    if (finalReadyFiles.length === 0) {
      return NextResponse.json({ success: true, tracks: [] });
    }

    // Group by classId, separate schulsong
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

    const tracks: {
      fileId: string;
      className: string;
      classType?: string;
      songTitle?: string;
      fileSizeBytes?: number;
      isSchulsong: boolean;
    }[] = [];

    // One track per class that has final audio (prefer MP3)
    for (const cls of eventDetail.classes) {
      const candidates = filesByClass.get(cls.classId);
      if (!candidates || candidates.length === 0) continue;

      const best = pickBestFile(candidates);

      // Try to resolve song title
      const songTitle = best.songId && cls.songs
        ? cls.songs.find(s => s.id === best.songId)?.title
        : cls.songs?.length === 1
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

    // Schulsong track
    if (eventDetail.isSchulsong && schulsongFiles.length > 0) {
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

    return NextResponse.json({ success: true, tracks });
  } catch (error) {
    console.error('Error fetching staff audio downloads:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch audio downloads' },
      { status: 500 }
    );
  }
}

function pickBestFile(candidates: AudioFile[]): AudioFile {
  const mp3 = candidates.find((f) => f.r2Key.endsWith('.mp3'));
  return mp3 ?? candidates[0];
}
