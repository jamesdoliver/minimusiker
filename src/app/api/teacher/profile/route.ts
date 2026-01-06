import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teacher/profile
 *
 * Get full teacher profile information including school details
 *
 * Returns:
 * - teacher: Teacher object with all fields including region, school_address, school_phone
 */
export async function GET(request: NextRequest) {
  try {
    // Verify teacher session
    const session = verifyTeacherSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get full teacher profile
    const teacherService = getTeacherService();
    const teacher = await teacherService.getTeacherByEmail(session.email);

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found' }, { status: 404 });
    }

    return NextResponse.json({
      teacher,
    });
  } catch (error) {
    console.error('Error fetching teacher profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teacher profile' },
      { status: 500 }
    );
  }
}
