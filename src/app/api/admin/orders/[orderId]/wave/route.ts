import { NextRequest, NextResponse } from 'next/server';
import { getOrderWaveService } from '@/lib/services/orderWaveService';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';
import type { ShipmentWave } from '@/lib/types/tasks';

export const dynamic = 'force-dynamic';

const VALID_WAVES: ShipmentWave[] = ['Welle 1', 'Welle 2', 'Both', 'Rolling'];

/**
 * PATCH /api/admin/orders/[orderId]/wave
 * Override the shipment wave for a specific order.
 *
 * Body: { "shipment_wave": "Welle 1" | "Welle 2" | "Both" | "Rolling" }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const [, authError] = requireAdmin(request);
    if (authError) return authError;

    const { orderId } = await params;
    const body = await request.json();
    const { shipment_wave } = body;

    if (!shipment_wave || !VALID_WAVES.includes(shipment_wave)) {
      return NextResponse.json(
        { success: false, error: `Invalid shipment_wave value. Must be one of: ${VALID_WAVES.join(', ')}` },
        { status: 400 }
      );
    }

    const orderWaveService = getOrderWaveService();
    await orderWaveService.overrideWave(orderId, shipment_wave as ShipmentWave);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error overriding shipment wave:', error);
    const message = error instanceof Error ? error.message : 'Failed to override shipment wave';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
