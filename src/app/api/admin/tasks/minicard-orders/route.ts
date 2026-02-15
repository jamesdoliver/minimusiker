// src/app/api/admin/tasks/minicard-orders/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getMinicardOrdersService } from '@/lib/services/minicardOrdersService';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/minicard-orders
 * Get all pending minicard order events
 */
export async function GET(request: NextRequest) {
  try {
    const [, authError] = requireAdmin(request);
    if (authError) return authError;

    const minicardOrdersService = getMinicardOrdersService();
    const events = await minicardOrdersService.getPendingMinicardOrders();

    return NextResponse.json({
      success: true,
      data: { events },
    });
  } catch (error) {
    console.error('Error fetching minicard orders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch minicard orders' },
      { status: 500 }
    );
  }
}
