/**
 * Report: shows two views of the Orders table.
 *
 *   1. Recently-updated orders (last 24h) — current state of each. After a
 *      backfill, this is the list of records that changed.
 *   2. Post-Wave 2 attention list — every order whose event's Wave 2 deadline
 *      (event_date + 14 days) has passed and which is still pending/partial.
 *
 * Read-only.
 *
 * Usage:
 *   npx tsx scripts/report-orders-status.ts
 *   npx tsx scripts/report-orders-status.ts --updated-since=2026-04-27T11:00
 */

require('dotenv').config({ path: '.env.local' });

import Airtable from 'airtable';
import {
  ORDERS_TABLE_ID,
  ORDERS_FIELD_IDS,
  EVENTS_TABLE_ID,
  EVENTS_FIELD_IDS,
} from '../src/lib/types/airtable';
import {
  buildClassToEventMap,
  resolveOrderEventId,
} from '../src/lib/utils/orderEventResolver';

const SINCE_ARG = process.argv.find((a) => a.startsWith('--updated-since='));
const UPDATED_SINCE = SINCE_ARG
  ? new Date(SINCE_ARG.split('=')[1])
  : new Date(Date.now() - 24 * 60 * 60 * 1000);
const WAVE_2_OFFSET_DAYS = 14;

function fmtDate(d: string | undefined | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return d;
  }
}

function fmtMoney(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return n.toFixed(2).padStart(7);
}

function pad(s: string, n: number): string {
  if (s.length >= n) return s.slice(0, n);
  return s + ' '.repeat(n - s.length);
}

interface OrderSummary {
  orderNumber: string;
  school: string;
  orderDate: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalAmount: number;
  refundAmount: number;
  cancelReason: string;
  isTest: boolean;
  updatedAt: string;
  eventRecordId?: string;
  eventDate?: string;
}

async function main() {
  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  );

  const [allOrders, classToEvent] = await Promise.all([
    base(ORDERS_TABLE_ID).select({ returnFieldsByFieldId: true }).all(),
    buildClassToEventMap(base),
  ]);

  // Build event lookup
  const eventRecords = await base(EVENTS_TABLE_ID)
    .select({ returnFieldsByFieldId: true })
    .all();
  const eventMap = new Map<
    string,
    { schoolName: string; eventDate: string }
  >();
  for (const e of eventRecords) {
    eventMap.set(e.id, {
      schoolName: (e.get(EVENTS_FIELD_IDS.school_name) as string) || '—',
      eventDate: (e.get(EVENTS_FIELD_IDS.event_date) as string) || '',
    });
  }

  const summaries: OrderSummary[] = allOrders.map((r) => {
    const eventRecordId = resolveOrderEventId(r, classToEvent);
    const event = eventRecordId ? eventMap.get(eventRecordId) : undefined;
    return {
      orderNumber: (r.get(ORDERS_FIELD_IDS.order_number) as string) || '—',
      school:
        event?.schoolName ||
        (r.get(ORDERS_FIELD_IDS.school_name) as string) ||
        '—',
      orderDate: (r.get(ORDERS_FIELD_IDS.order_date) as string) || '',
      paymentStatus:
        (r.get(ORDERS_FIELD_IDS.payment_status) as string) || '—',
      fulfillmentStatus:
        (r.get(ORDERS_FIELD_IDS.fulfillment_status) as string) || '—',
      totalAmount: (r.get(ORDERS_FIELD_IDS.total_amount) as number) || 0,
      refundAmount: (r.get(ORDERS_FIELD_IDS.refund_amount) as number) || 0,
      cancelReason: (r.get(ORDERS_FIELD_IDS.cancel_reason) as string) || '',
      isTest: r.get(ORDERS_FIELD_IDS.is_test) === true,
      updatedAt: (r.get(ORDERS_FIELD_IDS.updated_at) as string) || '',
      eventRecordId,
      eventDate: event?.eventDate,
    };
  });

  // ─── Section 1: Recently updated orders, split by category ────────────
  const recentlyUpdated = summaries
    .filter((s) => s.updatedAt && new Date(s.updatedAt) >= UPDATED_SINCE)
    .sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));

  // Heuristic categorization based on current state.
  const refundFixes = recentlyUpdated.filter(
    (s) =>
      s.refundAmount > 0.01 ||
      s.paymentStatus === 'refunded' ||
      s.paymentStatus === 'partially_refunded' ||
      s.paymentStatus === 'voided'
  );
  const isTestFixes = recentlyUpdated.filter(
    (s) => s.isTest && !refundFixes.includes(s)
  );
  // Fulfillment-only fixes: orders where payment is paid, no refund, no test,
  // but the audit said fulfillment_status was out of sync. Hard to identify
  // post-hoc without a before/after snapshot, so we infer: orders with order_date
  // older than ~10 days but updated_at recent (i.e. not freshly created).
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  const fulfillmentFixes = recentlyUpdated.filter((s) => {
    if (refundFixes.includes(s) || isTestFixes.includes(s)) return false;
    if (!s.orderDate) return false;
    return new Date(s.orderDate) < tenDaysAgo;
  });
  const newOrders = recentlyUpdated.filter(
    (s) =>
      !refundFixes.includes(s) &&
      !isTestFixes.includes(s) &&
      !fulfillmentFixes.includes(s)
  );

  function printOrderTable(title: string, rows: OrderSummary[]) {
    console.log(`\n  ── ${title} (${rows.length}) ──`);
    if (rows.length === 0) {
      console.log('    (none)');
      return;
    }
    console.log(
      '    ' +
        pad('Order', 8) +
        pad('School', 42) +
        pad('Order date', 12) +
        pad('Payment', 20) +
        pad('Fulfillment', 12) +
        pad(' Total €', 9) +
        pad(' Refund €', 10) +
        'Cancel'
    );
    for (const s of rows) {
      console.log(
        '    ' +
          pad(s.orderNumber, 8) +
          pad(s.school, 42) +
          pad(fmtDate(s.orderDate), 12) +
          pad(s.paymentStatus, 20) +
          pad(s.fulfillmentStatus, 12) +
          pad(fmtMoney(s.totalAmount), 9) +
          pad(fmtMoney(s.refundAmount), 10) +
          (s.cancelReason || '')
      );
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════════════════════════════════════════════════════');
  console.log(`  Recently-updated orders   (since ${UPDATED_SINCE.toISOString()})`);
  console.log('══════════════════════════════════════════════════════════════════════════════════════════════════════════════');
  console.log(`Found ${recentlyUpdated.length} records total.`);

  printOrderTable('Refund-state corrections (silent refunds Gian flagged)', refundFixes);
  printOrderTable('Test-order flags backfilled', isTestFixes);
  printOrderTable('Fulfillment / cancel updates on existing orders', fulfillmentFixes);
  printOrderTable('Brand-new orders created in this window', newOrders);

  // ─── Section 2: Post-Wave 2 attention list ───────────────────────────
  const now = new Date();
  const flagged = summaries.filter((s) => {
    if (!s.eventDate) return false;
    if (s.cancelReason) return false;
    if (s.isTest) return false;
    if (s.refundAmount > 0.01) return false;
    if (
      s.paymentStatus === 'refunded' ||
      s.paymentStatus === 'partially_refunded' ||
      s.paymentStatus === 'voided'
    )
      return false;
    if (
      s.fulfillmentStatus !== 'pending' &&
      s.fulfillmentStatus !== 'partial'
    )
      return false;
    const eventDate = new Date(s.eventDate);
    const wave2Deadline = new Date(eventDate);
    wave2Deadline.setDate(wave2Deadline.getDate() + WAVE_2_OFFSET_DAYS);
    return now > wave2Deadline;
  });

  // Group by event
  interface EventGroup {
    schoolName: string;
    eventDate: string;
    daysSinceEvent: number;
    daysSinceWave2: number;
    crossedWave2InLastWeek: boolean;
    orders: OrderSummary[];
  }
  const byEvent = new Map<string, EventGroup>();
  for (const s of flagged) {
    if (!s.eventRecordId || !s.eventDate) continue;
    if (!byEvent.has(s.eventRecordId)) {
      const eventDate = new Date(s.eventDate);
      const daysSinceEvent = Math.floor(
        (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysSinceWave2 = daysSinceEvent - WAVE_2_OFFSET_DAYS;
      byEvent.set(s.eventRecordId, {
        schoolName: s.school,
        eventDate: s.eventDate,
        daysSinceEvent,
        daysSinceWave2,
        crossedWave2InLastWeek: daysSinceWave2 >= 0 && daysSinceWave2 < 7,
        orders: [],
      });
    }
    byEvent.get(s.eventRecordId)!.orders.push(s);
  }

  const groups = [...byEvent.values()].sort(
    (a, b) =>
      new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
  );

  const totalOrders = groups.reduce((acc, g) => acc + g.orders.length, 0);
  const totalValue = groups.reduce(
    (acc, g) => acc + g.orders.reduce((a, o) => a + o.totalAmount, 0),
    0
  );
  const newThisWeek = groups.filter((g) => g.crossedWave2InLastWeek);
  const newThisWeekOrders = newThisWeek.reduce(
    (acc, g) => acc + g.orders.length,
    0
  );

  console.log('\n══════════════════════════════════════════════════════════════════════════════════════════');
  console.log('  Post-Wave 2 attention list   (events past event_date + 14d, orders pending/partial)');
  console.log('══════════════════════════════════════════════════════════════════════════════════════════');
  console.log(
    `Total: ${totalOrders} orders / ${groups.length} events / €${totalValue.toFixed(
      2
    )}`
  );
  console.log(
    `New this week (Wave 2 deadline crossed in last 7d): ${newThisWeekOrders} orders / ${newThisWeek.length} events`
  );

  for (const g of groups) {
    const flag = g.crossedWave2InLastWeek ? '  ★ NEW THIS WEEK' : '';
    console.log(
      `\n  ${g.schoolName}  ·  event ${fmtDate(g.eventDate)}  ·  Wave 2 expired ${g.daysSinceWave2}d ago${flag}`
    );
    for (const o of g.orders.sort((a, b) =>
      a.orderDate.localeCompare(b.orderDate)
    )) {
      console.log(
        `      ${pad(o.orderNumber, 8)} ${pad(fmtDate(o.orderDate), 12)} ${pad(
          o.fulfillmentStatus,
          10
        )} €${fmtMoney(o.totalAmount).trim()}`
      );
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════════════════════════════════\n');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
