import { NextRequest, NextResponse } from 'next/server';
import { getTaskService } from '@/lib/services/taskService';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/matrix
 * Get task matrix: one row per event, one cell per timeline task.
 *
 * Query params:
 * - dateFrom: string (optional) — filter events from this date
 * - dateTo: string (optional) — filter events up to this date
 * - search: string (optional) — search by school name
 */
export async function GET(request: NextRequest) {
  try {
    const [, authError] = requireAdmin(request);
    if (authError) return authError;

    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const search = searchParams.get('search') || undefined;

    const taskService = getTaskService();
    const rows = await taskService.getTaskMatrix({ dateFrom, dateTo, search });

    return NextResponse.json({
      success: true,
      data: { rows },
    });
  } catch (error) {
    console.error('Error fetching task matrix:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch task matrix' },
      { status: 500 }
    );
  }
}
