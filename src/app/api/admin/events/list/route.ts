/**
 * Admin Events List API
 *
 * @route GET /api/admin/events/list
 *
 * Returns events within a reasonable date window for the Send Now modal.
 */

import { NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const airtable = getAirtableService();
    const events = await airtable.getAllEvents();

    const now = new Date();
    const pastCutoff = new Date(now);
    pastCutoff.setDate(pastCutoff.getDate() - 60);
    const futureCutoff = new Date(now);
    futureCutoff.setDate(futureCutoff.getDate() + 40);

    const filtered = events
      .filter((event) => {
        if (!event.event_date) return false;
        if (event.status !== 'Confirmed') return false;
        const d = new Date(event.event_date);
        return d >= pastCutoff && d <= futureCutoff;
      })
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
      .map((event) => ({
        eventId: event.event_id,
        eventRecordId: event.id,
        schoolName: event.school_name,
        eventDate: event.event_date,
        eventType: event.is_kita ? 'KiTa' : 'Schule',
      }));

    return NextResponse.json({ success: true, data: filtered });
  } catch (error) {
    console.error('Error fetching events list:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}
