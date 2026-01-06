import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';
import { SchoolEventDetail } from '@/lib/types/airtable';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getTeacherService } from '@/lib/services/teacherService';

export async function GET(
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

    // First try to get event detail from parent_journey_table (has class data)
    let eventDetail = await getAirtableService().getSchoolEventDetail(eventId);

    // If no class data exists, try to get basic info from SchoolBookings table
    if (!eventDetail) {
      const booking = await getAirtableService().getSchoolBookingBySimplybookId(eventId);

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

    // Enhance classes with songs data
    if (eventDetail.classes && eventDetail.classes.length > 0) {
      const teacherService = getTeacherService();
      const allSongs = await teacherService.getSongsByEventId(eventId);

      // Group songs by classId
      const songsByClass = allSongs.reduce((acc, song) => {
        if (!acc[song.classId]) {
          acc[song.classId] = [];
        }
        acc[song.classId].push(song);
        return acc;
      }, {} as Record<string, typeof allSongs>);

      // Add songs to each class
      eventDetail = {
        ...eventDetail,
        classes: eventDetail.classes.map((cls) => ({
          ...cls,
          songs: songsByClass[cls.classId] || [],
        })),
      };
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
