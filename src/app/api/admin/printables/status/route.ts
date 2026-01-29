/**
 * Printables Status API
 *
 * GET /api/admin/printables/status?eventId=xxx
 *
 * Returns the status of all printables for an event:
 * - 'confirmed' - PDF has been generated
 * - 'skipped' - Admin chose to skip this item
 * - 'pending' - Not yet processed
 *
 * Note: The status is returned with PrintableItemType keys (tshirt, hoodie)
 * even though R2 stores them with PrintableType keys (tshirt-print, hoodie-print)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getR2Service, PrintableType } from '@/lib/services/r2Service';
import { generateEventId } from '@/lib/utils/eventIdentifiers';
import { PrintableItemType } from '@/lib/config/printableTextConfig';

// Map from R2 PrintableType to UI PrintableItemType
const r2TypeToItemType: Partial<Record<PrintableType, PrintableItemType>> = {
  'tshirt-print': 'tshirt',
  'hoodie-print': 'hoodie',
};

// Convert R2 status to UI status format
function convertStatus(
  r2Status: Record<PrintableType, 'confirmed' | 'skipped' | 'pending'>
): Record<PrintableItemType, 'confirmed' | 'skipped' | 'pending'> {
  const result: Partial<Record<PrintableItemType, 'confirmed' | 'skipped' | 'pending'>> = {};

  for (const [r2Type, status] of Object.entries(r2Status)) {
    // Check if this type needs mapping
    const mappedType = r2TypeToItemType[r2Type as PrintableType];
    if (mappedType) {
      result[mappedType] = status;
    } else {
      // Types like flyer1, button, etc. are the same in both systems
      result[r2Type as PrintableItemType] = status;
    }
  }

  return result as Record<PrintableItemType, 'confirmed' | 'skipped' | 'pending'>;
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin session
    const session = await verifyAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get eventId from query params
    const searchParams = request.nextUrl.searchParams;
    const passedEventId = searchParams.get('eventId');
    const schoolName = searchParams.get('schoolName');
    const eventDate = searchParams.get('eventDate');

    if (!passedEventId) {
      return NextResponse.json(
        { error: 'Missing required parameter: eventId' },
        { status: 400 }
      );
    }

    // Determine the actual event_id
    // If passedEventId looks like a SimplyBook ID (numeric), we need schoolName and eventDate
    let eventId = passedEventId;
    if (/^\d+$/.test(passedEventId)) {
      if (!schoolName || !eventDate) {
        // For numeric IDs, we need additional info to generate the proper event_id
        // If not provided, just use the numeric ID as-is (may not find status)
        console.warn('[printables/status] Numeric eventId provided without schoolName/eventDate');
      } else {
        eventId = generateEventId(schoolName, 'MiniMusiker', eventDate);
      }
    }

    // Get R2 service and fetch status
    const r2Service = getR2Service();
    const r2Status = await r2Service.getPrintablesStatus(eventId);

    // Convert from R2 types to UI types
    const status = convertStatus(r2Status);

    return NextResponse.json({
      eventId,
      status,
    });

  } catch (error) {
    console.error('Error fetching printables status:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch printables status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
