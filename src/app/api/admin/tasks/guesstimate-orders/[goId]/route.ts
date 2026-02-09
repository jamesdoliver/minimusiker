import { NextRequest, NextResponse } from 'next/server';
import { getTaskService } from '@/lib/services/taskService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/guesstimate-orders/[goId]
 * Get a single guesstimate order by ID
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ goId: string }> }
) {
  try {
    const { goId } = await params;

    const taskService = getTaskService();
    const orders = await taskService.getGuesstimateOrders();
    const order = orders.find((o) => o.id === goId);

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Guesstimate order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Error fetching guesstimate order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch guesstimate order' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/tasks/guesstimate-orders/[goId]
 * Mark a guesstimate order as arrived (sets date_completed to today)
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ goId: string }> }
) {
  try {
    const { goId } = await params;

    const taskService = getTaskService();
    const updatedOrder = await taskService.markGuesstimateOrderArrived(goId);

    return NextResponse.json({
      success: true,
      data: updatedOrder,
    });
  } catch (error) {
    console.error('Error marking guesstimate order as arrived:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to mark order as arrived' },
      { status: 500 }
    );
  }
}
