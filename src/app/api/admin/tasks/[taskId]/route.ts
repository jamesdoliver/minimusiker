import { NextRequest } from 'next/server';
import { getTaskService } from '@/lib/services/taskService';
import { TaskCompletionData } from '@/lib/types/tasks';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';
import { createWhitelistGuard } from '@/lib/api/validators';
import { apiOk, apiError } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

const VALID_STATUS_OVERRIDES = ['cancelled', 'skipped', 'partial', 'pending'] as const;

// Type-narrowing guard for the PATCH body's `status` field. Accepts the
// explicit override values or undefined (default completion path); rejects
// everything else so unknown/typo'd values don't silently complete a task.
const isValidStatusOverride = createWhitelistGuard(VALID_STATUS_OVERRIDES);

/**
 * GET /api/admin/tasks/[taskId]
 * Get a single task with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const [, authError] = requireAdmin(request);
    if (authError) return authError;

    const { taskId } = await params;
    const taskService = getTaskService();
    const task = await taskService.getTaskById(taskId);

    if (!task) {
      return apiError('Task not found', 404);
    }

    // Get download URL if task has an R2 file
    let downloadUrl: string | null = null;
    if (task.r2_file_path) {
      downloadUrl = await taskService.getTaskDownloadUrl(taskId);
    }

    return apiOk({
      ...task,
      r2_download_url: downloadUrl,
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    return apiError('Failed to fetch task', 500);
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
    const [admin, authError] = requireAdmin(request);
    if (authError) return authError;

    const { taskId } = await params;
    const body = await request.json();

    if (!isValidStatusOverride(body.status)) {
      return apiError(
        `Invalid status. Expected one of: ${VALID_STATUS_OVERRIDES.join(', ')} or omit for completion.`,
        400,
      );
    }

    const adminEmail = admin.email;

    const taskService = getTaskService();

    // Handle cancellation
    if (body.status === 'cancelled') {
      const task = await taskService.cancelTask(taskId, adminEmail);
      return apiOk({ task }, 'Task cancelled successfully.');
    }

    // Handle skip
    if (body.status === 'skipped') {
      const task = await taskService.skipTask(taskId, adminEmail);
      return apiOk({ task }, 'Task skipped successfully.');
    }

    // Handle partial completion
    if (body.status === 'partial') {
      if (!body.completion_data?.notes) {
        return apiError('Notes are required for partial completion', 400);
      }
      const task = await taskService.partialCompleteTask(
        taskId,
        body.completion_data,
        adminEmail,
      );
      return apiOk({ task }, 'Task partially completed.');
    }

    // Handle revert to pending
    if (body.status === 'pending') {
      const task = await taskService.revertTask(taskId, adminEmail);
      return apiOk({ task }, 'Task reverted to pending.');
    }

    // Handle completion
    const completionData: TaskCompletionData = body.completion_data || {};
    const result = await taskService.completeTask(taskId, completionData, adminEmail);

    return apiOk(
      {
        task: result.task,
        go_id: result.goId,
      },
      'Task completed successfully.',
    );
  } catch (error) {
    console.error('Error updating task:', error);
    const message = error instanceof Error ? error.message : 'Failed to update task';
    const status = message === 'Task is already completed' ? 409 : 500;
    return apiError(message, status);
  }
}
