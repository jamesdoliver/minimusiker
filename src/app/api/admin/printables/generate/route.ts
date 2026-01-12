/**
 * Printables Generation API
 *
 * POST /api/admin/printables/generate
 *
 * Generates all printables (flyers, posters, etc.) for an event,
 * optionally including QR codes for easy parent registration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getPrintableService } from '@/lib/services/printableService';
import { getAirtableService } from '@/lib/services/airtableService';

// Request body type
interface GeneratePrintablesRequest {
  eventId: string;
  schoolName: string;
  eventDate: string;
  accessCode?: number;  // For QR code generation
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
    const { eventId, schoolName, eventDate, accessCode } = body;

    // Validate required fields
    if (!eventId || !schoolName || !eventDate) {
      return NextResponse.json(
        { error: 'Missing required fields: eventId, schoolName, eventDate' },
        { status: 400 }
      );
    }

    // Get services
    const printableService = getPrintableService();
    const airtableService = getAirtableService();

    // Logo fetching - currently not implemented
    // TODO: Add einrichtung lookup via SchoolBooking when logo embedding is needed for minicard/cd-jacket
    const logoBuffer: Buffer | undefined = undefined;

    // Generate QR code URL if access_code is provided
    const qrCodeUrl = accessCode
      ? `https://minimusiker.app/e/${accessCode}`
      : undefined;

    // Generate all printables
    const result = await printableService.generateAllPrintables(
      eventId,
      schoolName,
      eventDate,
      logoBuffer,
      qrCodeUrl
    );

    // Update event record to mark printables as generated
    try {
      const event = await airtableService.getEventByEventId(eventId);
      if (event) {
        // Note: Would need to add an updateEvent method to update printables_generated flag
        console.log(`Printables generated for event ${eventId}`);
      }
    } catch (error) {
      console.warn('Could not update event record:', error);
    }

    // Return results
    return NextResponse.json({
      success: result.success,
      eventId: result.eventId,
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
