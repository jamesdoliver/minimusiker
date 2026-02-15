import { NextRequest, NextResponse } from 'next/server';
import { getTaskService } from '@/lib/services/taskService';
import { TaskStatus, TaskFilterTab } from '@/lib/types/tasks';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';

export const dynamic = 'force-dynamic';

const VALID_STATUSES: TaskStatus[] = ['pending', 'completed', 'cancelled'];
const VALID_TYPES: TaskFilterTab[] = ['all', 'paper_order', 'clothing_order', 'standard_clothing_order', 'cd_master', 'cd_production', 'shipping'];

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
    const [, authError] = requireAdmin(request);
    if (authError) return authError;

    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get('status');
    const typeParam = searchParams.get('type');
    const search = searchParams.get('search') || undefined;

    const status: TaskStatus = statusParam && VALID_STATUSES.includes(statusParam as TaskStatus)
      ? (statusParam as TaskStatus)
      : 'pending';
    const type: TaskFilterTab = typeParam && VALID_TYPES.includes(typeParam as TaskFilterTab)
      ? (typeParam as TaskFilterTab)
      : 'all';

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
