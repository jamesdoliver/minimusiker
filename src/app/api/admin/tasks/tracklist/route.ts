import { NextRequest, NextResponse } from 'next/server';
import { getMasterCdService } from '@/lib/services/masterCdService';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/tracklist?eventId=recXXX
 * Returns Master CD tracklist data resolved via event record ID.
 * Works for both real and virtual task cells.
 */
export async function GET(request: NextRequest) {
  try {
    const [, authError] = requireAdmin(request);
    if (authError) return authError;

    const eventRecordId = request.nextUrl.searchParams.get('eventId');
    if (!eventRecordId) {
      return NextResponse.json(
        { success: false, error: 'eventId query parameter is required' },
        { status: 400 }
      );
    }

    const airtable = getAirtableService();
    const event = await airtable.getEventById(eventRecordId);
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    const masterCdService = getMasterCdService();
    const data = await masterCdService.getTracklist(event.event_id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching tracklist by eventId:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tracklist' },
      { status: 500 }
    );
  }
}
