import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getTeacherService, AlbumTrackUpdate } from '@/lib/services/teacherService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/events/[eventId]/album-order
 * Get all tracks for the album layout modal (admin access, no teacher auth check)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const teacherService = getTeacherService();

    console.log(`[admin/album-order] GET eventId="${eventId}"`);
    const tracks = await teacherService.getAlbumTracksData(eventId);
    console.log(`[admin/album-order] GET returning ${tracks.length} tracks:`, tracks.map(t => `${t.albumOrder}. ${t.songTitle} (${t.songId})`));

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
 * PUT /api/admin/events/[eventId]/album-order
 * Update album order and optionally song titles/class names (admin access)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const teacherService = getTeacherService();

    const body = await request.json();
    const { tracks } = body as { tracks: AlbumTrackUpdate[] };

    if (!tracks || !Array.isArray(tracks)) {
      return NextResponse.json(
        { error: 'Invalid request: tracks array is required' },
        { status: 400 }
      );
    }

    console.log(`[admin/album-order] PUT eventId="${eventId}", ${tracks.length} tracks:`, tracks.map(t => `${t.albumOrder}. ${t.songId}`));
    await teacherService.updateAlbumOrderData(eventId, tracks);
    console.log(`[admin/album-order] PUT completed successfully`);

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
