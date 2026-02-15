import { NextRequest, NextResponse } from 'next/server';
import { getTaskService } from '@/lib/services/taskService';
import { CreateGuesstimateOrderInput } from '@/lib/types/tasks';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/guesstimate-orders
 * Get all guesstimate orders, optionally filtered by event
 *
 * Query params:
 * - eventId: string (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const [, authError] = requireAdmin(request);
    if (authError) return authError;

    const searchParams = request.nextUrl.searchParams;
    const eventId = searchParams.get('eventId') || undefined;
    const status = searchParams.get('status') || undefined;

    const taskService = getTaskService();

    // If status=pending, return enriched GO-IDs for incoming orders view
    if (status === 'pending') {
      const enrichedOrders = await taskService.getGuesstimateOrdersEnriched({ pendingOnly: true });
      return NextResponse.json({
        success: true,
        data: enrichedOrders,
      });
    }

    const orders = await taskService.getGuesstimateOrders(eventId);

    return NextResponse.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error('Error fetching guesstimate orders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch guesstimate orders' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/tasks/guesstimate-orders
 * Create a new guesstimate order
 *
 * Body: CreateGuesstimateOrderInput
 */
export async function POST(request: NextRequest) {
  try {
    const [, authError] = requireAdmin(request);
    if (authError) return authError;

    const body: CreateGuesstimateOrderInput = await request.json();

    if (!body.event_id) {
      return NextResponse.json(
        { success: false, error: 'event_id is required' },
        { status: 400 }
      );
    }

    const taskService = getTaskService();
    const order = await taskService.createGuesstimateOrder(body);

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Error creating guesstimate order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create guesstimate order' },
      { status: 500 }
    );
  }
}
