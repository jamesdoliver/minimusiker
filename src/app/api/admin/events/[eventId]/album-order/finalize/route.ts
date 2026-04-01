import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getTeacherService, AlbumTrackUpdate } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import { getActivityService } from '@/lib/services/activityService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/events/[eventId]/album-order/finalize
 * Admin finalize — saves current order and locks tracklist.
 * No date guard (admin can finalize at any time).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const airtableService = getAirtableService();

    // Resolve canonical event record
    const eventDetail = await airtableService.getSchoolEventDetail(eventId);
    const resolvedEventId = eventDetail?.eventId || eventId;

    // Save tracks if provided
    const body = await request.json().catch(() => ({}));
    const { tracks } = body as { tracks?: AlbumTrackUpdate[] };

    if (tracks && Array.isArray(tracks) && tracks.length > 0) {
      const teacherService = getTeacherService();
      await teacherService.updateAlbumOrderData(resolvedEventId, tracks);
    }

    const eventRecord = await airtableService.getEventByEventId(resolvedEventId);
    if (!eventRecord) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const finalizedAt = new Date().toISOString();
    await airtableService.updateEventFields(eventRecord.id, {
      tracklist_finalized_at: finalizedAt,
    });

    // Log activity (fire-and-forget)
    getActivityService().logActivity({
      eventRecordId: eventRecord.id,
      activityType: 'tracklist_confirmed',
      description: 'Admin confirmed tracklist',
      actorEmail: session.email,
      actorType: 'admin',
    });

    return NextResponse.json({ success: true, finalizedAt });
  } catch (error) {
    console.error('Error admin-finalizing tracklist:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to finalize' },
      { status: 500 }
    );
  }
}
