import { NextRequest, NextResponse } from 'next/server';
import { getTeacherService } from '@/lib/services/teacherService';

/**
 * GET /api/teacher/invite/[token]
 * Validate an invite token and return event info for display
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'not_found' },
        { status: 400 }
      );
    }

    const teacherService = getTeacherService();

    // Get the invite
    const invite = await teacherService.getInviteByToken(token);

    if (!invite) {
      // Try to determine the specific error
      // Re-query to check if it exists but is invalid
      return NextResponse.json(
        { valid: false, error: 'not_found' },
        { status: 404 }
      );
    }

    // Get event info for display
    if (!invite.eventRecordId) {
      return NextResponse.json(
        { valid: false, error: 'invalid' },
        { status: 400 }
      );
    }

    const eventInfo = await teacherService.getEventInfoForInvite(invite.eventRecordId);

    if (!eventInfo) {
      return NextResponse.json(
        { valid: false, error: 'event_not_found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      valid: true,
      schoolName: eventInfo.schoolName,
      eventDate: eventInfo.eventDate,
      eventType: eventInfo.eventType,
      invitedByName: invite.invitedByName,
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    console.error('Error validating invite token:', error);
    return NextResponse.json(
      { valid: false, error: 'server_error' },
      { status: 500 }
    );
  }
}
