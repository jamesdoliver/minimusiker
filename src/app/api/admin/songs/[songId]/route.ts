import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getTeacherService } from '@/lib/services/teacherService';

/**
 * PUT /api/admin/songs/[songId]
 * Update a song (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { songId: string } }
) {
  try {
    // Verify admin session
    const session = verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const songId = decodeURIComponent(params.songId);
    const { title, artist, notes } = await request.json();

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Song title is required' },
        { status: 400 }
      );
    }

    const teacherService = getTeacherService();

    // Admins can update any song - no ownership check
    await teacherService.updateSong(songId, {
      title: title.trim(),
      artist: artist?.trim() || '',
      notes: notes?.trim() || '',
    });

    return NextResponse.json({
      success: true,
      message: 'Song updated successfully',
    });
  } catch (error) {
    console.error('Error updating song (admin):', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update song',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/songs/[songId]
 * Delete a song (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { songId: string } }
) {
  try {
    // Verify admin session
    const session = verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const songId = decodeURIComponent(params.songId);
    const teacherService = getTeacherService();

    // Admins can delete any song - no ownership check
    await teacherService.deleteSong(songId);

    return NextResponse.json({
      success: true,
      message: 'Song deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting song (admin):', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete song',
      },
      { status: 500 }
    );
  }
}
