import { NextRequest, NextResponse } from 'next/server';
import { getTaskService } from '@/lib/services/taskService';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/by-date
 * Get pending tasks grouped by deadline date within a date range.
 *
 * Query params:
 * - dateFrom: string (required) — start of date range (YYYY-MM-DD)
 * - dateTo: string (required) — end of date range (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  try {
    const [, authError] = requireAdmin(request);
    if (authError) return authError;

    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { success: false, error: 'dateFrom and dateTo query params are required' },
        { status: 400 }
      );
    }

    const taskService = getTaskService();
    const tasksByDate = await taskService.getTasksByDate(dateFrom, dateTo);

    return NextResponse.json({
      success: true,
      data: { tasksByDate },
    });
  } catch (error) {
    console.error('Error fetching tasks by date:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tasks by date' },
      { status: 500 }
    );
  }
}
