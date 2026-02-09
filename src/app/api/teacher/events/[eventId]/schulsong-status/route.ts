import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teacher/events/[eventId]/schulsong-status
 * Get schulsong status for teacher portal
 *
 * Returns the current state of the schulsong approval workflow:
 * - waiting: No final schulsong file OR admin hasn't approved
 * - ready_for_approval: Final file exists, admin approved, teacher hasn't approved
 * - approved: Teacher has approved (teacherApprovedAt is set)
 */
export async function GET(
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
    const teacherService = getTeacherService();

    // Get schulsong status
    const status = await teacherService.getSchulsongStatusForTeacher(eventId);

    // If there's an audio URL (r2Key), generate a signed URL for playback
    if (status.audioUrl) {
      const r2Service = getR2Service();
      try {
        if (await r2Service.fileExists(status.audioUrl)) {
          // Generate 1 hour signed URL for playback
          status.audioUrl = await r2Service.generateSignedUrl(status.audioUrl, 3600);
        } else {
          // File doesn't exist, clear the URL
          status.audioUrl = undefined;
        }
      } catch (err) {
        console.error('Error generating schulsong signed URL:', err);
        status.audioUrl = undefined;
      }
    }

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('Error fetching schulsong status for teacher:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch schulsong status',
      },
      { status: 500 }
    );
  }
}
