// src/app/api/admin/tasks/clothing-orders/route.ts

import { NextResponse } from 'next/server';
import { getClothingOrdersService } from '@/lib/services/clothingOrdersService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/clothing-orders
 * Get all pending clothing order events within visibility window
 */
export async function GET() {
  try {
    const clothingOrdersService = getClothingOrdersService();
    const events = await clothingOrdersService.getPendingClothingOrders();

    return NextResponse.json({
      success: true,
      data: { events },
    });
  } catch (error) {
    console.error('Error fetching clothing orders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch clothing orders' },
      { status: 500 }
    );
  }
}
