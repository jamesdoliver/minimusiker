import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { EVENTS_TABLE_ID, EVENTS_FIELD_IDS } from '@/lib/types/airtable';
import { parseOverrides } from '@/lib/utils/eventThresholds';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/events/[eventId]/toggle-audio-visibility
 * Toggle audio_hidden in timeline_overrides.
 * Body: { hidden: boolean }
 *
 * When hidden=true, parents lose access to all Minimusikertag audio.
 * When hidden=false, audio visibility reverts to the normal time-based release.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { hidden } = await request.json();
    if (typeof hidden !== 'boolean') {
      return NextResponse.json(
        { error: 'hidden must be a boolean' },
        { status: 400 }
      );
    }

    const eventId = decodeURIComponent(params.eventId);
    const airtableService = getAirtableService();

    // Resolve SimplyBook ID → real event_id (handles both formats)
    const eventDetail = await airtableService.getSchoolEventDetail(eventId);
    if (!eventDetail) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    const resolvedEventId = eventDetail.eventId;

    // Get the current event to read existing timeline_overrides
    const event = await airtableService.getEventByEventId(resolvedEventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Parse existing overrides and merge audio_hidden
    const existingOverrides = parseOverrides(event.timeline_overrides) || {};
    const { audio_hidden: _, ...rest } = existingOverrides;
    // When hiding, set audio_hidden=true; when unhiding, omit the key to keep JSON clean
    const updatedOverrides = hidden ? { ...rest, audio_hidden: true } : rest;

    // Write back
    const base = airtableService['base'];
    const recordId = await airtableService.getEventsRecordIdByBookingId(resolvedEventId);
    if (!recordId) {
      return NextResponse.json({ error: 'Event record not found' }, { status: 404 });
    }

    const hasOverrides = Object.keys(updatedOverrides).length > 0;
    await base(EVENTS_TABLE_ID).update(recordId, {
      [EVENTS_FIELD_IDS.timeline_overrides]: hasOverrides ? JSON.stringify(updatedOverrides) : '',
    });

    return NextResponse.json({
      success: true,
      audioHidden: hidden,
    });
  } catch (error) {
    console.error('Error toggling audio visibility:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to toggle audio visibility' },
      { status: 500 }
    );
  }
}
