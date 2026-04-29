import { NextRequest } from 'next/server';
import { getOrderWaveService } from '@/lib/services/orderWaveService';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';
import { apiOk, apiError } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/orders/events
 * Returns all events with wave summaries for the Orders landing page.
 */
export async function GET(request: NextRequest) {
  try {
    const [, authError] = requireAdmin(request);
    if (authError) return authError;

    const orderWaveService = getOrderWaveService();
    const events = await orderWaveService.getEventWaveSummaries();

    return apiOk({ events });
  } catch (error) {
    console.error('Error fetching event wave summaries:', error);
    return apiError('Failed to fetch event wave summaries', 500);
  }
}
