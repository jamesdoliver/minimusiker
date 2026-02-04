import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';

/**
 * POST /api/teacher/events/[eventId]/schulsong-approve
 * Teacher approves the schulsong
 *
 * Prerequisites:
 * - Teacher must be authenticated
 * - Event must have is_schulsong = true
 * - Schulsong file must exist (type=final, status=ready)
 * - Admin must have approved (approval_status='approved')
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
    const teacherService = getTeacherService();

    // Approve the schulsong
    const result = await teacherService.approveSchulsongAsTeacher(eventId);

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
    } else if (errorMessage.includes('not been approved by admin')) {
      statusCode = 400;
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
