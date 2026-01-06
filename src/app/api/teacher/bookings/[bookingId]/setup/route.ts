import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getAirtableService } from '@/lib/services/airtableService';

/**
 * POST /api/teacher/bookings/[bookingId]/setup
 * Initialize an event from a SchoolBooking
 * Creates a placeholder record in parent_journey_table and updates portal status
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

    // Check if booking is already setup (has parent_journey records)
    if (booking.portalStatus === 'classes_added' || booking.portalStatus === 'ready') {
      return NextResponse.json(
        {
          error: 'This booking has already been set up',
          eventId: booking.simplybookId,
        },
        { status: 400 }
      );
    }

    // Generate a booking_id for the parent_journey_table
    // Use the simplybookId as the booking_id for consistency
    const eventBookingId = booking.simplybookId;

    // Create a placeholder record in parent_journey_table
    // This serves as the "event shell" that classes will be added to
    // The placeholder is marked with PLACEHOLDER parent_id so it won't be counted as a real registration
    await getAirtableService().create({
      booking_id: eventBookingId,
      school_name: booking.schoolContactName || 'Unknown School',
      main_teacher: session.name || '',
      class: 'SETUP_PLACEHOLDER', // This placeholder class will be removed when real classes are added
      registered_child: 'SETUP_PLACEHOLDER',
      parent_first_name: 'PLACEHOLDER',
      parent_email: booking.schoolContactEmail,
      parent_telephone: booking.schoolPhone || '',
      event_type: 'MiniMusiker Day',
      parent_id: 'PLACEHOLDER',
      booking_date: booking.startDate || undefined,
    });

    // Update the school booking portal status to 'classes_added'
    // (Even though no classes are added yet, we're moving past 'pending_setup')
    await getAirtableService().updateBookingPortalStatus(bookingId, 'classes_added');

    return NextResponse.json({
      success: true,
      message: 'Event initialized successfully',
      eventId: eventBookingId,
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
      // Filter out the placeholder class
      classes = classes.filter(c => c.className !== 'SETUP_PLACEHOLDER');
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
