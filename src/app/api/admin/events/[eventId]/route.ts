import { NextRequest, NextResponse } from 'next/server';
import airtableService from '@/lib/services/airtableService';
import { SchoolEventDetail } from '@/lib/types/airtable';

export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const eventId = decodeURIComponent(params.eventId);

    // First try to get event detail from parent_journey_table (has class data)
    let eventDetail = await airtableService.getSchoolEventDetail(eventId);

    // If no class data exists, try to get basic info from SchoolBookings table
    if (!eventDetail) {
      const booking = await airtableService.getSchoolBookingBySimplybookId(eventId);

      if (booking) {
        // Create a minimal event detail from booking data
        // SchoolBooking uses different field names than the booking display
        eventDetail = {
          eventId: booking.simplybookId,
          schoolName: booking.schoolContactName || 'Unknown School',
          eventDate: booking.startDate || '',
          eventType: 'MiniMusiker Day',
          mainTeacher: booking.schoolContactName || '',
          classCount: 0,
          totalChildren: booking.estimatedChildren || 0,
          totalParents: 0,
          classes: [],
          overallRegistrationRate: 0,
          // Include assigned staff from SchoolBookings table
          assignedStaffId: booking.assignedStaff?.[0],
          // Include booking info for display
          bookingInfo: {
            contactEmail: booking.schoolContactEmail,
            contactPhone: booking.schoolPhone,
            address: booking.schoolAddress,
            postalCode: booking.schoolPostalCode,
            region: booking.region,
            startTime: booking.startTime,
            endTime: booking.endTime,
            status: booking.simplybookStatus,
            costCategory: booking.schoolSizeCategory,
          },
        } as SchoolEventDetail & { bookingInfo?: Record<string, unknown> };
      }
    }

    if (!eventDetail) {
      return NextResponse.json(
        {
          success: false,
          error: 'Event not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: eventDetail,
    });
  } catch (error) {
    console.error('Error fetching event detail:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch event details',
      },
      { status: 500 }
    );
  }
}
