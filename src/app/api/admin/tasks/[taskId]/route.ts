import { NextRequest, NextResponse } from 'next/server';
import { getTaskService } from '@/lib/services/taskService';
import { TaskCompletionData } from '@/lib/types/tasks';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';
import { createWhitelistGuard } from '@/lib/api/validators';

export const dynamic = 'force-dynamic';

const VALID_STATUS_OVERRIDES = ['cancelled', 'skipped', 'partial', 'pending'] as const;

/**
 * Type-narrowing guard exported for unit testing and downstream call sites.
 * Returns true when `status` is one of the explicit override values handled by
 * the PATCH branches, or undefined (which routes to the default completion
 * path). Anything else must be rejected so unknown/typo'd values don't
 * silently complete a task.
 *
 * Implemented via the shared `createWhitelistGuard` helper so the predicate
 * shape stays consistent across routes. The boolean-returning call site below
 * (`!isValidStatusOverride(body.status)`) still works unchanged because a
 * type-predicate return value is structurally `boolean` at runtime.
 *
 * Note: this is exported from a Next.js route file. Next.js only serves the
 * HTTP method exports (GET/PATCH/etc); arbitrary additional exports are
 * permitted and not exposed as endpoints.
 */
export const isValidStatusOverride = createWhitelistGuard(VALID_STATUS_OVERRIDES);

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
    const [admin, authError] = requireAdmin(request);
    if (authError) return authError;

    const { taskId } = await params;
    const body = await request.json();

    if (!isValidStatusOverride(body.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Expected one of: ${VALID_STATUS_OVERRIDES.join(', ')} or omit for completion.`,
        },
        { status: 400 },
      );
    }

    const adminEmail = admin.email;

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

    // Handle skip
    if (body.status === 'skipped') {
      const task = await taskService.skipTask(taskId, adminEmail);
      return NextResponse.json({
        success: true,
        data: { task },
        message: 'Task skipped successfully.',
      });
    }

    // Handle partial completion
    if (body.status === 'partial') {
      if (!body.completion_data?.notes) {
        return NextResponse.json(
          { success: false, error: 'Notes are required for partial completion' },
          { status: 400 },
        );
      }
      const task = await taskService.partialCompleteTask(
        taskId,
        body.completion_data,
        adminEmail,
      );
      return NextResponse.json({
        success: true,
        data: { task },
        message: 'Task partially completed.',
      });
    }

    // Handle revert to pending
    if (body.status === 'pending') {
      const task = await taskService.revertTask(taskId, adminEmail);
      return NextResponse.json({
        success: true,
        data: { task },
        message: 'Task reverted to pending.',
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
      },
      message: 'Task completed successfully.',
    });
  } catch (error) {
    console.error('Error updating task:', error);
    const message = error instanceof Error ? error.message : 'Failed to update task';
    const status = message === 'Task is already completed' ? 409 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
