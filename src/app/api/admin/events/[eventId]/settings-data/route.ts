/**
 * GET /api/admin/events/[eventId]/settings-data
 * Returns timeline_overrides JSON for the Event Settings page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  const admin = verifyAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const eventId = decodeURIComponent(params.eventId);
  const airtableService = getAirtableService();

  // Resolve Event record
  let eventRecordId = await airtableService.getEventsRecordIdByBookingId(eventId);

  if (!eventRecordId) {
    const booking = await airtableService.getSchoolBookingBySimplybookId(eventId);
    if (booking) {
      const eventRecord = await airtableService.getEventBySchoolBookingId(booking.id);
      if (eventRecord) {
        eventRecordId = eventRecord.id;
      }
    }
  }

  if (!eventRecordId) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const event = await airtableService.getEventById(eventRecordId);
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  return NextResponse.json({
    timeline_overrides: event.timeline_overrides || null,
    is_schulsong: event.is_schulsong ?? false,
    is_plus: event.is_plus ?? false,
    is_minimusikertag: event.is_minimusikertag ?? false,
  });
}
