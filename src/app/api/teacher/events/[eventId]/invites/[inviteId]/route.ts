import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/teacher/events/[eventId]/invites/[inviteId]
 * Revoke a pending invite
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { eventId: string; inviteId: string } }
) {
  try {
    const session = verifyTeacherSession(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const inviteId = params.inviteId;
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

    // Revoke the invite
    await teacherService.revokeInvite(inviteId, eventRecordId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking invite:', error);

    const message = error instanceof Error ? error.message : 'Failed to revoke invite';

    if (message.includes('does not belong')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.includes('Only pending')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
