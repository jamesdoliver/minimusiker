import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';
import {
  SCHUL_CLOTHING_ORDERS_TABLE_ID,
  SCHUL_CLOTHING_ORDERS_FIELD_IDS,
  SchulClothingOrder,
} from '@/lib/types/airtable';

export const dynamic = 'force-dynamic';

function transformRecord(record: any): SchulClothingOrder {
  return {
    id: record.id,
    order_id: record.get('order_id') as number | undefined,
    event_id: record.get('event_id') as string[] | undefined,
    size_98_104: (record.get('size_98_104') as number) || 0,
    size_110_116: (record.get('size_110_116') as number) || 0,
    size_122_128: (record.get('size_122_128') as number) || 0,
    size_134_146: (record.get('size_134_146') as number) || 0,
    size_152_164: (record.get('size_152_164') as number) || 0,
    total_quantity: record.get('total_quantity') as number | undefined,
    last_updated_by: record.get('last_updated_by') as string | undefined,
    last_updated_at: record.get('last_updated_at') as string | undefined,
    notes: record.get('notes') as string | undefined,
  };
}

/**
 * GET /api/admin/events/[eventId]/clothing-order
 * Fetch the clothing order for this event (or return empty defaults)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const airtableService = getAirtableService();

    // Resolve Airtable record ID for the event
    const eventRecordId = await airtableService.getEventsRecordIdByBookingId(eventId);
    if (!eventRecordId) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Find existing clothing order for this event
    const base = airtableService['base'];
    const records = await base(SCHUL_CLOTHING_ORDERS_TABLE_ID)
      .select({
        filterByFormula: `SEARCH('${eventRecordId}', ARRAYJOIN({${SCHUL_CLOTHING_ORDERS_FIELD_IDS.event_id}}))`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return NextResponse.json({
        success: true,
        data: null, // No order yet
      });
    }

    return NextResponse.json({
      success: true,
      data: transformRecord(records[0]),
    });
  } catch (error) {
    console.error('Error fetching clothing order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clothing order' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/events/[eventId]/clothing-order
 * Create or update the clothing order (upsert — one order per event)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const body = await request.json();
    const airtableService = getAirtableService();

    // Resolve event record ID
    const eventRecordId = await airtableService.getEventsRecordIdByBookingId(eventId);
    if (!eventRecordId) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const sizes = {
      [SCHUL_CLOTHING_ORDERS_FIELD_IDS.size_98_104]: body.size_98_104 ?? 0,
      [SCHUL_CLOTHING_ORDERS_FIELD_IDS.size_110_116]: body.size_110_116 ?? 0,
      [SCHUL_CLOTHING_ORDERS_FIELD_IDS.size_122_128]: body.size_122_128 ?? 0,
      [SCHUL_CLOTHING_ORDERS_FIELD_IDS.size_134_146]: body.size_134_146 ?? 0,
      [SCHUL_CLOTHING_ORDERS_FIELD_IDS.size_152_164]: body.size_152_164 ?? 0,
      [SCHUL_CLOTHING_ORDERS_FIELD_IDS.last_updated_by]: admin.email,
      [SCHUL_CLOTHING_ORDERS_FIELD_IDS.notes]: body.notes ?? '',
    };

    const base = airtableService['base'];

    // Check for existing record
    const existing = await base(SCHUL_CLOTHING_ORDERS_TABLE_ID)
      .select({
        filterByFormula: `SEARCH('${eventRecordId}', ARRAYJOIN({${SCHUL_CLOTHING_ORDERS_FIELD_IDS.event_id}}))`,
        maxRecords: 1,
      })
      .firstPage();

    let record;
    if (existing.length > 0) {
      // Update existing
      record = await base(SCHUL_CLOTHING_ORDERS_TABLE_ID).update(existing[0].id, sizes);
    } else {
      // Create new
      record = await base(SCHUL_CLOTHING_ORDERS_TABLE_ID).create({
        [SCHUL_CLOTHING_ORDERS_FIELD_IDS.event_id]: [eventRecordId],
        ...sizes,
      });
    }

    return NextResponse.json({
      success: true,
      data: transformRecord(record),
    });
  } catch (error) {
    console.error('Error saving clothing order:', error);
    return NextResponse.json(
      { error: 'Failed to save clothing order' },
      { status: 500 }
    );
  }
}
