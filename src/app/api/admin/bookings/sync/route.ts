import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { syncBookingsFromSimplybook } from '@/lib/services/bookingSyncService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/bookings/sync
 * Manual sync of future bookings from SimplyBook to Airtable.
 * A scheduled cron at /api/cron/booking-sync runs the same logic daily.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date().toISOString().split('T')[0];
    console.log(`[admin sync] Starting sync of future bookings from ${today}`);

    const results = await syncBookingsFromSimplybook(today);

    return NextResponse.json({
      success: true,
      message: `Synced ${results.created} bookings (${results.teachersCreated} teachers created, ${results.teacherErrors} teacher errors), skipped ${results.skipped} existing, ${results.errors} errors`,
      results,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/bookings/sync
 * Returns info about the sync endpoint
 */
export async function GET(request: NextRequest) {
  const admin = verifyAdminSession(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    endpoint: '/api/admin/bookings/sync',
    method: 'POST',
    description: 'Manual sync of future bookings from SimplyBook to Airtable.',
    note: 'A scheduled cron at /api/cron/booking-sync runs the same logic daily, so manual sync is now a backup.',
  });
}
