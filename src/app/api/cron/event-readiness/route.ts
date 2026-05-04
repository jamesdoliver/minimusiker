import { NextRequest, NextResponse } from 'next/server';
import { checkNoStaffAssigned, checkClassesAndSongs, checkBookingsWithoutEvent, checkPostWave2Orders, checkRecentOrderChanges, checkStaffEventReminder, checkRegistrationShortfall } from '@/lib/services/eventReadinessService';
import { checkDataIntegrityFlags } from '@/lib/services/dataIntegrityService';

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
  registrationShortfall?: { sent: number; skipped: number; failed: number; errors: string[] };
  classesAndSongs?: { sent: number; skipped: number; failed: number; errors: string[] };
  postWave2Orders?: { sent: number; skipped: number; failed: number; errors: string[] };
  recentOrderChanges?: { sent: number; skipped: number; failed: number; errors: string[] };
  dataIntegrity?: { sent: number; skipped: number; failed: number; errors: string[]; invalidCount?: number };
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

  // Daily check: registration shortfall (7 days before, only if <50% registered)
  const registrationShortfallResult = await checkRegistrationShortfall(isDryRun);
  console.log('[Event Readiness Cron] Registration shortfall check:', registrationShortfallResult);

  // Weekly checks: only on Mondays (or if forced)
  const isMonday = new Date().getDay() === 1;
  let classesAndSongsResult = null;
  let postWave2OrdersResult = null;
  let recentOrderChangesResult = null;
  let dataIntegrityResult = null;

  if (isMonday || forceWeekly) {
    classesAndSongsResult = await checkClassesAndSongs(isDryRun);
    console.log('[Event Readiness Cron] Classes & songs check:', classesAndSongsResult);

    postWave2OrdersResult = await checkPostWave2Orders(isDryRun);
    console.log('[Event Readiness Cron] Post-Wave 2 orders check:', postWave2OrdersResult);

    recentOrderChangesResult = await checkRecentOrderChanges(isDryRun);
    console.log('[Event Readiness Cron] Recent order changes check:', recentOrderChangesResult);

    dataIntegrityResult = await checkDataIntegrityFlags(isDryRun);
    console.log('[Event Readiness Cron] Data integrity check:', dataIntegrityResult);
  } else {
    console.log('[Event Readiness Cron] Skipping weekly checks (not Monday)');
  }

  return NextResponse.json({
    status: 'ok',
    noStaff: noStaffResult,
    noEvent: noEventResult,
    staffReminder: staffReminderResult,
    registrationShortfall: registrationShortfallResult,
    classesAndSongs: classesAndSongsResult || undefined,
    postWave2Orders: postWave2OrdersResult || undefined,
    recentOrderChanges: recentOrderChangesResult || undefined,
    dataIntegrity: dataIntegrityResult || undefined,
    weeklySkipped: !isMonday && !forceWeekly,
  });
}

export async function GET(request: NextRequest) {
  return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
  return handleCronRequest(request);
}
