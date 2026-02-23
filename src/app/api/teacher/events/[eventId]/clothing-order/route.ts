import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
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
 * GET /api/teacher/events/[eventId]/clothing-order
 * Fetch the clothing order for this event
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyTeacherSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const airtableService = getAirtableService();

    // Resolve event record and verify it's an SCS event with shirts
    const eventRecordId = await airtableService.getEventsRecordIdByBookingId(eventId);
    if (!eventRecordId) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = await airtableService.getEventById(eventRecordId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Only accessible for SCS events with shirts included
    if (event.deal_type !== 'mimu_scs' || event.deal_config?.scs_shirts_included === false) {
      return NextResponse.json(
        { error: 'Clothing order not available for this event' },
        { status: 403 }
      );
    }

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
        data: null,
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
 * PUT /api/teacher/events/[eventId]/clothing-order
 * Create or update the clothing order (teacher version)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyTeacherSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const body = await request.json();
    const airtableService = getAirtableService();

    const eventRecordId = await airtableService.getEventsRecordIdByBookingId(eventId);
    if (!eventRecordId) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const event = await airtableService.getEventById(eventRecordId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.deal_type !== 'mimu_scs' || event.deal_config?.scs_shirts_included === false) {
      return NextResponse.json(
        { error: 'Clothing order not available for this event' },
        { status: 403 }
      );
    }

    const sizes = {
      [SCHUL_CLOTHING_ORDERS_FIELD_IDS.size_98_104]: body.size_98_104 ?? 0,
      [SCHUL_CLOTHING_ORDERS_FIELD_IDS.size_110_116]: body.size_110_116 ?? 0,
      [SCHUL_CLOTHING_ORDERS_FIELD_IDS.size_122_128]: body.size_122_128 ?? 0,
      [SCHUL_CLOTHING_ORDERS_FIELD_IDS.size_134_146]: body.size_134_146 ?? 0,
      [SCHUL_CLOTHING_ORDERS_FIELD_IDS.size_152_164]: body.size_152_164 ?? 0,
      [SCHUL_CLOTHING_ORDERS_FIELD_IDS.last_updated_by]: session.email,
      [SCHUL_CLOTHING_ORDERS_FIELD_IDS.notes]: body.notes ?? '',
    };

    const base = airtableService['base'];

    const existing = await base(SCHUL_CLOTHING_ORDERS_TABLE_ID)
      .select({
        filterByFormula: `SEARCH('${eventRecordId}', ARRAYJOIN({${SCHUL_CLOTHING_ORDERS_FIELD_IDS.event_id}}))`,
        maxRecords: 1,
      })
      .firstPage();

    let record;
    if (existing.length > 0) {
      record = await base(SCHUL_CLOTHING_ORDERS_TABLE_ID).update(existing[0].id, sizes);
    } else {
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
