import { NextRequest, NextResponse } from 'next/server';
import airtableService from '@/lib/services/airtableService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'school'; // 'school' or 'class'

    if (view === 'class') {
      // Legacy behavior - return class-level data
      const events = await airtableService.getUniqueEvents();

      // Transform events to include class_id and format for frontend
      const formattedEvents = events.map((event) => ({
        ...event,
        // Include class_id in the response
        class_id: event.class_id,
        // Ensure all required fields are present
        event_id: event.booking_id, // booking_id serves as event_id
        school_id: event.school_name, // For backward compatibility
      }));

      return NextResponse.json({
        success: true,
        events: formattedEvents,
        data: formattedEvents, // Keep "data" for backward compatibility
      });
    }

    // Default: school-level summaries for the new card view
    const schoolEvents = await airtableService.getSchoolEventSummaries();

    return NextResponse.json({
      success: true,
      events: schoolEvents,
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch events',
        events: [], // Return empty array on error
      },
      { status: 500 }
    );
  }
}
