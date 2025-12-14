import { NextRequest, NextResponse } from 'next/server';
import airtableService from '@/lib/services/airtableService';

/**
 * GET /api/airtable/school-events
 * Get events and classes for a specific school
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolName = searchParams.get('school');
    const bookingId = searchParams.get('bookingId');

    // If bookingId provided, get classes for that event
    if (bookingId) {
      const classes = await airtableService.getEventClasses(bookingId);
      return NextResponse.json({
        success: true,
        data: { classes },
      });
    }

    // If schoolName provided, get events for that school
    if (schoolName) {
      const events = await airtableService.getSchoolEvents(schoolName);
      return NextResponse.json({
        success: true,
        data: { events },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Missing required parameter: school or bookingId',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error fetching school events:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch school events',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
