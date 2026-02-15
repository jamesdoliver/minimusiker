// src/app/api/admin/tasks/clothing-orders/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getClothingOrdersService } from '@/lib/services/clothingOrdersService';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/clothing-orders
 * Get all pending clothing order events within visibility window
 */
export async function GET(request: NextRequest) {
  try {
    const [, authError] = requireAdmin(request);
    if (authError) return authError;

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
