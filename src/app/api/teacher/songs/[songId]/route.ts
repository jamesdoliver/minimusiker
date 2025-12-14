import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';

/**
 * GET /api/teacher/songs/[songId]
 * Get a single song
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { songId: string } }
) {
  try {
    const session = verifyTeacherSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const songId = decodeURIComponent(params.songId);
    const teacherService = getTeacherService();

    const song = await teacherService.getSongById(songId);

    if (!song) {
      return NextResponse.json(
        { error: 'Song not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      song,
    });
  } catch (error) {
    console.error('Error fetching song:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch song' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/teacher/songs/[songId]
 * Update a song
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { songId: string } }
) {
  try {
    const session = verifyTeacherSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const songId = decodeURIComponent(params.songId);
    const { title, artist, notes } = await request.json();

    const teacherService = getTeacherService();

    // Get the song to verify access
    const existingSong = await teacherService.getSongById(songId);
    if (!existingSong) {
      return NextResponse.json(
        { error: 'Song not found' },
        { status: 404 }
      );
    }

    // Verify teacher has access to this event
    const event = await teacherService.getTeacherEventDetail(existingSong.eventId, session.email);
    if (!event) {
      return NextResponse.json(
        { error: 'You do not have access to this song' },
        { status: 403 }
      );
    }

    // Check if event is still editable
    if (event.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot modify songs for completed events' },
        { status: 400 }
      );
    }

    // Update the song
    const updatedSong = await teacherService.updateSong(songId, {
      title: title?.trim(),
      artist: artist?.trim(),
      notes: notes?.trim(),
    });

    return NextResponse.json({
      success: true,
      song: updatedSong,
      message: 'Song updated successfully',
    });
  } catch (error) {
    console.error('Error updating song:', error);
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
 * DELETE /api/teacher/songs/[songId]
 * Delete a song
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { songId: string } }
) {
  try {
    const session = verifyTeacherSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const songId = decodeURIComponent(params.songId);
    const teacherService = getTeacherService();

    // Get the song to verify access
    const existingSong = await teacherService.getSongById(songId);
    if (!existingSong) {
      return NextResponse.json(
        { error: 'Song not found' },
        { status: 404 }
      );
    }

    // Verify teacher has access to this event
    const event = await teacherService.getTeacherEventDetail(existingSong.eventId, session.email);
    if (!event) {
      return NextResponse.json(
        { error: 'You do not have access to this song' },
        { status: 403 }
      );
    }

    // Check if event is still editable
    if (event.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot delete songs from completed events' },
        { status: 400 }
      );
    }

    // Delete the song
    await teacherService.deleteSong(songId);

    return NextResponse.json({
      success: true,
      message: 'Song deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting song:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete song',
      },
      { status: 500 }
    );
  }
}
