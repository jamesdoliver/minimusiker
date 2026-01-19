import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';

/**
 * POST /api/admin/events/[eventId]/classes
 * Add a new class to an event (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    // Verify admin session
    const session = verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const { className, numChildren } = await request.json();

    if (!className || typeof className !== 'string' || className.trim().length === 0) {
      return NextResponse.json(
        { error: 'Class name is required' },
        { status: 400 }
      );
    }

    // Get event detail to find teacher email
    let eventDetail = await getAirtableService().getSchoolEventDetail(eventId);

    // If no event in parent_journey, try SchoolBookings
    if (!eventDetail) {
      const booking = await getAirtableService().getSchoolBookingBySimplybookId(eventId);
      if (booking) {
        eventDetail = {
          eventId: booking.simplybookId,
          schoolName: booking.schoolContactName || 'Unknown School',
          mainTeacher: booking.schoolContactName || '',
          eventDate: booking.startDate || '',
          eventType: 'MiniMusiker Day',
          classCount: 0,
          totalChildren: 0,
          totalParents: 0,
          classes: [],
          overallRegistrationRate: 0,
        };
      }
    }

    // Only fail if event doesn't exist at all
    if (!eventDetail) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Use fallback chain for teacher name: mainTeacher → assignedStaffName → placeholder
    let teacherEmail: string;
    if (eventDetail.mainTeacher) {
      teacherEmail = eventDetail.mainTeacher;
    } else if (eventDetail.assignedStaffName) {
      teacherEmail = eventDetail.assignedStaffName;
    } else {
      teacherEmail = 'Admin Created';
    }
    const teacherService = getTeacherService();

    // Admins can create classes for any event - no ownership check needed
    const newClass = await teacherService.createClass({
      eventId,
      className: className.trim(),
      teacherEmail,
      numChildren: numChildren ? parseInt(numChildren, 10) : undefined,
    });

    return NextResponse.json({
      success: true,
      class: newClass,
      message: 'Class added successfully',
    });
  } catch (error) {
    console.error('Error adding class (admin):', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add class',
      },
      { status: 500 }
    );
  }
}
