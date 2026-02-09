import { NextRequest, NextResponse } from 'next/server';
import { verifyEngineerSession } from '@/lib/auth/verifyEngineerSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/engineer/events/[eventId]/songs/[songId]/download-raw
 * Get signed download URLs for all raw audio files for a specific song
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string; songId: string } }
) {
  try {
    // Verify engineer session
    const session = verifyEngineerSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const songId = decodeURIComponent(params.songId);

    const teacherService = getTeacherService();

    // Get song to verify it exists
    const song = await teacherService.getSongById(songId);

    if (!song) {
      return NextResponse.json(
        { error: 'Song not found' },
        { status: 404 }
      );
    }

    if (song.eventId !== eventId) {
      return NextResponse.json(
        { error: 'Song does not belong to this event' },
        { status: 400 }
      );
    }

    // Get all raw audio files for this song
    const rawFiles = await teacherService.getAudioFilesBySongId(songId, 'raw');

    if (rawFiles.length === 0) {
      return NextResponse.json(
        { error: 'No raw audio files found for this song' },
        { status: 404 }
      );
    }

    // Generate signed download URLs for each file
    const r2 = getR2Service();
    const filesWithUrls = await Promise.all(
      rawFiles.map(async (file) => {
        const downloadUrl = await r2.getSongAudioUrl(file.r2Key, 3600);
        return {
          ...file,
          downloadUrl,
        };
      })
    );

    return NextResponse.json({
      success: true,
      song: {
        id: song.id,
        title: song.title,
        artist: song.artist,
      },
      files: filesWithUrls,
      count: filesWithUrls.length,
    });
  } catch (error) {
    console.error('Error getting raw audio files for download:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get download URLs',
      },
      { status: 500 }
    );
  }
}
