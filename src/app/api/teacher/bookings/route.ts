import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { SchoolBooking } from '@/lib/types/airtable';

export const dynamic = 'force-dynamic';

/**
 * Response type for teacher bookings
 */
interface TeacherBookingView {
  id: string;
  simplybookId: string;
  schoolName: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  postalCode?: string;
  estimatedChildren?: number;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  portalStatus: 'pending_setup' | 'classes_added' | 'ready' | null;
  needsSetup: boolean;
}

/**
 * Transform SchoolBooking to TeacherBookingView
 */
function transformToTeacherView(booking: SchoolBooking): TeacherBookingView {
  return {
    id: booking.id,
    simplybookId: booking.simplybookId,
    schoolName: booking.schoolContactName || 'Unknown School',
    contactEmail: booking.schoolContactEmail,
    contactPhone: booking.schoolPhone,
    address: booking.schoolAddress,
    postalCode: booking.schoolPostalCode,
    estimatedChildren: booking.estimatedChildren,
    eventDate: booking.startDate || '',
    startTime: booking.startTime,
    endTime: booking.endTime,
    portalStatus: booking.portalStatus || null,
    needsSetup: !booking.portalStatus || booking.portalStatus === 'pending_setup',
  };
}

/**
 * GET /api/teacher/bookings
 * Get all SimplyBook bookings for the authenticated teacher
 * Returns bookings that need setup (no classes added yet) and active bookings
 */
export async function GET(request: NextRequest) {
  try {
    // Verify teacher session
    const session = verifyTeacherSession(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get bookings from SchoolBookings table where email matches
    const bookings = await getAirtableService().getBookingsForTeacher(session.email);

    // Transform to teacher view
    const bookingViews = bookings.map(transformToTeacherView);

    // Separate into pending setup and active
    const pendingSetup = bookingViews.filter(b => b.needsSetup);
    const active = bookingViews.filter(b => !b.needsSetup);

    return NextResponse.json({
      success: true,
      bookings: bookingViews,
      pendingSetup,
      active,
      stats: {
        total: bookingViews.length,
        pendingSetup: pendingSetup.length,
        active: active.length,
      },
    });
  } catch (error) {
    console.error('Error fetching teacher bookings:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch bookings',
        bookings: [],
      },
      { status: 500 }
    );
  }
}
