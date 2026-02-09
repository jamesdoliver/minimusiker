import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherService } from '@/lib/services/teacherService';
import { computeSchulsongReleaseDate } from '@/lib/utils/schulsongRelease';
import { sendSchulsongReleaseEmailForEvent } from '@/lib/services/schulsongEmailService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/events/[eventId]/approve-schulsong
 * Admin approves/overrides the schulsong release.
 *
 * Body (JSON, optional):
 *   mode: 'scheduled' (default) | 'instant'
 *
 * - 'scheduled': release next workday 7am Berlin, cron auto-fires email
 * - 'instant': release now + fire email immediately
 *
 * No teacher approval required (admin can override).
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

    // Parse optional mode from body
    let mode: 'scheduled' | 'instant' = 'scheduled';
    try {
      const body = await request.json();
      if (body.mode === 'instant') mode = 'instant';
    } catch {
      // No body is fine — default to scheduled
    }

    const eventId = decodeURIComponent(params.eventId);
    const airtableService = getAirtableService();
    const teacherService = getTeacherService();

    // Resolve event
    const eventDetail = await airtableService.getSchoolEventDetail(eventId);
    const resolvedEventId = eventDetail?.eventId || eventId;

    // Find the schulsong audio file
    const schulsongFile = await teacherService.getSchulsongAudioFile(resolvedEventId);
    if (!schulsongFile) {
      return NextResponse.json(
        { error: 'No schulsong audio file found' },
        { status: 404 }
      );
    }

    const isOverride = !schulsongFile.teacherApprovedAt;

    // Set approval_status = 'approved' on the audio file
    await teacherService.updateAudioFileApprovalStatus(schulsongFile.id, 'approved');

    // Compute release date based on mode
    const releasedAt = mode === 'instant'
      ? new Date().toISOString()
      : computeSchulsongReleaseDate().toISOString();

    // Write to Events table (also sets admin_approval_status = 'approved')
    await airtableService.setSchulsongReleasedAt(resolvedEventId, releasedAt);

    // For instant mode, fire email immediately (don't fail approval if email fails)
    if (mode === 'instant') {
      try {
        await sendSchulsongReleaseEmailForEvent(resolvedEventId);
      } catch (err) {
        console.error('[approve-schulsong] Instant email failed (approval still succeeded):', err);
      }
    }

    return NextResponse.json({
      success: true,
      releasedAt,
      mode,
      isOverride,
    });
  } catch (error) {
    console.error('Error approving schulsong:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve schulsong' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/events/[eventId]/approve-schulsong
 * Admin rejects the schulsong
 *
 * Sets approval_status='rejected' + rejection_comment on AudioFile,
 * clears teacherApprovedAt (teacher must re-approve after fix),
 * clears schulsong_released_at on Events.
 */
export async function DELETE(
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
    const teacherService = getTeacherService();

    let comment: string | undefined;
    try {
      const body = await request.json();
      comment = body.comment;
    } catch {
      // No body is fine
    }

    // Resolve event
    const eventDetail = await airtableService.getSchoolEventDetail(eventId);
    const resolvedEventId = eventDetail?.eventId || eventId;

    // Find the schulsong audio file
    const schulsongFile = await teacherService.getSchulsongAudioFile(resolvedEventId);
    if (!schulsongFile) {
      return NextResponse.json(
        { error: 'No schulsong audio file found' },
        { status: 404 }
      );
    }

    // Set approval_status = 'rejected' + comment on the audio file
    await teacherService.updateAudioFileApprovalStatus(schulsongFile.id, 'rejected', comment);

    // Clear teacherApprovedAt on the audio file (teacher must re-approve after engineer fixes)
    await teacherService.clearTeacherApprovedAt(schulsongFile.id);

    // Clear schulsong_released_at on Events table
    await airtableService.setSchulsongReleasedAt(resolvedEventId, null);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error rejecting schulsong:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reject schulsong' },
      { status: 500 }
    );
  }
}
