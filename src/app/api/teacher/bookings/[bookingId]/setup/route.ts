import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/teacher/bookings/[bookingId]/setup
 * Initialize an event from a SchoolBooking
 * Updates portal status to allow class creation (no placeholder records needed)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    // Verify teacher session
    const session = verifyTeacherSession(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookingId } = await params;

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    // Get the school booking
    const booking = await getAirtableService().getSchoolBookingById(bookingId);

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Verify the teacher has access (email matches)
    if (booking.schoolContactEmail.toLowerCase() !== session.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'You do not have permission to setup this booking' },
        { status: 403 }
      );
    }

    // Check if booking is already setup
    if (booking.portalStatus === 'classes_added' || booking.portalStatus === 'ready') {
      return NextResponse.json(
        {
          error: 'This booking has already been set up',
          eventId: booking.simplybookId,
        },
        { status: 400 }
      );
    }

    // Update the school booking portal status to 'classes_added'
    // This marks the event as initialized - real classes will be created separately
    // No placeholder records needed since getTeacherEvents() now queries SchoolBookings directly
    await getAirtableService().updateBookingPortalStatus(bookingId, 'classes_added');

    return NextResponse.json({
      success: true,
      message: 'Event initialized successfully',
      eventId: booking.simplybookId,
      booking: {
        id: booking.id,
        simplybookId: booking.simplybookId,
        schoolName: booking.schoolContactName,
        eventDate: booking.startDate,
        portalStatus: 'classes_added',
      },
    });
  } catch (error) {
    console.error('Error setting up booking:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to setup booking',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/teacher/bookings/[bookingId]/setup
 * Get setup status for a specific booking
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    // Verify teacher session
    const session = verifyTeacherSession(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookingId } = await params;

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      );
    }

    // Get the school booking
    const booking = await getAirtableService().getSchoolBookingById(bookingId);

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Verify the teacher has access (email matches)
    if (booking.schoolContactEmail.toLowerCase() !== session.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'You do not have permission to view this booking' },
        { status: 403 }
      );
    }

    // Get classes for this event if it has been setup
    let classes: Array<{
      classId: string;
      className: string;
      teacherName: string;
      registeredCount: number;
    }> = [];

    if (booking.portalStatus === 'classes_added' || booking.portalStatus === 'ready') {
      classes = await getAirtableService().getEventClasses(booking.simplybookId);
    }

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        simplybookId: booking.simplybookId,
        schoolName: booking.schoolContactName,
        contactEmail: booking.schoolContactEmail,
        eventDate: booking.startDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        estimatedChildren: booking.estimatedChildren,
        portalStatus: booking.portalStatus || 'pending_setup',
        isSetup: booking.portalStatus === 'classes_added' || booking.portalStatus === 'ready',
      },
      classes,
      classCount: classes.length,
    });
  } catch (error) {
    console.error('Error fetching booking setup status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch booking',
      },
      { status: 500 }
    );
  }
}
