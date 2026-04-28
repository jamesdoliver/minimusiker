import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import { sendTeacherInviteEmail } from '@/lib/services/resendService';
import { resolveEventId } from '@/lib/utils/eventResolver';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/events/[eventId]/add-teacher
 * Admin endpoint to directly add a teacher to an event by email.
 * Creates/links the Teachers record AND issues a portal invite email.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const body = await request.json();
    const { email, name } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const teacherService = getTeacherService();
    const airtableService = getAirtableService();

    // Get the event record ID (supports event_id, legacy_booking_id, SimplyBook ID, access code)
    const resolved = await resolveEventId(eventId);
    if (!resolved) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    const eventRecordId = resolved.eventRecordId;

    // Get event details for school name
    const event = await airtableService.getEventById(eventRecordId);
    const schoolName = event?.school_name || 'Unknown School';

    // Find or create the teacher
    let teacher = await teacherService.getTeacherByEmail(email);

    if (!teacher) {
      // Create new teacher with the event linked
      teacher = await teacherService.createTeacher({
        email,
        name: name || email.split('@')[0],
        schoolName,
        linkedEventId: eventRecordId,
      });
    } else {
      // Link the event to the existing teacher
      await teacherService.linkEventToTeacher(teacher.id, eventRecordId);
    }

    // Issue invite + portal-access email so the teacher gets a login link
    let inviteSent = false;
    try {
      const invite = await teacherService.createEventInvite(eventRecordId, null);
      const eventInfo = await teacherService.getEventInfoForInvite(eventRecordId);
      if (eventInfo) {
        const result = await sendTeacherInviteEmail(email, {
          inviterName: admin.email || 'MiniMusiker Verwaltung',
          schoolName: eventInfo.schoolName,
          eventDate: eventInfo.eventDate,
          eventType: eventInfo.eventType,
          inviteUrl: invite.inviteUrl,
        });
        inviteSent = result.success;
        if (!result.success) {
          console.error('[admin add-teacher] sendTeacherInviteEmail failed:', result.error);
        }
      }
    } catch (inviteError) {
      console.error('[admin add-teacher] Failed to issue invite:', inviteError);
    }

    return NextResponse.json({
      success: true,
      teacher: {
        id: teacher.id,
        email: teacher.email,
        name: teacher.name,
      },
      inviteSent,
    });
  } catch (error) {
    console.error('Error adding teacher to event:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add teacher',
      },
      { status: 500 }
    );
  }
}
