import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

// Cap per run to stay polite under Airtable's 5 req/sec rate limit. Each event
// triggers ~1 event fetch + 1 booking fetch + 1 classes lookup (which paginates
// the Classes table) + 1 update — so cost is dominated by Classes table size,
// not by event count. Operator paginates via ?skip=N.
const MAX_EVENTS_PER_RUN = 200;

type PerEventResult = {
  eventRecordId: string;
  eventId?: string;
  status: string;
  teacherName?: string;
  classId?: string;
  className?: string;
  error?: string;
};

/**
 * POST /api/admin/events/refresh-teachers-bulk
 *
 * One-shot backfill: walks all Events and, for each, sets the first empty
 * class.main_teacher to the linked SchoolBooking's contact person name.
 *
 * Always responds 200 with a results array; per-event failures are reported
 * inline rather than aborting the batch.
 */
export async function POST(request: NextRequest) {
  const admin = verifyAdminSession(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const skipParam = request.nextUrl.searchParams.get('skip');
  const parsedSkip = skipParam !== null ? parseInt(skipParam, 10) : 0;
  const skip = Number.isFinite(parsedSkip) && parsedSkip > 0 ? parsedSkip : 0;

  const airtableService = getAirtableService();
  const results: PerEventResult[] = [];

  let totalEvents = 0;
  let processed = 0;

  try {
    const events = await airtableService.getAllEvents();
    totalEvents = events.length;

    for (let i = skip; i < events.length; i++) {
      if (processed >= MAX_EVENTS_PER_RUN) break;
      const event = events[i];
      processed++;

      try {
        const outcome = await airtableService.refreshTeacherForEvent(event.id);
        results.push({
          eventRecordId: event.id,
          eventId: event.event_id,
          status: outcome.status,
          teacherName: outcome.teacherName,
          classId: outcome.classId,
          className: outcome.className,
        });
      } catch (err) {
        results.push({
          eventRecordId: event.id,
          eventId: event.event_id,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to enumerate events',
      },
      { status: 500 }
    );
  }

  // Aggregate counts by status for a quick scan
  const summary = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const hasMore = skip + processed < totalEvents;
  const nextSkip = hasMore ? skip + processed : null;

  return NextResponse.json({
    success: true,
    totalEvents,
    skip,
    processed,
    cap: MAX_EVENTS_PER_RUN,
    hasMore,
    nextSkip,
    summary,
    results,
  });
}
