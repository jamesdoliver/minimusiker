import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import { triggerSchulsongTeacherApprovedNotification, triggerSchulsongTeacherActionNotification } from '@/lib/services/notificationService';
import { computeUnifiedReleaseDate, computeSchulsongMerchCutoff } from '@/lib/utils/schulsongRelease';
import { getThreshold, parseOverrides } from '@/lib/utils/eventThresholds';
import { getActivityService } from '@/lib/services/activityService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/teacher/events/[eventId]/schulsong-approve
 * Teacher approves the schulsong
 *
 * Prerequisites:
 * - Teacher must be authenticated
 * - Event must have is_schulsong = true
 * - Schulsong file must exist (type=final, status=ready)
 *
 * After approval, sends email to admins (fire-and-forget).
 *
 * Returns:
 * - success: boolean
 * - approvedAt: ISO datetime when teacher approved
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

    // Approve the schulsong (critical — sets teacher_approved_at + approval_status)
    const result = await teacherService.approveSchulsongAsTeacher(eventId, notes);

    // Post-approval side effects: release scheduling, notifications, activity log.
    // These are non-fatal — the teacher approval is the critical action.
    // If these fail, admin can manually trigger release from AudioReviewModal.
    try {
      const airtableService = getAirtableService();
      const event = await airtableService.getEventByEventId(eventId);
      if (event && !event.schulsong_released_at) {
        // Determine if this is a combined event (M/PLUS + Schulsong) or schulsong-only
        const isCombined = !!(event.is_minimusikertag || event.is_plus);
        const overrides = parseOverrides(event.timeline_overrides);
        const fullReleaseDays = getThreshold('full_release_days', overrides);

        // Unified release: schulsong-only = approval+1 day, combined = max(normal gate, approval+1)
        const releaseDate = computeUnifiedReleaseDate(event.event_date, fullReleaseDays, isCombined);
        await airtableService.setSchulsongReleasedAt(eventId, releaseDate.toISOString());

        // Auto-set merch cutoff: schulsong-only = release+10, combined = max(event+14, release+7)
        const merchCutoff = computeSchulsongMerchCutoff(releaseDate, event.event_date, isCombined);
        await airtableService.setSchulsongMerchCutoff(eventId, merchCutoff.toISOString());
      }
      if (event) {
        triggerSchulsongTeacherApprovedNotification({
          schoolName: event.school_name,
          eventDate: event.event_date,
          eventId,
        }).catch((err) => {
          console.error('[schulsong-approve] Failed to send notification:', err);
        });

        // Notify engineer of teacher's decision (fire-and-forget)
        triggerSchulsongTeacherActionNotification({
          schoolName: event.school_name,
          eventDate: event.event_date,
          eventId,
          action: 'approved',
          teacherNotes: notes,
        }).catch((err) => {
          console.error('[schulsong-approve] Failed to send engineer notification:', err);
        });

        // Log activity (fire-and-forget)
        getActivityService().logActivity({
          eventRecordId: event.id,
          activityType: 'schulsong_approved',
          description: 'Schulsong approved by teacher',
          actorEmail: session.email,
          actorType: 'teacher',
        });
      }
    } catch (postApprovalError) {
      // Teacher approval succeeded but release scheduling failed.
      // Admin will see "Approved" state and can manually trigger release.
      console.error('[schulsong-approve] Post-approval side effects failed (teacher approval succeeded):', postApprovalError);
    }

    return NextResponse.json({
      success: true,
      approvedAt: result.approvedAt,
    });
  } catch (error) {
    console.error('Error approving schulsong as teacher:', error);

    // Return specific error messages for known error types
    const errorMessage = error instanceof Error ? error.message : 'Failed to approve schulsong';

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
