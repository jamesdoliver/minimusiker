import { NextRequest, NextResponse } from 'next/server';
import { checkNoStaffAssigned, checkClassesAndSongs, checkBookingsWithoutEvent, checkPostWave2Orders, checkStaffEventReminder } from '@/lib/services/eventReadinessService';

export const dynamic = 'force-dynamic';

/**
 * Verify the request is from Vercel Cron
 */
function verifyCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[Event Readiness Cron] CRON_SECRET not set');
    return false;
  }

  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7) === cronSecret;
  }

  const cronHeader = request.headers.get('X-Cron-Secret');
  return cronHeader === cronSecret;
}

interface CronResult {
  status: string;
  noStaff?: { sent: number; skipped: number; failed: number; errors: string[] };
  noEvent?: { sent: number; skipped: number; failed: number; errors: string[] };
  staffReminder?: { sent: number; skipped: number; failed: number; errors: string[] };
  classesAndSongs?: { sent: number; skipped: number; failed: number; errors: string[] };
  postWave2Orders?: { sent: number; skipped: number; failed: number; errors: string[] };
  weeklySkipped?: boolean;
}

async function handleCronRequest(request: NextRequest): Promise<NextResponse<CronResult>> {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const isDryRun = url.searchParams.get('dryRun') === 'true';
  const forceWeekly = url.searchParams.get('forceWeekly') === 'true';

  console.log(`[Event Readiness Cron] Starting${isDryRun ? ' (DRY RUN)' : ''}${forceWeekly ? ' (FORCE WEEKLY)' : ''}`);

  // Daily check: no staff assigned
  const noStaffResult = await checkNoStaffAssigned(isDryRun);
  console.log('[Event Readiness Cron] No staff check:', noStaffResult);

  // Daily check: bookings without linked event
  const noEventResult = await checkBookingsWithoutEvent(isDryRun);
  console.log('[Event Readiness Cron] No event check:', noEventResult);

  // Daily check: staff event reminder (7 days before)
  const staffReminderResult = await checkStaffEventReminder(isDryRun);
  console.log('[Event Readiness Cron] Staff reminder check:', staffReminderResult);

  // Weekly checks: only on Mondays (or if forced)
  const isMonday = new Date().getDay() === 1;
  let classesAndSongsResult = null;
  let postWave2OrdersResult = null;

  if (isMonday || forceWeekly) {
    classesAndSongsResult = await checkClassesAndSongs(isDryRun);
    console.log('[Event Readiness Cron] Classes & songs check:', classesAndSongsResult);

    postWave2OrdersResult = await checkPostWave2Orders(isDryRun);
    console.log('[Event Readiness Cron] Post-Wave 2 orders check:', postWave2OrdersResult);
  } else {
    console.log('[Event Readiness Cron] Skipping weekly checks (not Monday)');
  }

  return NextResponse.json({
    status: 'ok',
    noStaff: noStaffResult,
    noEvent: noEventResult,
    staffReminder: staffReminderResult,
    classesAndSongs: classesAndSongsResult || undefined,
    postWave2Orders: postWave2OrdersResult || undefined,
    weeklySkipped: !isMonday && !forceWeekly,
  });
}

export async function GET(request: NextRequest) {
  return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
  return handleCronRequest(request);
}
