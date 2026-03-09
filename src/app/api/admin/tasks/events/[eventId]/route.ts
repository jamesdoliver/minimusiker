import { NextRequest, NextResponse } from 'next/server';
import { getTaskService } from '@/lib/services/taskService';
import { getOrderWaveService } from '@/lib/services/orderWaveService';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/events/[eventId]
 * Get per-event detail: tasks and wave summaries for a single event.
 *
 * Returns:
 * - event: basic event info (eventId, schoolName, eventDate)
 * - tasks: all tasks for this event with event details
 * - welle1Summary: Welle 1 order summary (deadline, orderCount, fulfillmentStatus)
 * - welle2Summary: Welle 2 order summary (deadline, orderCount, fulfillmentStatus)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const [, authError] = requireAdmin(request);
    if (authError) return authError;

    const { eventId } = await params;

    const taskService = getTaskService();
    const orderWaveService = getOrderWaveService();

    // Fetch tasks and wave summary in parallel
    const [tasksResult, waveSummary] = await Promise.all([
      taskService.getTasks({ status: undefined, type: 'all', search: eventId }),
      orderWaveService.getEventOrders(eventId),
    ]);

    // Filter tasks to only those belonging to this event
    const eventTasks = tasksResult.tasks.filter(
      (task) => task.event_id === eventId
    );

    return NextResponse.json({
      success: true,
      data: {
        event: {
          eventId: waveSummary.eventRecordId,
          schoolName: waveSummary.schoolName,
          eventDate: waveSummary.eventDate,
        },
        tasks: eventTasks,
        welle1Summary: {
          deadline: waveSummary.welle1.deadline,
          orderCount: waveSummary.welle1.orderCount,
          fulfillmentStatus: waveSummary.welle1.fulfillmentStatus,
        },
        welle2Summary: {
          deadline: waveSummary.welle2.deadline,
          orderCount: waveSummary.welle2.orderCount,
          fulfillmentStatus: waveSummary.welle2.fulfillmentStatus,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching event tasks:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch event tasks';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
