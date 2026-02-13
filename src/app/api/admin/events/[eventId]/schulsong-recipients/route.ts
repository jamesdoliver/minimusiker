import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherRecipientsForEvent, getParentRecipientsForEvent } from '@/lib/services/emailAutomationService';
import { EventThresholdMatch } from '@/lib/types/email-automation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/events/[eventId]/schulsong-recipients
 * Returns teacher + parent recipient counts for the confirmation dialog.
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
    const airtableService = getAirtableService();

    // Resolve event
    const eventDetail = await airtableService.getSchoolEventDetail(eventId);
    const resolvedEventId = eventDetail?.eventId || eventId;

    const event = await airtableService.getEventByEventId(resolvedEventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Build EventThresholdMatch from event data
    const now = new Date();
    const eventDate = new Date(event.event_date);
    const daysUntilEvent = Math.round((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const thresholdMatch: EventThresholdMatch = {
      eventId: event.event_id,
      eventRecordId: event.id,
      schoolName: event.school_name,
      eventDate: event.event_date,
      eventType: event.event_type || 'Minimusikertag',
      daysUntilEvent,
      accessCode: event.access_code,
      isKita: event.is_kita,
      isMinimusikertag: event.is_minimusikertag,
      isPlus: event.is_plus,
      isSchulsong: event.is_schulsong,
      isUnder100: event.is_under_100,
    };

    const [teachers, parents] = await Promise.all([
      getTeacherRecipientsForEvent(event.event_id, event.id, thresholdMatch),
      getParentRecipientsForEvent(event.event_id, event.id, thresholdMatch),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        teacherCount: teachers.length,
        parentCount: parents.length,
      },
    });
  } catch (error) {
    console.error('Error fetching schulsong recipients:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch recipient counts' },
      { status: 500 }
    );
  }
}
