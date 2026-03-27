import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/events/[eventId]/album-order/unlock
 * Unlock a finalized tracklist so it can be edited and re-finalized by admin.
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

    const eventRecord = await airtableService.getEventByEventId(resolvedEventId);
    if (!eventRecord) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    await airtableService.updateEventFields(eventRecord.id, {
      tracklist_finalized_at: null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unlocking tracklist:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to unlock' },
      { status: 500 }
    );
  }
}
