import { NextRequest, NextResponse } from 'next/server';
import airtableService from '@/lib/services/airtableService';

/**
 * GET /api/airtable/event-details
 *
 * Fetches event and class details for registration validation
 * Query params: eventId (booking_id), classId
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const classId = searchParams.get('classId');

    if (!eventId || !classId) {
      return NextResponse.json(
        {
          success: false,
          error: 'event ID and classID are required',
        },
        { status: 400 }
      );
    }

    const eventDetails = await airtableService.getEventAndClassDetails(eventId, classId);

    if (!eventDetails) {
      return NextResponse.json(
        {
          success: false,
          error: 'Event or class not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: eventDetails,
    });
  } catch (error) {
    console.error('Error fetching event details:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch event details',
      },
      { status: 500 }
    );
  }
}
