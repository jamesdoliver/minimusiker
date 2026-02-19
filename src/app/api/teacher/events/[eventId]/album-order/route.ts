import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService, AlbumTrackUpdate } from '@/lib/services/teacherService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teacher/events/[eventId]/album-order
 * Get all tracks for the album layout modal
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    // Verify teacher session
    const session = verifyTeacherSession(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const teacherService = getTeacherService();

    // Get album tracks for this event
    const tracks = await teacherService.getAlbumTracks(eventId, session.email);

    return NextResponse.json({
      success: true,
      tracks,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Error fetching album tracks:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch album tracks',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/teacher/events/[eventId]/album-order
 * Update album order and optionally song titles/class names
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    // Verify teacher session
    const session = verifyTeacherSession(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const teacherService = getTeacherService();

    // Parse request body
    const body = await request.json();
    const { tracks } = body as { tracks: AlbumTrackUpdate[] };

    if (!tracks || !Array.isArray(tracks)) {
      return NextResponse.json(
        { error: 'Invalid request: tracks array is required' },
        { status: 400 }
      );
    }

    // Update album order
    await teacherService.updateAlbumOrder(eventId, session.email, tracks);

    return NextResponse.json({
      success: true,
      message: 'Album order updated successfully',
    });
  } catch (error) {
    console.error('Error updating album order:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update album order',
      },
      { status: 500 }
    );
  }
}
