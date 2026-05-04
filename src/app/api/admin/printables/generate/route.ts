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
import { getPrintableService } from '@/lib/services/printableService';
import { getAirtableService } from '@/lib/services/airtableService';
import { getR2Service, PrintableType, TemplateType } from '@/lib/services/r2Service';
import { generateEventId } from '@/lib/utils/eventIdentifiers';
import {
  PrintableItemType,
  TextElement,
} from '@/lib/config/printableTextConfig';
import {
  ItemStatus,
  itemTypeToR2Type,
  convertItemToPdfConfig,
  convertFormModeItemToPdfConfig,
  partialBasenameFor,
} from '@/lib/config/printableShared';
import { hasFormMode, getFieldRegistry } from '@/lib/config/printableFieldRegistry';
import { bookingToResolverInput } from '@/lib/config/printableFieldResolver';
import { getMasterCdService, type MasterCdTrack } from '@/lib/services/masterCdService';
import type { FormModeItemState } from '@/lib/config/formModeState';

export const dynamic = 'force-dynamic';

// Request body type - Phase 4 with multiple text elements; form-mode items
// (Phase 0+) send `formModeState` instead of textElements/qrPosition/canvasScale.
interface GeneratePrintablesRequest {
  eventId: string;        // Could be SimplyBook ID or actual event_id
  schoolName: string;
  eventDate: string;
  accessCode?: number;    // Optional - auto-fetched if not provided
  isKita?: boolean;       // Sent by modal so the resolver can pick Schule/KiTa variants
  items: {
    type: PrintableItemType;
    status?: ItemStatus;  // Item status - 'skipped' items get placeholder instead of PDF
    // Legacy free-positioning editor:
    textElements?: TextElement[];  // Array of text elements
    qrPosition?: {
      x: number;     // CSS pixels
      y: number;     // CSS pixels
      size: number;  // CSS pixels
    };
    canvasScale?: number;  // Scale factor for CSS to PDF conversion
    // Form-mode (Phase 0+):
    formModeState?: FormModeItemState;
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
    const { eventId: passedEventId, schoolName, eventDate, items, isKita } = body;
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

    // Pre-flight: verify the right template files exist for each requested item.
    // - Form-mode items (flyer1, flyer1-back, minicard, cd-jacket, …) read from
    //   `templates/<basename>-partial-template.pdf`.
    // - Legacy items (button, mocks) read from `templates/<type>-template.pdf`.
    // Any other check would either over-reject (legacy filename for a migrated
    // item that only ever ships its partial PDF) or under-reject (passing
    // pre-flight then dying inside the generator). Clothing items (tshirt-print,
    // hoodie-print) skip the check — the generator falls back to a blank A3.
    const preflightItems = items.filter(item => item.status !== 'skipped');
    if (preflightItems.length > 0) {
      const optionalTypes = new Set(['tshirt', 'hoodie']);
      const partialChecked = new Map<string, boolean>(); // basename → exists; dedupes front+back
      const templatesFound: string[] = [];
      const templatesMissing: string[] = [];
      const errors: string[] = [];

      for (const item of preflightItems) {
        if (optionalTypes.has(item.type)) continue; // clothing prints fall back to blank A3
        const useFormMode = hasFormMode(item.type);
        let exists: boolean;
        let filename: string;

        if (useFormMode) {
          const basename = partialBasenameFor(item.type);
          filename = `${basename}-partial-template.pdf`;
          const cached = partialChecked.get(filename);
          if (cached !== undefined) {
            exists = cached;
          } else {
            exists = await r2Service.fileExistsInAssetsBucket(`templates/${filename}`);
            partialChecked.set(filename, exists);
          }
        } else {
          // Legacy types (button, mocks). Reuse the r2 helper for bucket-level
          // accessibility + filename mapping.
          const r2Type = itemTypeToR2Type(item.type) as TemplateType;
          const hc = await r2Service.checkAssetsForTypes([r2Type]);
          exists = hc.templatesFound.includes(r2Type);
          filename = `${r2Type}-template.pdf`;
        }

        if (exists) {
          templatesFound.push(item.type);
        } else {
          templatesMissing.push(item.type);
          errors.push(`Missing template: ${item.type} (looked for ${filename})`);
        }
      }

      // Always check fonts.
      const fontsHealth = await r2Service.checkAssetsForTypes([]); // empty list, only checks fonts
      const fontsMissing = fontsHealth.fontsMissing;
      if (fontsMissing.length > 0) {
        errors.push(...fontsMissing.map(f => `Missing font: ${f}`));
      }

      if (errors.length > 0) {
        console.error('[printables/generate] Pre-flight failed:', errors);
        return NextResponse.json({
          success: false,
          partialSuccess: false,
          error: 'Pre-flight check failed: missing required assets',
          healthCheck: {
            bucketAccessible: true,
            missingTemplates: templatesMissing,
            missingFonts: fontsMissing,
          },
          errors,
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

    // Determine if any confirmed item references the `songList` computed
    // source. If so, fetch the tracklist once and refuse to generate when it
    // isn't fully ready — partial tracklists would silently yield blank
    // entries on the PDF.
    let tracklist: MasterCdTrack[] | null = null;
    const itemsThatNeedTracklist = confirmedItems.filter(item => {
      if (!hasFormMode(item.type)) return false;
      const fields = getFieldRegistry(item.type);
      return fields?.some(f => f.source.type === 'computed' && f.source.name === 'songList') ?? false;
    });

    if (itemsThatNeedTracklist.length > 0) {
      const tracklistData = await getMasterCdService().getTracklist(eventId);
      if (!tracklistData.allReady) {
        return NextResponse.json({
          success: false,
          partialSuccess: false,
          error: `Tracklist is not yet ready (${tracklistData.readyCount}/${tracklistData.totalCount} tracks confirmed). Teacher must confirm all songs first.`,
        }, { status: 400 });
      }
      tracklist = tracklistData.tracks;
    }

    // Convert confirmed items from CSS editor coordinates to PDF coordinates.
    // Migrated items dispatch to the form-mode converter (yields a
    // `<type>-partial` config that printableService recognises); legacy items
    // continue through convertItemToPdfConfig.
    const itemConfigs = confirmedItems.map(item => {
      if (hasFormMode(item.type)) {
        const fields = getFieldRegistry(item.type);
        if (!fields) {
          // Tautological today (hasFormMode returns getFieldRegistry !== null), but
          // kept as a contract assertion in case the two helpers ever diverge.
          throw new Error(
            `Form-mode item ${item.type} has no field registry`,
          );
        }
        return convertFormModeItemToPdfConfig({
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
          // Phase 0 sends global defaults only; Airtable timeline overrides
          // come in a later phase.
        });
      }
      return convertItemToPdfConfig({
        type: item.type,
        textElements: item.textElements ?? [],
        qrPosition: item.qrPosition,
        canvasScale: item.canvasScale,
      });
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
    const anyGenerated = succeeded.length > 0;
    const allSkipped = succeeded.length === 0 && failed.length === 0 && skipped.length > 0;
    const allSucceeded = anyGenerated && failed.length === 0;
    const partialSuccess = anyGenerated && failed.length > 0;

    // Log generation status
    console.log(`[printables/generate] Generated ${succeeded.length} PDFs, skipped ${skipped.length}, failed ${failed.length} for event ${eventId}`);

    // Always create audio folder structure when generation runs
    let audioFolderCreated = false;
    const folderResult = await r2Service.createAudioFolderStructure(eventId);
    audioFolderCreated = folderResult.success;
    if (!folderResult.success) {
      console.warn(`[printables/generate] Failed to create audio folder: ${folderResult.error}`);
    }

    // Sign download URLs for succeeded items so the client can offer
    // direct download without an extra round-trip per item. URLs are valid
    // for 1 hour; the client treats them as ephemeral.
    const succeededWithUrls = await Promise.all(
      succeeded.map(async (r) => {
        let url: string | undefined;
        if (r.key) {
          try {
            const filename = `${eventId}-${r.type}.pdf`;
            url = await r2Service.generateSignedUrl(r.key, 3600, filename);
          } catch (err) {
            console.warn(`[printables/generate] Failed to sign URL for ${r.type}:`, err);
          }
        }
        return { type: r.type, key: r.key, url };
      })
    );

    // Return improved response structure
    return NextResponse.json({
      success: allSucceeded || allSkipped,
      partialSuccess,
      allSkipped,
      eventId,
      accessCode: accessCode || null,
      qrCodeIncluded: !!qrCodeUrl,
      audioFolderCreated,
      results: {
        succeeded: succeededWithUrls,
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
