import { NextRequest, NextResponse } from 'next/server';
import { getStandardClothingBatchService } from '@/lib/services/standardClothingBatchService';
import { getTaskService } from '@/lib/services/taskService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/standard-clothing-batches/[batchTaskId]/orders
 * Get individual orders for a standard clothing batch
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchTaskId: string }> }
) {
  try {
    const { batchTaskId } = await params;

    if (!batchTaskId) {
      return NextResponse.json(
        { success: false, error: 'Batch task ID is required' },
        { status: 400 }
      );
    }

    // Get the task to read order_ids
    const taskService = getTaskService();
    const task = await taskService.getTaskById(batchTaskId);

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Batch task not found' },
        { status: 404 }
      );
    }

    if (!task.order_ids) {
      return NextResponse.json({
        success: true,
        data: { orders: [] },
      });
    }

    const orderIds = task.order_ids.split(',').map((id) => id.trim()).filter(Boolean);

    const service = getStandardClothingBatchService();
    const orders = await service.getOrdersForBatch(orderIds);

    return NextResponse.json({
      success: true,
      data: { orders },
    });
  } catch (error) {
    console.error('Error fetching orders for standard batch:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
