// src/app/api/admin/tasks/minicard-orders/route.ts

import { NextResponse } from 'next/server';
import { getMinicardOrdersService } from '@/lib/services/minicardOrdersService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/minicard-orders
 * Get all pending minicard order events
 */
export async function GET() {
  try {
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
