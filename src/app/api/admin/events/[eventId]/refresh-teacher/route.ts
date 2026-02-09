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

    // Get the Event record to find linked booking
    const eventRecord = await airtableService.getEventById(eventRecordId);
    if (!eventRecord) {
      return NextResponse.json(
        { success: false, error: 'Event record not found' },
        { status: 404 }
      );
    }

    // Get linked SchoolBooking
    const simplybookBookingIds = eventRecord.simplybook_booking;
    if (!simplybookBookingIds?.[0]) {
      return NextResponse.json(
        { success: false, error: 'No linked booking found for this event' },
        { status: 400 }
      );
    }

    const booking = await airtableService.getSchoolBookingById(simplybookBookingIds[0]);
    if (!booking?.schoolContactName) {
      return NextResponse.json(
        { success: false, error: 'No contact person found in booking' },
        { status: 400 }
      );
    }

    // Get classes for this event
    const classes = await airtableService.getClassesByEventId(eventRecordId);
    if (classes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No classes found for this event' },
        { status: 400 }
      );
    }

    // Find first class with empty main_teacher
    const classToUpdate = classes.find(c => !c.main_teacher);
    if (!classToUpdate) {
      return NextResponse.json(
        { success: false, error: 'All classes already have teachers assigned' },
        { status: 400 }
      );
    }

    // Update the class with the contact person as teacher
    await airtableService.updateClassTeacher(classToUpdate.id, booking.schoolContactName);

    return NextResponse.json({
      success: true,
      message: `Teacher set to "${booking.schoolContactName}" for class "${classToUpdate.class_name}"`,
      data: {
        classId: classToUpdate.class_id,
        className: classToUpdate.class_name,
        teacherName: booking.schoolContactName,
      },
    });
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
