import { NextRequest, NextResponse } from 'next/server';
import { getR2Service } from '@/lib/services/r2Service';
import { getAirtableService } from '@/lib/services/airtableService';
import { generateEventId } from '@/lib/utils/eventIdentifiers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/printables/clothing/[eventId]
 * Get signed URLs for T-Shirt and Hoodie printables for an event
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    console.log(`[printables/clothing] Looking for printables with eventId: ${eventId}`);

    const r2Service = getR2Service();
    const airtableService = getAirtableService();

    // Signed URLs expire in 1 hour
    const expiresIn = 3600;

    // First, try fetching with the provided eventId
    let [tshirtUrl, hoodieUrl] = await Promise.all([
      r2Service.getPrintableUrl(eventId, 'tshirt-print', expiresIn),
      r2Service.getPrintableUrl(eventId, 'hoodie-print', expiresIn),
    ]);

    console.log(`[printables/clothing] Direct lookup results - tshirt: ${!!tshirtUrl}, hoodie: ${!!hoodieUrl}`);

    // If no printables found, try regenerating the R2 event_id from event details
    if (!tshirtUrl && !hoodieUrl) {
      console.log(`[printables/clothing] No printables found with direct ID, attempting to regenerate R2 event_id`);

      const event = await airtableService.getEventByEventId(eventId);

      if (event && event.school_name && event.event_date) {
        // Regenerate event_id to match R2 storage format
        const r2EventId = generateEventId(event.school_name, 'MiniMusiker', event.event_date);
        console.log(`[printables/clothing] Regenerated R2 event_id: ${r2EventId} (from school: ${event.school_name}, date: ${event.event_date})`);

        // Try fetching with the regenerated ID
        if (r2EventId !== eventId) {
          [tshirtUrl, hoodieUrl] = await Promise.all([
            r2Service.getPrintableUrl(r2EventId, 'tshirt-print', expiresIn),
            r2Service.getPrintableUrl(r2EventId, 'hoodie-print', expiresIn),
          ]);
          console.log(`[printables/clothing] Regenerated ID lookup results - tshirt: ${!!tshirtUrl}, hoodie: ${!!hoodieUrl}`);
        }
      } else {
        console.log(`[printables/clothing] Could not fetch event details for eventId: ${eventId}`);
      }
    }

    // Build response - only include printables that exist
    const result: {
      tshirt?: { url: string; filename: string };
      hoodie?: { url: string; filename: string };
    } = {};

    if (tshirtUrl) {
      result.tshirt = {
        url: tshirtUrl,
        filename: `tshirt-print-${eventId}.pdf`,
      };
    }

    if (hoodieUrl) {
      result.hoodie = {
        url: hoodieUrl,
        filename: `hoodie-print-${eventId}.pdf`,
      };
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching clothing printables:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch printables' },
      { status: 500 }
    );
  }
}
