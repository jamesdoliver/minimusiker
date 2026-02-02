import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';

/**
 * POST /api/teacher/invite/create
 * Create an invite link for another teacher to access a specific event
 */
export async function POST(request: NextRequest) {
  try {
    // Verify teacher session
    const session = verifyTeacherSession(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { eventId } = body;

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

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

    // Get the event record ID from the event_id (booking_id)
    const eventRecordId = await airtableService.getEventsRecordIdByBookingId(eventId);
    if (!eventRecordId) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Create the invite
    const invite = await teacherService.createEventInvite(eventRecordId, session.teacherId);

    return NextResponse.json({
      success: true,
      inviteUrl: invite.inviteUrl,
      inviteToken: invite.token,
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    console.error('Error creating teacher invite:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create invite',
      },
      { status: 500 }
    );
  }
}
