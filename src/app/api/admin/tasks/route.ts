import { NextRequest, NextResponse } from 'next/server';
import { getTaskService } from '@/lib/services/taskService';
import { TaskStatus, TaskFilterTab } from '@/lib/types/tasks';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks
 * Get all tasks with optional filtering
 *
 * Query params:
 * - status: 'pending' | 'completed' (default: 'pending')
 * - type: TaskType | 'all' (default: 'all')
 * - search: string (searches event_id, go_id, order_ids)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = (searchParams.get('status') as TaskStatus) || 'pending';
    const type = (searchParams.get('type') as TaskFilterTab) || 'all';
    const search = searchParams.get('search') || undefined;

    const taskService = getTaskService();
    const result = await taskService.getTasks({ status, type, search });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}
