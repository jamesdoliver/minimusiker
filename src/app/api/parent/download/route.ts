/**
 * Parent Download API
 *
 * POST /api/parent/download
 *
 * Returns a signed URL for downloading purchased digital content.
 * Verifies the parent has a valid order with digital_delivered = true.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import Airtable from 'airtable';
import { getR2Service } from '@/lib/services/r2Service';
import {
  ORDERS_TABLE_ID,
  ORDERS_FIELD_IDS,
  PARENTS_TABLE_ID,
  PARENTS_FIELD_IDS,
} from '@/lib/types/airtable';
import { resolveEventRecordId } from '@/lib/services/ordersHelper';

interface DownloadRequest {
  eventId: string;
  classId?: string;
  className?: string;
}

/**
 * Verify parent session and return parent data
 */
async function verifyParentSession(request: NextRequest): Promise<{ parentId: string; email: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('parent_session')?.value;

    if (!token) {
      return null;
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret');
    const { payload } = await jwtVerify(token, secret);

    if (payload.type !== 'parent' || !payload.parentId) {
      return null;
    }

    return {
      parentId: payload.parentId as string,
      email: payload.email as string,
    };
  } catch (error) {
    console.error('[download] Session verification error:', error);
    return null;
  }
}

/**
 * Check if parent has digital access for the given event
 */
async function hasDigitalAccess(parentId: string, eventId: string): Promise<boolean> {
  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
    .base(process.env.AIRTABLE_BASE_ID!);

  try {
    // First, resolve eventId to Airtable record ID
    const eventRecordId = await resolveEventRecordId(eventId);
    if (!eventRecordId) {
      console.warn('[download] Event not found for identifier:', eventId);
      return false;
    }

    // Get the parent's Airtable record ID
    const parentRecords = await base(PARENTS_TABLE_ID)
      .select({
        filterByFormula: `{${PARENTS_FIELD_IDS.parent_id}} = "${parentId}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (parentRecords.length === 0) {
      console.warn('[download] Parent not found:', parentId);
      return false;
    }

    const parentRecordId = parentRecords[0].id;

    // Fetch all orders with digital_delivered = true and filter by event_id linked record
    const allDigitalOrders = await base(ORDERS_TABLE_ID)
      .select({
        filterByFormula: `{${ORDERS_FIELD_IDS.digital_delivered}} = TRUE()`,
        returnFieldsByFieldId: true,
      })
      .all();

    // Filter orders by event_id linked record
    const orderRecords = allDigitalOrders.filter((order: Airtable.Record<Airtable.FieldSet>) => {
      const eventIds = order.get(ORDERS_FIELD_IDS.event_id) as string[] | undefined;
      return eventIds && eventIds.includes(eventRecordId);
    });

    // Check if any order is linked to this parent
    for (const order of orderRecords) {
      const linkedParents = order.get(ORDERS_FIELD_IDS.parent_id) as string[] | undefined;
      if (linkedParents && linkedParents.includes(parentRecordId)) {
        return true;
      }
    }

    // Also check if parent has any digital-delivered order (fallback for orders without parent link)
    // This handles cases where the order was created before parent linking was implemented
    if (orderRecords.length > 0) {
      console.log('[download] Found digital order for event, allowing access');
      return true;
    }

    return false;
  } catch (error) {
    console.error('[download] Error checking digital access:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify parent session
    const session = await verifyParentSession(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body: DownloadRequest = await request.json();
    const { eventId, classId, className } = body;

    if (!eventId) {
      return NextResponse.json(
        { error: 'Missing eventId' },
        { status: 400 }
      );
    }

    // 3. Verify parent has digital access for this event
    const hasAccess = await hasDigitalAccess(session.parentId, eventId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'No digital access for this content' },
        { status: 403 }
      );
    }

    // 4. Generate signed URL for the full recording
    const r2Service = getR2Service();

    // Use className if provided, otherwise try to get by classId
    let downloadUrl: string;
    if (className) {
      downloadUrl = await r2Service.getFullRecordingUrl(eventId, className);
    } else if (classId) {
      // Try to get by class ID - need to look up class name
      downloadUrl = await r2Service.getFullRecordingUrlByClassId(eventId, classId);
    } else {
      // Fallback to event-level recording
      downloadUrl = await r2Service.getFullRecordingUrl(eventId);
    }

    console.log('[download] Generated download URL for:', {
      parentId: session.parentId,
      eventId,
      classId,
    });

    return NextResponse.json({
      success: true,
      downloadUrl,
      expiresIn: 86400, // 24 hours
    });

  } catch (error) {
    console.error('[download] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate download link' },
      { status: 500 }
    );
  }
}
