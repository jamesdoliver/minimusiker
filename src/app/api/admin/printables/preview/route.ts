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
import {
  convertItemToPdfConfig,
  convertFormModeItemToPdfConfig,
} from '@/lib/config/printableShared';
import { hasFormMode, getFieldRegistry } from '@/lib/config/printableFieldRegistry';
import { bookingToResolverInput } from '@/lib/config/printableFieldResolver';
import { getMasterCdService, type MasterCdTrack } from '@/lib/services/masterCdService';
import type { FormModeItemState } from '@/lib/config/formModeState';

export const dynamic = 'force-dynamic';

// Request body type for preview generation. Form-mode items (Phase 0+) send
// `formModeState` instead of textElements/qrPosition/canvasScale.
interface PreviewRequest {
  eventId: string;        // Could be SimplyBook ID or actual event_id
  schoolName: string;
  eventDate: string;
  accessCode?: number;    // Optional - auto-fetched if not provided
  isKita?: boolean;       // Sent by modal so the resolver can pick Schule/KiTa variants
  item: {
    type: PrintableItemType;
    // Legacy free-positioning editor:
    textElements?: TextElement[];
    qrPosition?: {
      x: number;
      y: number;
      size: number;
    };
    canvasScale?: number;
    // Form-mode (Phase 0+):
    formModeState?: FormModeItemState;
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
    const { eventId: passedEventId, schoolName, eventDate, item, isKita } = body;
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

    // Convert item from CSS editor coordinates to PDF coordinates. Migrated
    // items dispatch to the form-mode converter (which emits a
    // `<type>-partial` config that printableService recognises); legacy items
    // continue through convertItemToPdfConfig.
    let itemConfig;
    if (hasFormMode(item.type)) {
      const fields = getFieldRegistry(item.type);
      if (!fields) {
        // Tautological today (hasFormMode returns getFieldRegistry !== null), but
        // kept as a contract assertion in case the two helpers ever diverge.
        return NextResponse.json(
          { error: `Form-mode item ${item.type} has no field registry` },
          { status: 500 },
        );
      }

      // Fetch the tracklist if any field needs it; refuse preview when it
      // isn't fully ready so admins don't preview a half-empty PDF.
      let tracklist: MasterCdTrack[] | null = null;
      const needsTracklist = fields.some(
        f => f.source.type === 'computed' && f.source.name === 'songList',
      );
      if (needsTracklist) {
        const tracklistData = await getMasterCdService().getTracklist(eventId);
        if (!tracklistData.allReady) {
          return NextResponse.json({
            success: false,
            error: `Tracklist is not yet ready (${tracklistData.readyCount}/${tracklistData.totalCount} tracks confirmed).`,
          }, { status: 400 });
        }
        tracklist = tracklistData.tracks;
      }

      itemConfig = convertFormModeItemToPdfConfig({
        type: item.type,
        fields,
        state: item.formModeState ?? {},
        booking: bookingToResolverInput({
          schoolName,
          bookingDate: eventDate,
          accessCode,
          isKita,
        }),
        tracklist,
      });
    } else {
      itemConfig = convertItemToPdfConfig({
        type: item.type,
        textElements: item.textElements ?? [],
        qrPosition: item.qrPosition,
        canvasScale: item.canvasScale,
      });
    }

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

    // Clean up old previews for this event+type before uploading new one
    try {
      const oldPreviewPrefix = `previews/${eventId}/${item.type}_`;
      await r2Service.deleteByPrefix(oldPreviewPrefix);
    } catch (cleanupError) {
      // Non-fatal — log and continue with upload
      console.warn('[printables/preview] Failed to clean up old previews:', cleanupError);
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
