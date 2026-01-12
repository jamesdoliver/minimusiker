/**
 * Printables Generation API
 *
 * POST /api/admin/printables/generate
 *
 * Generates all printables (flyers, posters, etc.) for an event,
 * automatically including QR codes for easy parent registration.
 *
 * The API automatically looks up the Event record to get the access_code
 * for QR code generation - no need to pass it from the frontend.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getPrintableService } from '@/lib/services/printableService';
import { getAirtableService } from '@/lib/services/airtableService';
import { generateEventId } from '@/lib/utils/eventIdentifiers';

// Request body type
interface GeneratePrintablesRequest {
  eventId: string;        // Could be SimplyBook ID or actual event_id
  schoolName: string;
  eventDate: string;
  accessCode?: number;    // Optional - auto-fetched if not provided
  items?: {
    type: string;
    line1?: string;
    line2?: string;
    line3?: string;
  }[];
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin session
    const session = await verifyAdminSession(request);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: GeneratePrintablesRequest = await request.json();
    const { eventId: passedEventId, schoolName, eventDate } = body;
    let { accessCode } = body;

    // Validate required fields
    if (!passedEventId || !schoolName || !eventDate) {
      return NextResponse.json(
        { error: 'Missing required fields: eventId, schoolName, eventDate' },
        { status: 400 }
      );
    }

    // Get services
    const printableService = getPrintableService();
    const airtableService = getAirtableService();

    // Determine the actual event_id
    // If passedEventId looks like a SimplyBook ID (numeric), generate the proper event_id
    let eventId = passedEventId;
    if (/^\d+$/.test(passedEventId)) {
      // This is likely a SimplyBook ID - generate the proper event_id
      eventId = generateEventId(schoolName, 'MiniMusiker', eventDate);
      console.log(`[printables/generate] Generated event_id: ${eventId} from SimplyBook ID: ${passedEventId}`);
    }

    // Auto-fetch access_code from Event if not provided
    if (!accessCode) {
      try {
        // Try to find the Event by event_id
        const event = await airtableService.getEventByEventId(eventId);
        if (event?.access_code) {
          accessCode = event.access_code;
          console.log(`[printables/generate] Found access_code: ${accessCode} for event: ${eventId}`);
        } else {
          console.warn(`[printables/generate] No access_code found for event: ${eventId}`);
        }
      } catch (error) {
        console.warn('[printables/generate] Could not fetch Event for access_code:', error);
      }
    }

    // Logo fetching - currently not implemented
    // TODO: Add einrichtung lookup via SchoolBooking when logo embedding is needed for minicard/cd-jacket
    const logoBuffer: Buffer | undefined = undefined;

    // Generate QR code URL if access_code is available
    const qrCodeUrl = accessCode
      ? `https://minimusiker.app/e/${accessCode}`
      : undefined;

    if (qrCodeUrl) {
      console.log(`[printables/generate] QR code URL: ${qrCodeUrl}`);
    } else {
      console.warn('[printables/generate] No access_code available - printables will be generated WITHOUT QR codes');
    }

    // Generate all printables
    const result = await printableService.generateAllPrintables(
      eventId,
      schoolName,
      eventDate,
      logoBuffer,
      qrCodeUrl
    );

    // Log generation status
    console.log(`[printables/generate] Generated ${result.results.filter(r => r.success).length}/${result.results.length} printables for event ${eventId}`);

    // Return results
    return NextResponse.json({
      success: result.success,
      eventId: result.eventId,
      accessCode: accessCode || null,
      qrCodeIncluded: !!qrCodeUrl,
      generated: result.results.filter(r => r.success).map(r => ({
        type: r.type,
        key: r.key,
      })),
      errors: result.errors,
    });

  } catch (error) {
    console.error('Error generating printables:', error);
    return NextResponse.json(
      { error: 'Failed to generate printables', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
