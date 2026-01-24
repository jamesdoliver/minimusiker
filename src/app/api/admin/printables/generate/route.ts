/**
 * Printables Generation API
 *
 * POST /api/admin/printables/generate
 *
 * Generates all printables (flyers, buttons, t-shirts, hoodies, minicards, CD jackets)
 * for an event, using custom text/QR positions from the editor.
 *
 * Phase 4: Accepts multiple text elements with individual styling.
 * All positions are in CSS pixels and converted to PDF coordinates using canvasScale.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getPrintableService, PrintableItemConfig, TextElementConfig } from '@/lib/services/printableService';
import { getAirtableService } from '@/lib/services/airtableService';
import { getR2Service } from '@/lib/services/r2Service';
import { generateEventId } from '@/lib/utils/eventIdentifiers';
import {
  PrintableItemType,
  TextElement,
  getPrintableConfig,
  cssToPdfPosition,
  cssToPdfSize,
  hexToRgb,
  getFontFamilyForType,
} from '@/lib/config/printableTextConfig';

// Request body type - Phase 4 with multiple text elements
interface GeneratePrintablesRequest {
  eventId: string;        // Could be SimplyBook ID or actual event_id
  schoolName: string;
  eventDate: string;
  accessCode?: number;    // Optional - auto-fetched if not provided
  items: {
    type: PrintableItemType;
    textElements: TextElement[];  // Array of text elements
    qrPosition?: {
      x: number;     // CSS pixels
      y: number;     // CSS pixels
      size: number;  // CSS pixels
    };
    canvasScale?: number;  // Scale factor for CSS to PDF conversion
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
    const { eventId: passedEventId, schoolName, eventDate, items } = body;
    let { accessCode } = body;

    // Validate required fields
    if (!passedEventId || !schoolName || !eventDate) {
      return NextResponse.json(
        { error: 'Missing required fields: eventId, schoolName, eventDate' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: items array' },
        { status: 400 }
      );
    }

    // Get services
    const printableService = getPrintableService();
    const airtableService = getAirtableService();
    const r2Service = getR2Service();

    // Pre-flight health check - verify templates and fonts are available
    const healthCheck = await r2Service.checkAssetsHealth();
    if (!healthCheck.healthy) {
      console.error('[printables/generate] Health check failed:', healthCheck.errors);

      // Check what's specifically missing
      const missingTemplates = healthCheck.templatesMissing;
      const missingFonts = healthCheck.fontsMissing;

      return NextResponse.json({
        success: false,
        partialSuccess: false,
        error: 'Pre-flight check failed: missing required assets',
        healthCheck: {
          bucketAccessible: healthCheck.bucketAccessible,
          missingTemplates,
          missingFonts,
        },
        errors: healthCheck.errors,
      }, { status: 400 });
    }

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

    // Convert items to PrintableItemConfig format for the service
    // Transform CSS coordinates to PDF coordinates
    const itemConfigs: PrintableItemConfig[] = items.map(item => {
      const printableConfig = getPrintableConfig(item.type);
      const pdfHeight = printableConfig?.pdfDimensions.height || 1000;
      const scale = item.canvasScale || 1;

      // Convert text elements from CSS to PDF coordinates
      const textElementConfigs: TextElementConfig[] = item.textElements.map(element => {
        // Convert position (CSS top-left origin → PDF bottom-left origin)
        const pdfPosition = cssToPdfPosition(
          element.position.x,
          element.position.y + element.size.height, // Adjust for text box height
          pdfHeight,
          scale
        );

        // Convert size
        const pdfSize = cssToPdfSize(element.size.width, element.size.height, scale);

        // Convert color from hex to RGB
        const color = hexToRgb(element.color);

        return {
          id: element.id,
          type: element.type,
          text: element.text,
          x: pdfPosition.x,
          y: pdfPosition.y,
          width: pdfSize.width,
          height: pdfSize.height,
          fontSize: element.fontSize / scale, // Convert CSS px to PDF points
          color,
        };
      });

      // Convert QR position from CSS to PDF coordinates
      let qrPositionPdf: { x: number; y: number; size: number } | undefined;
      if (item.qrPosition) {
        const pdfQrPos = cssToPdfPosition(
          item.qrPosition.x,
          item.qrPosition.y + item.qrPosition.size, // Adjust for QR height
          pdfHeight,
          scale
        );
        qrPositionPdf = {
          x: pdfQrPos.x,
          y: pdfQrPos.y,
          size: item.qrPosition.size / scale,
        };
      }

      return {
        type: item.type,
        textElements: textElementConfigs,
        qrPosition: qrPositionPdf,
      };
    });

    // Generate all printables with custom positions
    const result = await printableService.generateAllPrintablesWithConfigs(
      eventId,
      schoolName,
      eventDate,
      itemConfigs,
      logoBuffer,
      qrCodeUrl
    );

    // Categorize results
    const succeeded = result.results.filter(r => r.success);
    const failed = result.results.filter(r => !r.success);
    const skipped: { type: string; reason: string }[] = [];

    // Check for skipped back items (no QR code)
    if (!qrCodeUrl) {
      const backTypes = ['flyer1-back', 'flyer2-back', 'flyer3-back'];
      for (const failedItem of failed) {
        if (backTypes.includes(failedItem.type) && failedItem.error?.includes('No QR code')) {
          skipped.push({ type: failedItem.type, reason: 'No QR code available' });
        }
      }
    }

    // Determine success status
    const anySucceeded = succeeded.length > 0;
    const allSucceeded = failed.length === 0;
    const partialSuccess = anySucceeded && !allSucceeded;

    // Log generation status
    console.log(`[printables/generate] Generated ${succeeded.length}/${result.results.length} printables for event ${eventId}`);

    // Create audio folder structure after successful printable uploads
    let audioFolderCreated = false;
    if (anySucceeded) {
      const folderResult = await r2Service.createAudioFolderStructure(eventId);
      audioFolderCreated = folderResult.success;
      if (!folderResult.success) {
        console.warn(`[printables/generate] Failed to create audio folder: ${folderResult.error}`);
      }
    }

    // Return improved response structure
    return NextResponse.json({
      success: anySucceeded,
      partialSuccess,
      eventId,
      accessCode: accessCode || null,
      qrCodeIncluded: !!qrCodeUrl,
      audioFolderCreated,
      results: {
        succeeded: succeeded.map(r => ({
          type: r.type,
          key: r.key,
        })),
        failed: failed.filter(f => !skipped.some(s => s.type === f.type)).map(r => ({
          type: r.type,
          error: r.error || 'Unknown error',
        })),
        skipped,
      },
      errors: result.errors,
    });

  } catch (error) {
    console.error('Error generating printables:', error);
    return NextResponse.json(
      {
        success: false,
        partialSuccess: false,
        error: 'Failed to generate printables',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
