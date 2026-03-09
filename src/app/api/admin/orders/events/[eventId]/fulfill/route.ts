import { NextRequest, NextResponse } from 'next/server';
import { getFulfillmentService } from '@/lib/services/fulfillmentService';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';

export const dynamic = 'force-dynamic';

const VALID_WELLEN = ['Welle 1', 'Welle 2'] as const;
type Welle = typeof VALID_WELLEN[number];

/**
 * POST /api/admin/orders/events/[eventId]/fulfill
 * Triggers Shopify fulfillment orchestration for a wave.
 *
 * Body: { "welle": "Welle 1" | "Welle 2" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const [, authError] = requireAdmin(request);
    if (authError) return authError;

    const { eventId } = await params;
    const body = await request.json();
    const { welle } = body;

    if (!welle || !VALID_WELLEN.includes(welle)) {
      return NextResponse.json(
        { success: false, error: `Invalid welle value. Must be one of: ${VALID_WELLEN.join(', ')}` },
        { status: 400 }
      );
    }

    const fulfillmentService = getFulfillmentService();
    const summary = await fulfillmentService.fulfillWelle(eventId, welle as Welle);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error fulfilling wave:', error);
    const message = error instanceof Error ? error.message : 'Failed to fulfill wave';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
