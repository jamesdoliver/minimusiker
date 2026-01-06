import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffSession } from '@/lib/auth/verifyStaffSession';
import { getTeacherService } from '@/lib/services/teacherService';

/**
 * GET /api/staff/events/[eventId]/classes/[classId]/songs
 * Get all songs for a class with their audio file status
 * Used by staff portal to show which songs need raw audio uploads
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string; classId: string } }
) {
  try {
    // Verify staff session
    const session = verifyStaffSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const classId = decodeURIComponent(params.classId);

    const teacherService = getTeacherService();

    // Get all songs with their audio files
    const songsWithAudio = await teacherService.getSongsWithAudioStatus(eventId);

    // Filter to just songs for this class
    const classSongs = songsWithAudio.filter((song) => song.classId === classId);

    return NextResponse.json({
      success: true,
      songs: classSongs,
      count: classSongs.length,
    });
  } catch (error) {
    console.error('Error getting songs for class:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get songs',
      },
      { status: 500 }
    );
  }
}
