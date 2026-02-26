/**
 * Printables Preview API
 *
 * POST /api/admin/printables/preview
 *
 * Generates a single printable item preview and returns a signed URL for download.
 * Used by the printables editor to let admins preview their work before confirming.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getPrintableService } from '@/lib/services/printableService';
import { getAirtableService } from '@/lib/services/airtableService';
import { getR2Service } from '@/lib/services/r2Service';
import { generateEventId } from '@/lib/utils/eventIdentifiers';
import {
  PrintableItemType,
  TextElement,
} from '@/lib/config/printableTextConfig';
import { convertItemToPdfConfig } from '@/lib/config/printableShared';

export const dynamic = 'force-dynamic';

// Request body type for preview generation
interface PreviewRequest {
  eventId: string;        // Could be SimplyBook ID or actual event_id
  schoolName: string;
  eventDate: string;
  accessCode?: number;    // Optional - auto-fetched if not provided
  item: {
    type: PrintableItemType;
    textElements: TextElement[];
    qrPosition?: {
      x: number;
      y: number;
      size: number;
    };
    canvasScale?: number;
  };
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
    const body: PreviewRequest = await request.json();
    const { eventId: passedEventId, schoolName, eventDate, item } = body;
    let { accessCode } = body;

    // Validate required fields
    if (!passedEventId || !schoolName || !eventDate) {
      return NextResponse.json(
        { error: 'Missing required fields: eventId, schoolName, eventDate' },
        { status: 400 }
      );
    }

    if (!item || !item.type) {
      return NextResponse.json(
        { error: 'Missing required field: item with type' },
        { status: 400 }
      );
    }

    // Get services
    const printableService = getPrintableService();
    const airtableService = getAirtableService();
    const r2Service = getR2Service();

    // Determine the actual event_id
    let eventId = passedEventId;
    if (/^\d+$/.test(passedEventId)) {
      eventId = generateEventId(schoolName, 'MiniMusiker', eventDate);
    }

    // Auto-fetch access_code from Event if not provided
    if (!accessCode) {
      try {
        const event = await airtableService.getEventByEventId(eventId);
        if (event?.access_code) {
          accessCode = event.access_code;
        }
      } catch (error) {
        console.warn('[printables/preview] Could not fetch Event for access_code:', error);
      }
    }

    // Generate QR code URL if access_code is available
    const qrCodeUrl = accessCode
      ? `https://minimusiker.app/e/${accessCode}`
      : undefined;

    // Convert item from CSS editor coordinates to PDF coordinates
    const itemConfig = convertItemToPdfConfig({
      type: item.type,
      textElements: item.textElements,
      qrPosition: item.qrPosition,
      canvasScale: item.canvasScale,
    });

    // Generate single printable using the service
    const result = await printableService.generateSinglePrintablePreview(
      eventId,
      schoolName,
      eventDate,
      itemConfig,
      undefined, // logoBuffer - not used for previews
      qrCodeUrl
    );

    if (!result.success || !result.pdfBuffer) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate preview' },
        { status: 500 }
      );
    }

    // Upload to R2 with a preview prefix (temporary storage)
    const timestamp = Date.now();
    const previewKey = `previews/${eventId}/${item.type}_${timestamp}.pdf`;

    // Retry upload with exponential backoff (3 attempts)
    const maxAttempts = 3;
    let uploadSuccess = false;
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const uploadResult = await r2Service.uploadToAssetsBucket(
        previewKey,
        result.pdfBuffer,
        'application/pdf'
      );

      if (uploadResult.success) {
        uploadSuccess = true;
        break;
      }

      lastError = uploadResult.error;
      console.warn(`[printables/preview] Upload attempt ${attempt}/${maxAttempts} failed:`, lastError);

      if (attempt < maxAttempts) {
        // Exponential backoff: 500ms, 1000ms
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
      }
    }

    if (!uploadSuccess) {
      return NextResponse.json(
        { error: 'Failed to upload preview after multiple attempts', details: lastError },
        { status: 500 }
      );
    }

    // Verify file exists in R2 before generating signed URL
    const fileExists = await r2Service.fileExistsInAssetsBucket(previewKey);
    if (!fileExists) {
      return NextResponse.json(
        { error: 'Preview file missing from R2 after upload' },
        { status: 500 }
      );
    }

    // Generate signed URL for download (expires in 5 minutes)
    // Signed URL expires in 1 hour (admin may revisit the tab)
    const signedUrl = await r2Service.generateSignedUrlForAssetsBucket(previewKey, 3600);

    return NextResponse.json({
      success: true,
      url: signedUrl,
      type: item.type,
    });

  } catch (error) {
    console.error('Error generating preview:', error);
    return NextResponse.json(
      { error: 'Failed to generate preview', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
