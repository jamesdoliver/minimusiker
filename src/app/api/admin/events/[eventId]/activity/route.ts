import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getActivityService } from '@/lib/services/activityService';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/events/[eventId]/activity
 * Fetch activity timeline for an event
 */
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

    // Get pagination params from URL
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // We need the Airtable record ID to query activities
    // The eventId might be a simplybookId, event_id, or Airtable record ID
    let eventRecordId: string | null = null;

    const airtableService = getAirtableService();

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

    // If still not found, the eventId might already be an Airtable record ID
    if (!eventRecordId) {
      // Assume it's an Airtable record ID (starts with 'rec')
      if (eventId.startsWith('rec')) {
        eventRecordId = eventId;
      } else {
        return NextResponse.json(
          { success: false, error: 'Event not found' },
          { status: 404 }
        );
      }
    }

    // Fetch activities for this event
    const activityService = getActivityService();
    const { activities, hasMore } = await activityService.getActivitiesForEvent(
      eventRecordId,
      { limit, offset }
    );

    return NextResponse.json({
      success: true,
      data: {
        activities,
        hasMore,
        pagination: {
          limit,
          offset,
          nextOffset: hasMore ? offset + limit : null,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching event activities:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch activities',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/events/[eventId]/activity
 * Create a manual activity entry (phone_call or email_discussion)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const eventId = decodeURIComponent(params.eventId);
    const body = await request.json();

    const { activityType, description } = body;

    // Validate activity type
    if (!activityType || !['phone_call', 'email_discussion'].includes(activityType)) {
      return NextResponse.json(
        { success: false, error: 'activityType must be phone_call or email_discussion' },
        { status: 400 }
      );
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'description is required' },
        { status: 400 }
      );
    }

    // Resolve event record ID (same logic as GET)
    let eventRecordId: string | null = null;
    const airtableService = getAirtableService();

    const eventsByEventId = await airtableService.getEventsRecordIdByBookingId(eventId);
    if (eventsByEventId) {
      eventRecordId = eventsByEventId;
    }

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
      if (eventId.startsWith('rec')) {
        eventRecordId = eventId;
      } else {
        return NextResponse.json(
          { success: false, error: 'Event not found' },
          { status: 404 }
        );
      }
    }

    // Log the manual activity
    const activityService = getActivityService();
    await activityService.logActivity({
      eventRecordId,
      activityType,
      description: description.trim(),
      actorEmail: admin.email,
      actorType: 'admin',
      metadata: { manualEntry: true },
    });

    return NextResponse.json({
      success: true,
      message: `${activityType} entry created`,
    });
  } catch (error) {
    console.error('Error creating manual activity:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create activity',
      },
      { status: 500 }
    );
  }
}
