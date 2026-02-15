import { NextRequest, NextResponse } from 'next/server';
import { getStandardClothingBatchService } from '@/lib/services/standardClothingBatchService';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/tasks/standard-clothing-batches/[batchTaskId]/complete
 * Complete a standard clothing batch
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ batchTaskId: string }> }
) {
  try {
    const [admin, authError] = requireAdmin(request);
    if (authError) return authError;

    const { batchTaskId } = await params;

    if (!batchTaskId) {
      return NextResponse.json(
        { success: false, error: 'Batch task ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { amount, notes } = body;

    if (typeof amount !== 'number' || amount < 0) {
      return NextResponse.json(
        { success: false, error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    // Get the batch data (re-aggregate from task)
    const service = getStandardClothingBatchService();
    const batches = await service.getPendingStandardBatches();
    const batch = batches.find((b) => b.task_id === batchTaskId);

    if (!batch) {
      return NextResponse.json(
        { success: false, error: 'Pending batch not found' },
        { status: 404 }
      );
    }

    const adminEmail = admin.email;

    const result = await service.completeStandardBatch(
      batchTaskId,
      amount,
      notes,
      batch,
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
    console.error('Error completing standard batch:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to complete standard batch' },
      { status: 500 }
    );
  }
}
