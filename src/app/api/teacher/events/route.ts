import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teacher/events
 * Get all events for the authenticated teacher
 */
export async function GET(request: NextRequest) {
  try {
    // Verify teacher session
    const session = verifyTeacherSession(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get teacher service
    const teacherService = getTeacherService();

    // Get teacher's events
    const events = await teacherService.getTeacherEvents(session.email);

    return NextResponse.json({
      success: true,
      events,
      teacher: {
        email: session.email,
        name: session.name,
        schoolName: session.schoolName,
      },
    });
  } catch (error) {
    console.error('Error fetching teacher events:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch events',
        events: [],
      },
      { status: 500 }
    );
  }
}
