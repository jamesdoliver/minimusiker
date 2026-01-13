import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';
import { SchoolBooking } from '@/lib/types/airtable';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { generateEventId } from '@/lib/utils/eventIdentifiers';

export const dynamic = 'force-dynamic';

// Extended booking data for display
export interface BookingWithDetails {
  id: string;
  code: string;
  schoolName: string;
  contactPerson: string;
  contactEmail: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  region?: string;
  numberOfChildren: number;
  costCategory: '>150 children' | '<150 children';
  bookingDate: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'hold' | 'no_region';
  startTime?: string;
  endTime?: string;
  eventName?: string;
  accessCode?: number;         // From linked Event
  shortUrl?: string;           // Computed: "minimusiker.app/e/{accessCode}"
}

/**
 * Transform SchoolBooking (Airtable) to BookingWithDetails (API response)
 */
function transformToBookingWithDetails(booking: SchoolBooking): BookingWithDetails {
  return {
    id: booking.id,
    code: booking.simplybookId,
    schoolName: booking.schoolName || booking.schoolContactName || 'Unknown School',
    contactPerson: booking.schoolContactName || '',
    contactEmail: booking.schoolContactEmail || '',
    phone: booking.schoolPhone,
    address: booking.schoolAddress,
    postalCode: booking.schoolPostalCode,
    region: booking.region,
    numberOfChildren: booking.estimatedChildren || 0,
    costCategory: booking.schoolSizeCategory || '<150 children',
    bookingDate: booking.startDate || '',
    status: booking.simplybookStatus,
    startTime: booking.startTime,
    endTime: booking.endTime,
    eventName: 'MiniMusiker Day',
  };
}

/**
 * GET /api/admin/bookings
 * Fetch future bookings from Airtable
 * Query params: status (optional filter)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') as 'confirmed' | 'pending' | 'cancelled' | null;

    // Fetch future bookings from Airtable
    const airtableService = getAirtableService();
    const airtableBookings = await airtableService.getFutureBookings();

    // Transform to API format and fetch/create Events with access codes
    const bookingsWithAccessCodes: BookingWithDetails[] = await Promise.all(
      airtableBookings.map(async (booking) => {
        const baseBooking = transformToBookingWithDetails(booking);

        // Fetch the linked Event to get access_code
        try {
          let event = await airtableService.getEventBySchoolBookingId(booking.id);

          // If no Event exists, create one
          if (!event) {
            const schoolName = booking.schoolName || booking.schoolContactName || 'Unknown School';
            const eventDate = booking.startDate || new Date().toISOString().split('T')[0];
            const eventId = generateEventId(schoolName, 'minimusiker', eventDate);

            console.log(`Creating Event for booking ${booking.id} (${schoolName})`);
            event = await airtableService.createEventFromBooking(
              eventId,
              booking.id,
              schoolName,
              eventDate
            );
          }

          if (event?.access_code) {
            return {
              ...baseBooking,
              accessCode: event.access_code,
              shortUrl: `minimusiker.app/e/${event.access_code}`,
            };
          }
        } catch (error) {
          console.warn(`Failed to fetch/create Event for booking ${booking.id}:`, error);
        }

        return baseBooking;
      })
    );

    // Apply status filter if provided
    let bookings = bookingsWithAccessCodes;
    if (statusFilter) {
      bookings = bookings.filter((b) => b.status === statusFilter);
    }

    // Calculate stats from all bookings (before filter)
    const stats = {
      total: bookingsWithAccessCodes.length,
      confirmed: bookingsWithAccessCodes.filter((b) => b.status === 'confirmed').length,
      pending: bookingsWithAccessCodes.filter((b) => b.status === 'pending').length,
      cancelled: bookingsWithAccessCodes.filter((b) => b.status === 'cancelled').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        bookings,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching bookings from Airtable:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch bookings',
      },
      { status: 500 }
    );
  }
}
