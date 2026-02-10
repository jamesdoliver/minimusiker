import { NextRequest, NextResponse } from 'next/server';
import { getTaskService } from '@/lib/services/taskService';
import { TaskCompletionData } from '@/lib/types/tasks';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/[taskId]
 * Get a single task with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const taskService = getTaskService();
    const task = await taskService.getTaskById(taskId);

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      );
    }

    // Get download URL if task has an R2 file
    let downloadUrl: string | null = null;
    if (task.r2_file_path) {
      downloadUrl = await taskService.getTaskDownloadUrl(taskId);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...task,
        r2_download_url: downloadUrl,
      },
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/tasks/[taskId]
 * Complete a task
 *
 * Body:
 * - completion_data: TaskCompletionData (amount, invoice_url, confirmed, notes)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const body = await request.json();

    // Get admin email from session/auth (for now, use a placeholder)
    // TODO: Get actual admin email from session
    const adminEmail = 'admin@minimusiker.de';

    const taskService = getTaskService();

    // Handle cancellation
    if (body.status === 'cancelled') {
      const task = await taskService.cancelTask(taskId, adminEmail);
      return NextResponse.json({
        success: true,
        data: { task },
        message: 'Task cancelled successfully.',
      });
    }

    // Handle completion
    const completionData: TaskCompletionData = body.completion_data || {};
    const result = await taskService.completeTask(taskId, completionData, adminEmail);

    return NextResponse.json({
      success: true,
      data: {
        task: result.task,
        go_id: result.goId,
        shipping_task_id: result.shippingTaskId,
      },
      message: result.shippingTaskId
        ? 'Task completed. Shipping task created.'
        : 'Task completed successfully.',
    });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update task' },
      { status: 500 }
    );
  }
}
