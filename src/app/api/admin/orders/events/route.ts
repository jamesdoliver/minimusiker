import { NextRequest, NextResponse } from 'next/server';
import { getOrderWaveService } from '@/lib/services/orderWaveService';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';

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

    return NextResponse.json({
      success: true,
      data: { events },
    });
  } catch (error) {
    console.error('Error fetching event wave summaries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch event wave summaries' },
      { status: 500 }
    );
  }
}
