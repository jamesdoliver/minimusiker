import { NextRequest, NextResponse } from 'next/server';
import { syncBookingsFromSimplybook } from '@/lib/services/bookingSyncService';

export const dynamic = 'force-dynamic';

function verifyCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[booking-sync cron] CRON_SECRET not set');
    return false;
  }

  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7) === cronSecret;
  }

  const cronHeader = request.headers.get('X-Cron-Secret');
  return cronHeader === cronSecret;
}

async function handleCron(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ status: 'unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];
  console.log(`[booking-sync cron] Starting daily sync from ${today}`);

  try {
    const results = await syncBookingsFromSimplybook(today);
    return NextResponse.json({ status: 'ok', results });
  } catch (error) {
    console.error('[booking-sync cron] Failed:', error);
    return NextResponse.json(
      { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}
