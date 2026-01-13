import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';

/**
 * GET /api/airtable/school-events
 *
 * Query params:
 * - bookingId: Get classes for a specific event (used by ClassSelectionStep and QR flow)
 * - school: Get events for a school (used by EventSelectionStep)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const bookingId = searchParams.get('bookingId');
  const schoolName = searchParams.get('school');

  const airtableService = getAirtableService();

  try {
    // Case 1: Get classes for a specific event
    if (bookingId) {
      // Get event info
      const event = await airtableService.getEventByEventId(bookingId);

      if (!event) {
        return NextResponse.json(
          { success: false, error: 'Event not found' },
          { status: 404 }
        );
      }

      // Get classes for this event
      const classes = await airtableService.getEventClasses(bookingId);

      return NextResponse.json({
        success: true,
        data: {
          classes,
          schoolName: event.school_name,
          eventDate: event.event_date,
          eventType: event.event_type,
        },
      });
    }

    // Case 2: Get events for a school
    if (schoolName) {
      // Get all events for this school
      const allEvents = await airtableService.getSchoolEventSummaries();

      // Filter by school name (case-insensitive)
      const schoolEvents = allEvents.filter(
        (event) => event.schoolName.toLowerCase() === schoolName.toLowerCase()
      );

      // Transform to expected format
      const events = await Promise.all(
        schoolEvents.map(async (event) => {
          const classes = await airtableService.getEventClasses(event.bookingId);
          return {
            bookingId: event.bookingId,
            eventType: event.eventType,
            eventDate: event.eventDate,
            classCount: classes.length,
          };
        })
      );

      return NextResponse.json({
        success: true,
        data: { events },
      });
    }

    // No valid parameters provided
    return NextResponse.json(
      { success: false, error: 'Missing required parameter: bookingId or school' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in school-events API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
