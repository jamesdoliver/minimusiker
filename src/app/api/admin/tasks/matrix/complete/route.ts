import { NextRequest, NextResponse } from 'next/server';
import { getTaskService } from '@/lib/services/taskService';
import { TaskCompletionData } from '@/lib/types/tasks';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/tasks/matrix/complete
 * Create and complete a task for a virtual cell (no existing Airtable record).
 *
 * Body:
 * - eventId: string — Airtable event record ID
 * - templateId: string — TASK_TIMELINE entry id (e.g. "ship_poster")
 * - completion_data: TaskCompletionData
 */
export async function POST(request: NextRequest) {
  try {
    const [admin, authError] = requireAdmin(request);
    if (authError) return authError;

    const body = await request.json();
    const { eventId, templateId, completion_data, status } = body;

    if (!eventId || !templateId) {
      return NextResponse.json(
        { success: false, error: 'eventId and templateId are required' },
        { status: 400 },
      );
    }

    const completionData: TaskCompletionData = completion_data || {};
    const taskService = getTaskService();

    // Handle skip
    if (status === 'skipped') {
      const task = await taskService.createAndSkipTask(eventId, templateId, admin.email);
      return NextResponse.json({
        success: true,
        data: { task },
        message: 'Task created and skipped.',
      });
    }

    // Handle partial
    if (status === 'partial') {
      if (!completionData.notes) {
        return NextResponse.json(
          { success: false, error: 'Notes are required for partial completion' },
          { status: 400 },
        );
      }
      const task = await taskService.createAndPartialTask(
        eventId,
        templateId,
        completionData,
        admin.email,
      );
      return NextResponse.json({
        success: true,
        data: { task },
        message: 'Task created and partially completed.',
      });
    }

    // Default: complete
    const result = await taskService.createAndCompleteTask(
      eventId,
      templateId,
      completionData,
      admin.email,
    );

    return NextResponse.json({
      success: true,
      data: {
        task: result.task,
        go_id: result.goId,
        shipping_task_id: result.shippingTaskId,
      },
      message: result.shippingTaskId
        ? 'Task created and completed. Shipping task created.'
        : 'Task created and completed successfully.',
    });
  } catch (error) {
    console.error('Error creating and completing task:', error);
    const message = error instanceof Error ? error.message : 'Failed to complete task';
    const status = message === 'Task is already completed' ? 409 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status },
    );
  }
}
