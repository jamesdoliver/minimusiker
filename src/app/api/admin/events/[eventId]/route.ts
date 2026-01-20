import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTaskService } from '@/lib/services/taskService';
import { getActivityService, ActivityService } from '@/lib/services/activityService';
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

/**
 * PATCH /api/admin/events/[eventId]
 * Update event details (currently supports event_date)
 */
export async function PATCH(
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
    const body = await request.json();

    // Validate request body
    if (!body.event_date) {
      return NextResponse.json(
        { success: false, error: 'event_date is required' },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(body.event_date)) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format. Expected YYYY-MM-DD' },
        { status: 400 }
      );
    }

    const airtableService = getAirtableService();

    // First, we need to get the Airtable record ID for this event
    // The eventId might be a simplybookId, event_id, or Airtable record ID
    let eventRecordId: string | null = null;

    // Try to find the event by event_id first
    const eventsByEventId = await airtableService.getEventsRecordIdByBookingId(eventId);
    if (eventsByEventId) {
      eventRecordId = eventsByEventId;
    }

    // If not found, try by simplybookId via SchoolBookings
    if (!eventRecordId && /^\d+$/.test(eventId)) {
      const booking = await airtableService.getSchoolBookingBySimplybookId(eventId);
      if (booking) {
        const eventRecord = await airtableService.getEventBySchoolBookingId(booking.id);
        if (eventRecord) {
          eventRecordId = eventRecord.id;
        }
      }
    }

    if (!eventRecordId) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Get old date for activity logging
    const existingEvent = await airtableService.getEventById(eventRecordId);
    const oldDate = existingEvent?.event_date || 'Unknown';

    // Update the event date
    const result = await airtableService.updateEventDate(eventRecordId, body.event_date);

    // Log activity (fire-and-forget)
    getActivityService().logActivity({
      eventRecordId,
      activityType: 'date_changed',
      description: ActivityService.generateDescription('date_changed', {
        oldDate,
        newDate: body.event_date,
      }),
      actorEmail: admin.email,
      actorType: 'admin',
      metadata: { oldDate, newDate: body.event_date },
    });

    // Recalculate task deadlines for pending tasks
    let tasksRecalculated = 0;
    if (body.recalculate_tasks !== false) {
      // Default to recalculating unless explicitly disabled
      try {
        const taskService = getTaskService();
        const taskResult = await taskService.recalculateDeadlinesForEvent(
          eventRecordId,
          body.event_date
        );
        tasksRecalculated = taskResult.updatedCount;
      } catch (taskError) {
        console.error('Warning: Could not recalculate task deadlines:', taskError);
        // Don't fail the request - the main update succeeded
      }
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      bookingUpdated: result.bookingUpdated,
      tasksRecalculated,
    });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update event',
      },
      { status: 500 }
    );
  }
}
