import { NextRequest, NextResponse } from 'next/server';
import { getTaskService } from '@/lib/services/taskService';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/[taskId]/cd-quantity
 * Returns the total CD order quantity for the event linked to this task.
 * The task must use the audio_cd_production template.
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

    if (task.template_id !== 'audio_cd_production') {
      return NextResponse.json(
        { success: false, error: 'Task is not an audio_cd_production task' },
        { status: 400 }
      );
    }

    if (!task.event_id) {
      return NextResponse.json(
        { success: false, error: 'Task has no linked event' },
        { status: 400 }
      );
    }

    // getCdQuantityForEvent expects the Airtable record ID (event_id on the task
    // is already the linked record ID from the Tasks table)
    const quantity = await taskService.getCdQuantityForEvent(task.event_id);

    return NextResponse.json({ success: true, data: { quantity } });
  } catch (error) {
    console.error('Error fetching CD quantity:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch CD quantity' },
      { status: 500 }
    );
  }
}
