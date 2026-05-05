import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/events/[eventId]/refresh-teacher
 * Syncs the booking's contact person to the first class's main_teacher field
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    // Verify admin authentication
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const eventId = decodeURIComponent(params.eventId);
    const airtableService = getAirtableService();

    // Get the Event record ID
    let eventRecordId = await airtableService.getEventsRecordIdByBookingId(eventId);

    // Try SimplyBook ID resolution if not found
    if (!eventRecordId && /^\d+$/.test(eventId)) {
      const booking = await airtableService.getSchoolBookingBySimplybookId(eventId);
      if (booking) {
        const linkedEvent = await airtableService.getEventBySchoolBookingId(booking.id);
        if (linkedEvent) {
          eventRecordId = linkedEvent.id;
        }
      }
    }

    if (!eventRecordId) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    const result = await airtableService.refreshTeacherForEvent(eventRecordId);

    switch (result.status) {
      case 'event_not_found':
        return NextResponse.json(
          { success: false, error: 'Event record not found' },
          { status: 404 }
        );
      case 'no_booking':
        return NextResponse.json(
          { success: false, error: 'No linked booking found for this event' },
          { status: 400 }
        );
      case 'no_contact':
        return NextResponse.json(
          { success: false, error: 'No contact person found in booking' },
          { status: 400 }
        );
      case 'no_classes':
        return NextResponse.json(
          { success: false, error: 'No classes found for this event' },
          { status: 400 }
        );
      case 'all_filled':
        return NextResponse.json(
          { success: false, error: 'All classes already have teachers assigned' },
          { status: 400 }
        );
      case 'updated':
        return NextResponse.json({
          success: true,
          message: `Teacher set to "${result.teacherName}" for class "${result.className}"`,
          data: {
            classId: result.classId,
            className: result.className,
            teacherName: result.teacherName,
          },
        });
    }
  } catch (error) {
    console.error('Error refreshing teacher:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh teacher',
      },
      { status: 500 }
    );
  }
}
