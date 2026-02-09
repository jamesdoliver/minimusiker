import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherService } from '@/lib/services/teacherService';
import { computeSchulsongReleaseDate } from '@/lib/utils/schulsongRelease';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/events/[eventId]/approve-schulsong
 * Admin approves the schulsong (after teacher has approved)
 *
 * Sets approval_status='approved' on the schulsong AudioFile,
 * computes schulsong_released_at (next workday 8am CET), and writes it to Events.
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

    // Verify teacher has approved first
    if (!schulsongFile.teacherApprovedAt) {
      return NextResponse.json(
        { error: 'Teacher must approve the schulsong first' },
        { status: 400 }
      );
    }

    // Set approval_status = 'approved' on the audio file
    await teacherService.updateAudioFileApprovalStatus(schulsongFile.id, 'approved');

    // Compute release date and write to Events table
    const releaseDate = computeSchulsongReleaseDate();
    const releasedAt = releaseDate.toISOString();
    await airtableService.setSchulsongReleasedAt(resolvedEventId, releasedAt);

    return NextResponse.json({
      success: true,
      releasedAt,
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
