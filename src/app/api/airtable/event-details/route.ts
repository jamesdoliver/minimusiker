import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/airtable/event-details
 *
 * Fetches event and class details for parent registration.
 *
 * Query params:
 *   - eventId: The event/booking ID
 *   - classId: The class ID
 *
 * Returns:
 *   {
 *     success: boolean,
 *     data?: EventClassDetails,
 *     error?: string
 *   }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const classId = searchParams.get('classId');

    if (!eventId || !classId) {
      return NextResponse.json(
        { success: false, error: 'Missing eventId or classId parameter' },
        { status: 400 }
      );
    }

    const airtableService = getAirtableService();
    const details = await airtableService.getEventAndClassDetails(eventId, classId);

    if (!details) {
      return NextResponse.json(
        { success: false, error: 'Event or class not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: details,
    });
  } catch (error) {
    console.error('Error fetching event details:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch event details' },
      { status: 500 }
    );
  }
}
