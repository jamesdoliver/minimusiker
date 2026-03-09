import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { EINRICHTUNGEN_TABLE_ID, EINRICHTUNGEN_FIELD_IDS } from '@/lib/types/airtable';
import Airtable from 'airtable';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/schulsong/[id]/create-event
 * Creates a SchoolBooking + Event for a Schulsong (forward flow).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const schulsongId = params.id;
    const body = await request.json();
    const aufnahmetagDatum = body.aufnahmetagDatum;

    if (!aufnahmetagDatum) {
      return NextResponse.json(
        { success: false, error: 'aufnahmetagDatum is required' },
        { status: 400 }
      );
    }

    const airtableService = getAirtableService();

    // Fetch Schulsong
    const schulsong = await airtableService.getSchulsongById(schulsongId);
    if (!schulsong) {
      return NextResponse.json(
        { success: false, error: 'Schulsong not found' },
        { status: 404 }
      );
    }

    // Guard: if already linked to an Event
    if (schulsong.eventId) {
      return NextResponse.json(
        { success: false, error: 'Schulsong already has a linked Event' },
        { status: 409 }
      );
    }

    // Resolve Einrichtung name
    let schoolName = 'Unknown School';
    if (schulsong.einrichtungenId) {
      try {
        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);
        const records = await base(EINRICHTUNGEN_TABLE_ID)
          .select({
            filterByFormula: `RECORD_ID() = '${schulsong.einrichtungenId}'`,
            fields: [EINRICHTUNGEN_FIELD_IDS.customer_name],
            maxRecords: 1,
            returnFieldsByFieldId: true,
          })
          .firstPage();
        if (records.length > 0) {
          schoolName = (records[0].fields[EINRICHTUNGEN_FIELD_IDS.customer_name] as string) || schoolName;
        }
      } catch (err) {
        console.warn('Could not resolve Einrichtung name:', err);
      }
    }

    // Update the Schulsong's aufnahmetagDatum and status
    await airtableService.updateSchulsong(schulsongId, {
      aufnahmetagDatum,
      statusBooking: 'Buchung mit RD',
    });

    // Create the Event chain
    const result = await airtableService.createEventFromSchulsong(
      schulsongId,
      schoolName,
      schulsong.einrichtungenId || '',
      aufnahmetagDatum
    );

    return NextResponse.json({
      success: true,
      eventCode: result.event.event_id,
      bookingCode: result.bookingCode,
    });
  } catch (error) {
    console.error('Error creating event from schulsong:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create event' },
      { status: 500 }
    );
  }
}
