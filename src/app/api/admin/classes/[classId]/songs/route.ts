import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getTeacherService } from '@/lib/services/teacherService';

/**
 * POST /api/admin/classes/[classId]/songs
 * Add a new song to a class (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { classId: string } }
) {
  try {
    // Verify admin session
    const session = verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const classId = decodeURIComponent(params.classId);
    const { title, artist, notes, eventId } = await request.json();

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Song title is required' },
        { status: 400 }
      );
    }

    if (!eventId || typeof eventId !== 'string') {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    const teacherService = getTeacherService();

    // Admins can create songs for any class - no ownership check
    const newSong = await teacherService.createSong({
      classId,
      eventId,
      title: title.trim(),
      artist: artist?.trim() || '',
      notes: notes?.trim() || '',
    });

    return NextResponse.json({
      success: true,
      song: newSong,
      message: 'Song added successfully',
    });
  } catch (error) {
    console.error('Error adding song (admin):', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add song',
      },
      { status: 500 }
    );
  }
}
