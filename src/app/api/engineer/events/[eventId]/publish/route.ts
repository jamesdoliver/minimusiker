import { NextRequest, NextResponse } from 'next/server';
import { verifyEngineerSession } from '@/lib/auth/verifyEngineerSession';
import { getAirtableService } from '@/lib/services/airtableService';

/**
 * GET /api/engineer/events/[eventId]/publish
 * Get the current publish status for an event
 *
 * Response: { success: true, published: boolean }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyEngineerSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);

    // Verify engineer is assigned to this event
    const isAssigned = await getAirtableService().isEngineerAssignedToEvent(
      session.engineerId,
      eventId
    );

    if (!isAssigned) {
      return NextResponse.json(
        { error: 'You are not assigned to this event' },
        { status: 403 }
      );
    }

    const published = await getAirtableService().getEventPublishStatus(eventId);

    return NextResponse.json({
      success: true,
      published,
    });
  } catch (error) {
    console.error('Error getting publish status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get publish status',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/engineer/events/[eventId]/publish
 * Set the publish status for an event
 *
 * Request body: { published: boolean }
 * Response: { success: true, published: boolean }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyEngineerSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const { published } = await request.json();

    if (typeof published !== 'boolean') {
      return NextResponse.json(
        { error: 'published must be a boolean' },
        { status: 400 }
      );
    }

    // Verify engineer is assigned to this event
    const isAssigned = await getAirtableService().isEngineerAssignedToEvent(
      session.engineerId,
      eventId
    );

    if (!isAssigned) {
      return NextResponse.json(
        { error: 'You are not assigned to this event' },
        { status: 403 }
      );
    }

    await getAirtableService().setEventPublishStatus(eventId, published);

    return NextResponse.json({
      success: true,
      published,
      message: published
        ? 'Audio preview is now visible to parents'
        : 'Audio preview is now hidden from parents',
    });
  } catch (error) {
    console.error('Error setting publish status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set publish status',
      },
      { status: 500 }
    );
  }
}
