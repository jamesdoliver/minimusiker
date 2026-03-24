import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import { triggerSchulsongTeacherActionNotification, triggerSchulsongTeacherRejectedNotification } from '@/lib/services/notificationService';
import { getActivityService } from '@/lib/services/activityService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/teacher/events/[eventId]/schulsong-reject
 * Teacher rejects the schulsong with optional notes
 *
 * Prerequisites:
 * - Teacher must be authenticated
 * - Event must have is_schulsong = true
 * - Schulsong file must exist (type=final, status=ready)
 *
 * After rejection:
 * - Clears any scheduled release date
 * - Sends notification to engineer (fire-and-forget)
 *
 * Returns:
 * - success: boolean
 * - rejectedAt: ISO datetime when teacher rejected
 */
export async function POST(
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
    const body = await request.json().catch(() => ({}));
    const notes = body.notes as string | undefined;

    const teacherService = getTeacherService();

    // Reject the schulsong (critical operation)
    const result = await teacherService.rejectSchulsongAsTeacher(eventId, notes);

    // Post-rejection side effects (non-fatal — rejection already succeeded above)
    try {
      const airtableService = getAirtableService();
      const event = await airtableService.getEventByEventId(eventId);
      if (event?.schulsong_released_at) {
        await airtableService.setSchulsongReleasedAt(eventId, null);
      }
      if (event?.schulsong_merch_cutoff) {
        await airtableService.setSchulsongMerchCutoff(eventId, null);
      }

      // Notify engineer and admins (fire-and-forget)
      if (event) {
        triggerSchulsongTeacherActionNotification({
          schoolName: event.school_name,
          eventDate: event.event_date,
          eventId,
          action: 'rejected',
          teacherNotes: notes,
        }).catch((err) => {
          console.error('[schulsong-reject] Failed to send engineer notification:', err);
        });

        triggerSchulsongTeacherRejectedNotification({
          schoolName: event.school_name,
          eventDate: event.event_date,
          eventId,
          teacherNotes: notes,
        }).catch((err) => {
          console.error('[schulsong-reject] Failed to send admin notification:', err);
        });

        // Log activity (fire-and-forget)
        getActivityService().logActivity({
          eventRecordId: event.id,
          activityType: 'schulsong_rejected',
          description: 'Schulsong rejected by teacher',
          actorEmail: session.email,
          actorType: 'teacher',
        }).catch((err: unknown) => {
          console.error('[schulsong-reject] Failed to log activity:', err);
        });
      }
    } catch (postRejectionError) {
      // Rejection succeeded but side effects failed — log but don't fail the request
      console.error('[schulsong-reject] Post-rejection side effects failed (rejection succeeded):', postRejectionError);
    }

    return NextResponse.json({
      success: true,
      rejectedAt: result.rejectedAt,
    });
  } catch (error) {
    console.error('Error rejecting schulsong as teacher:', error);

    // Return specific error messages for known error types
    const errorMessage = error instanceof Error ? error.message : 'Failed to reject schulsong';

    // Determine appropriate status code
    let statusCode = 500;
    if (errorMessage.includes('not found') || errorMessage.includes('No schulsong')) {
      statusCode = 404;
    } else if (errorMessage.includes('not have schulsong feature')) {
      statusCode = 400;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: statusCode }
    );
  }
}
