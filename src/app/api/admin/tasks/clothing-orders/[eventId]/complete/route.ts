// src/app/api/admin/tasks/clothing-orders/[eventId]/complete/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getClothingOrdersService } from '@/lib/services/clothingOrdersService';
import { CompleteClothingOrderRequest } from '@/lib/types/clothingOrders';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/tasks/clothing-orders/[eventId]/complete
 * Mark a clothing order as complete
 */
export async function POST(
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

    const body: CompleteClothingOrderRequest = await request.json();

    if (typeof body.amount !== 'number' || body.amount < 0) {
      return NextResponse.json(
        { success: false, error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.order_ids) || body.order_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Order IDs are required' },
        { status: 400 }
      );
    }

    // TODO: Get admin email from session
    const adminEmail = 'admin@minimusiker.de';

    const clothingOrdersService = getClothingOrdersService();
    const result = await clothingOrdersService.completeClothingOrder(
      eventId,
      body.amount,
      body.notes,
      body.order_ids,
      adminEmail
    );

    return NextResponse.json({
      success: true,
      data: {
        task_id: result.taskId,
        go_id: result.goId,
        shipping_task_id: result.shippingTaskId,
      },
    });
  } catch (error) {
    console.error('Error completing clothing order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to complete clothing order' },
      { status: 500 }
    );
  }
}
