/**
 * Standard Clothing Batch Cron Endpoint
 *
 * Runs every Monday at 07:00 UTC. Collects all standard clothing orders
 * from the previous Mon-Sun week, creates a single pending batch task,
 * and follows the existing completion cascade (GO-ID + shipping task).
 *
 * @route POST /api/cron/standard-clothing-batch
 * @security Protected by CRON_SECRET environment variable
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStandardClothingBatchService } from '@/lib/services/standardClothingBatchService';

export const dynamic = 'force-dynamic';

function verifyCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[Standard Clothing Batch Cron] CRON_SECRET environment variable not set');
    return false;
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return token === cronSecret;
  }

  const cronHeader = request.headers.get('X-Cron-Secret');
  if (cronHeader === cronSecret) {
    return true;
  }

  return false;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    if (!verifyCronRequest(request)) {
      console.warn('[Standard Clothing Batch Cron] Unauthorized request attempt');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const isDryRun = searchParams.get('dryRun') === 'true';

    console.log(`[Standard Clothing Batch Cron] Starting (dryRun: ${isDryRun})`);

    const service = getStandardClothingBatchService();
    const { start, end } = service.getLastWeekRange();

    console.log(`[Standard Clothing Batch Cron] Week range: ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`);

    const batch = await service.findStandardOrdersForWeek(start, end);

    if (!batch) {
      const duration = Date.now() - startTime;
      console.log(`[Standard Clothing Batch Cron] No standard orders found. Skipped in ${duration}ms`);
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'no_orders',
        week_start: start.toISOString().split('T')[0],
        week_end: end.toISOString().split('T')[0],
      });
    }

    if (isDryRun) {
      const duration = Date.now() - startTime;
      console.log(`[Standard Clothing Batch Cron] Dry run complete in ${duration}ms. Would create batch with ${batch.total_orders} orders.`);
      return NextResponse.json({
        success: true,
        mode: 'dry-run',
        batch: {
          batch_id: batch.batch_id,
          week_start: batch.week_start,
          week_end: batch.week_end,
          total_orders: batch.total_orders,
          total_revenue: batch.total_revenue,
          event_count: batch.event_record_ids.length,
          event_names: batch.event_names,
          aggregated_items: batch.aggregated_items,
          order_ids: batch.order_ids,
        },
      });
    }

    // Create the batch task
    const taskId = await service.createBatchTask(batch);

    const duration = Date.now() - startTime;
    console.log(`[Standard Clothing Batch Cron] Created batch task ${taskId} with ${batch.total_orders} orders in ${duration}ms`);

    return NextResponse.json({
      success: true,
      status: 'created',
      task_id: taskId,
      batch: {
        batch_id: batch.batch_id,
        week_start: batch.week_start,
        week_end: batch.week_end,
        total_orders: batch.total_orders,
        total_revenue: batch.total_revenue,
        event_count: batch.event_record_ids.length,
        event_names: batch.event_names,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Standard Clothing Batch Cron] Fatal error after ${duration}ms:`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronRequest(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    endpoint: '/api/cron/standard-clothing-batch',
    method: 'POST',
    description: 'Weekly batch creation for standard Minimusiker-branded clothing orders',
    schedule: '0 7 * * 1 (Monday 07:00 UTC)',
    queryParams: {
      dryRun: 'Set to "true" to preview batch without creating task',
    },
  });
}
