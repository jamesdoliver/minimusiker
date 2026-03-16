import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teacher/events/[eventId]/invites
 * Returns the team view: booking contact + all invites for an event
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyTeacherSession(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const teacherService = getTeacherService();
    const airtableService = getAirtableService();

    // Verify teacher has access to this event
    const hasAccess = await teacherService.teacherHasEventAccess(session.email, eventId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this event' },
        { status: 403 }
      );
    }

    // Get event record ID
    const eventRecordId = await airtableService.getEventsRecordIdByBookingId(eventId);
    if (!eventRecordId) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Get booking contact from SchoolBookings
    const booking = await airtableService.getSchoolBookingByEventRecordId(eventRecordId);
    const bookingContact = booking
      ? {
          name: booking.schoolContactName,
          email: booking.schoolContactEmail,
          isCurrentUser: booking.schoolContactEmail.toLowerCase() === session.email.toLowerCase(),
        }
      : null;

    // Get all invites for this event
    const invites = await teacherService.getEventInvites(eventRecordId);

    return NextResponse.json({
      success: true,
      bookingContact,
      invites,
    });
  } catch (error) {
    console.error('Error fetching event invites:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch invites' },
      { status: 500 }
    );
  }
}
