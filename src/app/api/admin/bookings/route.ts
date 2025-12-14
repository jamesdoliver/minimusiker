import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import airtableService from '@/lib/services/airtableService';
import { SchoolBooking } from '@/lib/types/airtable';

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
  status: 'confirmed' | 'pending' | 'cancelled';
  startTime?: string;
  endTime?: string;
  eventName?: string;
}

// Middleware to verify admin authentication
async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as Record<string, unknown>;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Transform SchoolBooking (Airtable) to BookingWithDetails (API response)
 */
function transformToBookingWithDetails(booking: SchoolBooking): BookingWithDetails {
  return {
    id: booking.id,
    code: booking.simplybookId,
    schoolName: booking.schoolContactName || 'Unknown School',
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
    // Skip authentication check for development
    const isDev = process.env.NODE_ENV === 'development';

    if (!isDev) {
      const admin = await verifyAdmin();
      if (!admin) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') as 'confirmed' | 'pending' | 'cancelled' | null;

    // Fetch future bookings from Airtable
    const airtableBookings = await airtableService.getFutureBookings();

    // Transform to API format
    let bookings: BookingWithDetails[] = airtableBookings.map(transformToBookingWithDetails);

    // Apply status filter if provided
    if (statusFilter) {
      bookings = bookings.filter((b) => b.status === statusFilter);
    }

    // Calculate stats from all bookings (before filter)
    const allBookings = airtableBookings.map(transformToBookingWithDetails);
    const stats = {
      total: allBookings.length,
      confirmed: allBookings.filter((b) => b.status === 'confirmed').length,
      pending: allBookings.filter((b) => b.status === 'pending').length,
      cancelled: allBookings.filter((b) => b.status === 'cancelled').length,
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
