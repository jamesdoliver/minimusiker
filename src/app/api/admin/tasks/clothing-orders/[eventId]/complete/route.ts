// src/app/api/admin/tasks/clothing-orders/[eventId]/complete/route.ts

import { NextRequest } from 'next/server';
import { getClothingOrdersService } from '@/lib/services/clothingOrdersService';
import { CompleteClothingOrderRequest } from '@/lib/types/clothingOrders';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';
import { apiOk, apiError } from '@/lib/api/response';

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
    const [admin, authError] = requireAdmin(request);
    if (authError) return authError;

    const { eventId } = await params;

    if (!eventId) {
      return apiError('Event ID is required', 400);
    }

    const body: CompleteClothingOrderRequest = await request.json();

    if (typeof body.amount !== 'number' || body.amount < 0) {
      return apiError('Valid amount is required', 400);
    }

    if (!Array.isArray(body.order_ids) || body.order_ids.length === 0) {
      return apiError('Order IDs are required', 400);
    }

    const adminEmail = admin.email;

    const clothingOrdersService = getClothingOrdersService();
    const result = await clothingOrdersService.completeClothingOrder(
      eventId,
      body.amount,
      body.notes,
      body.order_ids,
      adminEmail
    );

    return apiOk({
      task_id: result.taskId,
      go_id: result.goId,
    });
  } catch (error) {
    console.error('Error completing clothing order:', error);
    return apiError('Failed to complete clothing order', 500);
  }
}
