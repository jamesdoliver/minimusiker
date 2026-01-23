import { NextRequest, NextResponse } from 'next/server';
import { getR2Service } from '@/lib/services/r2Service';

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

    const r2Service = getR2Service();

    // Signed URLs expire in 1 hour
    const expiresIn = 3600;

    // Fetch signed URLs for both printable types
    const [tshirtUrl, hoodieUrl] = await Promise.all([
      r2Service.getPrintableUrl(eventId, 'tshirt-print', expiresIn),
      r2Service.getPrintableUrl(eventId, 'hoodie-print', expiresIn),
    ]);

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
