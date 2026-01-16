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

    // Find school name from soonest upcoming event (events are sorted by date ascending)
    const upcomingEvents = events.filter(
      (e) => e.status === 'upcoming' || e.status === 'in-progress' || e.status === 'needs-setup'
    );
    // Fallback: soonest upcoming event -> first event -> session (static)
    const displaySchoolName = upcomingEvents[0]?.schoolName
      || events[0]?.schoolName
      || session.schoolName;

    return NextResponse.json({
      success: true,
      events,
      teacher: {
        email: session.email,
        name: session.name,
        schoolName: displaySchoolName,
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
