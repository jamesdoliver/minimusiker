import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService, AlbumTrackUpdate } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/teacher/events/[eventId]/album-order/finalize
 * Finalize the tracklist — saves current order and locks it permanently.
 * Server-side guard: event date must be today or in the past.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyTeacherSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const teacherService = getTeacherService();

    // Verify teacher has access and get event details
    const event = await teacherService.getTeacherEventDetail(eventId, session.email);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Check if already finalized
    if (event.tracklistFinalizedAt) {
      return NextResponse.json(
        { error: 'Tracklist already finalized' },
        { status: 400 }
      );
    }

    // Server-side guard: event date must be today or past
    const eventDate = new Date(event.eventDate);
    const now = new Date();
    const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (eventDateOnly > nowDateOnly) {
      return NextResponse.json(
        { error: 'Cannot finalize before event day' },
        { status: 400 }
      );
    }

    // Parse optional tracks from body (save order before finalizing)
    const body = await request.json().catch(() => ({}));
    const { tracks } = body as { tracks?: AlbumTrackUpdate[] };

    if (tracks && Array.isArray(tracks) && tracks.length > 0) {
      await teacherService.updateAlbumOrder(eventId, session.email, tracks);
    }

    // Look up the Event Airtable record to get its record ID
    const airtableService = getAirtableService();
    const eventRecord = await airtableService.getEventByEventId(eventId);
    if (!eventRecord) {
      return NextResponse.json(
        { error: 'Event record not found in database' },
        { status: 404 }
      );
    }

    // Set tracklist_finalized_at on the Event record
    const finalizedAt = new Date().toISOString();
    await airtableService.updateEventFields(eventRecord.id, {
      tracklist_finalized_at: finalizedAt,
    });

    return NextResponse.json({
      success: true,
      finalizedAt,
    });
  } catch (error) {
    console.error('Error finalizing tracklist:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to finalize tracklist',
      },
      { status: 500 }
    );
  }
}
