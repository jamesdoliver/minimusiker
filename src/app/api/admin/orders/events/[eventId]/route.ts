import { NextRequest } from 'next/server';
import { getOrderWaveService } from '@/lib/services/orderWaveService';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';
import { apiOk, apiError } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/orders/events/[eventId]
 * Returns detailed orders for a specific event, split by wave.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const [, authError] = requireAdmin(request);
    if (authError) return authError;

    const { eventId } = await params;
    const orderWaveService = getOrderWaveService();
    const eventSummary = await orderWaveService.getEventOrders(eventId);

    return apiOk(eventSummary);
  } catch (error) {
    console.error('Error fetching event orders:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch event orders';
    const status = message.includes('not found') ? 404 : 500;
    return apiError(message, status);
  }
}
