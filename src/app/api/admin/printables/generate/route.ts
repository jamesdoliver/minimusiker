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
import { getR2Service, PrintableType, TemplateType } from '@/lib/services/r2Service';
import { generateEventId } from '@/lib/utils/eventIdentifiers';
import {
  PrintableItemType,
  TextElement,
  getPrintableConfig,
  cssToPdfPosition,
  cssToPdfSize,
  hexToRgb,
  FontFamily,
} from '@/lib/config/printableTextConfig';

export const dynamic = 'force-dynamic';

// Item status type
type ItemStatus = 'pending' | 'confirmed' | 'skipped';

// Map UI PrintableItemType to R2 PrintableType
// Most types are the same, but tshirt/hoodie differ
function itemTypeToR2Type(itemType: PrintableItemType): PrintableType {
  const mapping: Partial<Record<PrintableItemType, PrintableType>> = {
    'tshirt': 'tshirt-print',
    'hoodie': 'hoodie-print',
  };
  return (mapping[itemType] || itemType) as PrintableType;
}

// Request body type - Phase 4 with multiple text elements
interface GeneratePrintablesRequest {
  eventId: string;        // Could be SimplyBook ID or actual event_id
  schoolName: string;
  eventDate: string;
  accessCode?: number;    // Optional - auto-fetched if not provided
  items: {
    type: PrintableItemType;
    status?: ItemStatus;  // Item status - 'skipped' items get placeholder instead of PDF
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

    // Pre-flight health check - only verify templates needed for the items being generated
    // This allows generating flyers even when button/minicard templates don't exist yet
    const confirmedTypes = items
      .filter(item => item.status !== 'skipped')
      .map(item => itemTypeToR2Type(item.type) as TemplateType);

    if (confirmedTypes.length > 0) {
      const healthCheck = await r2Service.checkAssetsForTypes(confirmedTypes);
      if (!healthCheck.healthy) {
        console.error('[printables/generate] Health check failed:', healthCheck.errors);

        return NextResponse.json({
          success: false,
          partialSuccess: false,
          error: 'Pre-flight check failed: missing required assets',
          healthCheck: {
            bucketAccessible: healthCheck.bucketAccessible,
            missingTemplates: healthCheck.templatesMissing,
            missingFonts: healthCheck.fontsMissing,
          },
          errors: healthCheck.errors,
        }, { status: 400 });
      }
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

    // Separate items into confirmed (to generate) and skipped (to create placeholder)
    const confirmedItems = items.filter(item => item.status !== 'skipped');
    const skippedItems = items.filter(item => item.status === 'skipped');

    // Convert confirmed items to PrintableItemConfig format for the service
    // Transform CSS coordinates to PDF coordinates
    const itemConfigs: PrintableItemConfig[] = confirmedItems.map(item => {
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
          fontFamily: element.fontFamily,  // Pass through element's font choice
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
        type: itemTypeToR2Type(item.type),
        textElements: textElementConfigs,
        qrPosition: qrPositionPdf,
      };
    });

    // Results tracking
    const succeeded: { type: string; key?: string }[] = [];
    const failed: { type: string; error?: string }[] = [];
    const skipped: { type: string; reason: string }[] = [];

    // Handle skipped items - upload placeholder files
    for (const item of skippedItems) {
      const r2Type = itemTypeToR2Type(item.type);
      const result = await r2Service.uploadSkippedPlaceholder(eventId, r2Type);
      if (result.success) {
        skipped.push({ type: item.type, reason: 'User skipped' });
      } else {
        // If we can't upload the placeholder, treat it as a failure
        failed.push({ type: item.type, error: result.error || 'Failed to create skip placeholder' });
      }
    }

    // Generate confirmed items
    if (itemConfigs.length > 0) {
      const result = await printableService.generateAllPrintablesWithConfigs(
        eventId,
        schoolName,
        eventDate,
        itemConfigs,
        logoBuffer,
        qrCodeUrl
      );

      // Process generation results
      for (const r of result.results) {
        if (r.success) {
          succeeded.push({ type: r.type, key: r.key });
          // If this item was previously skipped, delete the placeholder
          await r2Service.deleteSkippedPlaceholder(eventId, r.type as PrintableType);
        } else {
          // Check if this is a back item that failed due to no QR code
          const backTypes = ['flyer1-back', 'flyer2-back', 'flyer3-back'];
          if (!qrCodeUrl && backTypes.includes(r.type) && r.error?.includes('No QR code')) {
            skipped.push({ type: r.type, reason: 'No QR code available' });
          } else {
            failed.push({ type: r.type, error: r.error || 'Unknown error' });
          }
        }
      }
    }

    // Determine success status
    const anySucceeded = succeeded.length > 0 || skipped.length > 0;
    const allSucceeded = failed.length === 0;
    const partialSuccess = anySucceeded && !allSucceeded;

    // Log generation status
    console.log(`[printables/generate] Generated ${succeeded.length} PDFs, skipped ${skipped.length}, failed ${failed.length} for event ${eventId}`);

    // Always create audio folder structure when generation runs
    let audioFolderCreated = false;
    const folderResult = await r2Service.createAudioFolderStructure(eventId);
    audioFolderCreated = folderResult.success;
    if (!folderResult.success) {
      console.warn(`[printables/generate] Failed to create audio folder: ${folderResult.error}`);
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
        failed: failed.map(r => ({
          type: r.type,
          error: r.error || 'Unknown error',
        })),
        skipped,
      },
      errors: [],
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
