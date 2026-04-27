/**
 * One-off: send the post-Wave 2 orders digest to Gian, signed off as Monty.
 *
 * Reuses the same logic as `checkPostWave2Orders` in eventReadinessService —
 * filter formula, Wave 2 deadline check, line-item summaries — but sends to
 * a single recipient with a custom signoff via Resend directly (bypasses the
 * trigger-email template).
 *
 * Usage:
 *   npx tsx scripts/send-post-wave2-digest-monty.ts            # send
 *   npx tsx scripts/send-post-wave2-digest-monty.ts --dry-run  # log only
 */

require('dotenv').config({ path: '.env.local' });

// Bridge for shopifyAdminService which only reads SHOPIFY_STORE_DOMAIN
if (!process.env.SHOPIFY_STORE_DOMAIN && process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN) {
  process.env.SHOPIFY_STORE_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
}

import Airtable from 'airtable';
import { Resend } from 'resend';
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
import { shopifyAdminService } from '../src/lib/services/shopifyAdminService';

const DRY_RUN = process.argv.includes('--dry-run');
const TO_EMAIL = 'gian.koehler@guesstimate.de';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@minimusiker.app';
const FROM_NAME = 'Monty';
const WAVE_2_OFFSET_DAYS = 14;

function formatDateGerman(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

interface MinimalEvent {
  id: string;
  event_date: string;
  school_name: string;
  status?: string;
}

async function getAllEvents(
  base: ReturnType<Airtable['base']>
): Promise<Map<string, MinimalEvent>> {
  const records = await base(EVENTS_TABLE_ID)
    .select({ returnFieldsByFieldId: true })
    .all();
  const map = new Map<string, MinimalEvent>();
  for (const r of records) {
    const event_date = r.get(EVENTS_FIELD_IDS.event_date) as string | undefined;
    const school_name =
      (r.get(EVENTS_FIELD_IDS.school_name) as string | undefined) || '(unknown)';
    if (!event_date) continue;
    map.set(r.id, { id: r.id, event_date, school_name });
  }
  return map;
}

async function main() {
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    throw new Error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID');
  }
  if (!process.env.RESEND_API_KEY && !DRY_RUN) {
    throw new Error('Missing RESEND_API_KEY (use --dry-run to skip sending)');
  }

  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID
  );

  const filterFormula = `AND(
    OR(
      {${ORDERS_FIELD_IDS.fulfillment_status}} = 'pending',
      {${ORDERS_FIELD_IDS.fulfillment_status}} = 'partial'
    ),
    {${ORDERS_FIELD_IDS.payment_status}} != 'refunded',
    {${ORDERS_FIELD_IDS.payment_status}} != 'partially_refunded',
    {${ORDERS_FIELD_IDS.payment_status}} != 'voided',
    OR(
      {${ORDERS_FIELD_IDS.refund_amount}} = BLANK(),
      {${ORDERS_FIELD_IDS.refund_amount}} = 0
    ),
    OR(
      {${ORDERS_FIELD_IDS.is_test}} = BLANK(),
      {${ORDERS_FIELD_IDS.is_test}} = FALSE()
    )
  )`;

  console.log(`[monty] Fetching pending orders…`);
  const [pendingOrders, classToEvent, eventMap] = await Promise.all([
    base(ORDERS_TABLE_ID)
      .select({ filterByFormula: filterFormula, returnFieldsByFieldId: true })
      .all(),
    buildClassToEventMap(base),
    getAllEvents(base),
  ]);
  console.log(
    `[monty] ${pendingOrders.length} pending orders, ${eventMap.size} events`
  );

  const now = new Date();

  interface PostWave2Order {
    gid: string;
    orderNumber: string;
    totalAmount: number;
    orderDate: string;
    fulfillmentStatus: string;
    itemsSummary: string;
  }

  interface PostWave2Event {
    schoolName: string;
    eventDate: string;
    daysSinceEvent: number;
    orders: PostWave2Order[];
  }

  const eventOrders = new Map<string, PostWave2Event>();

  for (const order of pendingOrders) {
    const cancelReason = order.get(ORDERS_FIELD_IDS.cancel_reason) as
      | string
      | undefined;
    if (cancelReason) continue;

    const eventRecordId = resolveOrderEventId(order, classToEvent);
    if (!eventRecordId) continue;

    const event = eventMap.get(eventRecordId);
    if (!event) continue;

    const eventDate = new Date(event.event_date);
    const wave2Deadline = new Date(eventDate);
    wave2Deadline.setDate(wave2Deadline.getDate() + WAVE_2_OFFSET_DAYS);
    if (now <= wave2Deadline) continue;

    const daysSinceEvent = Math.floor(
      (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const lineItemsJson = order.get(ORDERS_FIELD_IDS.line_items) as string;
    let itemsSummary = '—';
    if (lineItemsJson) {
      try {
        const items = JSON.parse(lineItemsJson) as Array<{
          product_title: string;
          variant_title?: string;
          quantity: number;
        }>;
        itemsSummary = items
          .map((i) => `${i.quantity}x ${i.variant_title || i.product_title}`)
          .join(', ');
      } catch {
        // ignore parse errors
      }
    }

    if (!eventOrders.has(eventRecordId)) {
      eventOrders.set(eventRecordId, {
        schoolName: event.school_name,
        eventDate: event.event_date,
        daysSinceEvent,
        orders: [],
      });
    }
    eventOrders.get(eventRecordId)!.orders.push({
      gid: (order.get(ORDERS_FIELD_IDS.order_id) as string) || '',
      orderNumber:
        (order.get(ORDERS_FIELD_IDS.order_number) as string) || '—',
      totalAmount: (order.get(ORDERS_FIELD_IDS.total_amount) as number) || 0,
      orderDate: (order.get(ORDERS_FIELD_IDS.order_date) as string) || '',
      fulfillmentStatus:
        (order.get(ORDERS_FIELD_IDS.fulfillment_status) as string) ||
        'pending',
      itemsSummary,
    });
  }

  // Live-enrich with Shopify test flag — Airtable's is_test is BLANK for orders
  // created before the backfill, so we can't trust the formula filter alone yet.
  const candidateGids = [
    ...new Set(
      [...eventOrders.values()]
        .flatMap((e) => e.orders.map((o) => o.gid))
        .filter((g) => g.startsWith('gid://shopify/Order/'))
    ),
  ];
  console.log(`[monty] Enriching ${candidateGids.length} orders with Shopify test flag…`);
  const testFlags = new Map<string, boolean>();
  const SHOPIFY_BATCH = 50;
  for (let i = 0; i < candidateGids.length; i += SHOPIFY_BATCH) {
    const chunk = candidateGids.slice(i, i + SHOPIFY_BATCH);
    const flags = await shopifyAdminService.getOrdersTestFlags(chunk);
    for (const [k, v] of flags) testFlags.set(k, v);
  }

  let droppedTest = 0;
  for (const [eventId, evt] of eventOrders) {
    evt.orders = evt.orders.filter((o) => {
      if (testFlags.get(o.gid) === true) {
        droppedTest++;
        return false;
      }
      return true;
    });
    if (evt.orders.length === 0) eventOrders.delete(eventId);
  }
  console.log(`[monty] Dropped ${droppedTest} test orders after Shopify enrichment.`);

  if (eventOrders.size === 0) {
    console.log('[monty] No post-Wave 2 pending orders. Nothing to send.');
    return;
  }

  const sortedEvents = [...eventOrders.values()].sort(
    (a, b) =>
      new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
  );

  let totalOrders = 0;
  let totalValue = 0;

  const eventSections = sortedEvents
    .map((evt) => {
      totalOrders += evt.orders.length;
      const orderRows = evt.orders
        .sort(
          (a, b) =>
            new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime()
        )
        .map((o) => {
          totalValue += o.totalAmount;
          const statusLabel =
            o.fulfillmentStatus === 'partial' ? 'Teilversand' : 'Ausstehend';
          const statusColor =
            o.fulfillmentStatus === 'partial' ? '#c53030' : '#718096';
          return `<tr>
              <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${o.orderNumber}</td>
              <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #4a5568; font-size: 13px;">${o.itemsSummary}</td>
              <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${o.totalAmount.toFixed(2)} €</td>
              <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #4a5568;">${formatDateGerman(o.orderDate)}</td>
              <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: ${statusColor};">${statusLabel}</td>
            </tr>`;
        })
        .join('\n');

      return `<tr>
          <td colspan="5" style="padding: 14px 10px 8px 10px; background-color: #f7fafc; border-bottom: 2px solid #e2e8f0;">
            <strong style="color: #2F4858; font-size: 15px;">${evt.schoolName}</strong>
            <span style="color: #718096; font-size: 13px; margin-left: 8px;">
              ${formatDateGerman(evt.eventDate)} — vor ${evt.daysSinceEvent} Tagen — ${evt.orders.length} Bestellung${evt.orders.length !== 1 ? 'en' : ''}
            </span>
          </td>
        </tr>
        ${orderRows}`;
    })
    .join('\n');

  const ordersTableHtml = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 16px; font-size: 14px; border-collapse: collapse;">
      <tr style="background-color: #edf2f7;">
        <th style="padding: 8px 10px; text-align: left; color: #2F4858; font-weight: 600; border-bottom: 2px solid #cbd5e0;">Bestell-Nr.</th>
        <th style="padding: 8px 10px; text-align: left; color: #2F4858; font-weight: 600; border-bottom: 2px solid #cbd5e0;">Artikel</th>
        <th style="padding: 8px 10px; text-align: left; color: #2F4858; font-weight: 600; border-bottom: 2px solid #cbd5e0;">Betrag</th>
        <th style="padding: 8px 10px; text-align: left; color: #2F4858; font-weight: 600; border-bottom: 2px solid #cbd5e0;">Bestellt am</th>
        <th style="padding: 8px 10px; text-align: left; color: #2F4858; font-weight: 600; border-bottom: 2px solid #cbd5e0;">Status</th>
      </tr>
      ${eventSections}
    </table>`;

  const subject = `Nachzügler-Bestellungen — ${totalOrders} Bestellungen bei ${eventOrders.size} Events`;

  const html = `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; color: #2F4858;">
  <p style="margin: 0 0 16px 0; font-size: 16px;">Hi Gian,</p>

  <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #4a5568;">
    hier ist die wöchentliche Übersicht der Nachzügler-Bestellungen mit den aktualisierten Filtern — keine zurückerstatteten Bestellungen, keine Test-Bestellungen mehr enthalten.
  </p>

  <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #4a5568;">
    Die folgenden <strong>${totalOrders} Bestellungen</strong> bei <strong>${eventOrders.size} Events</strong> (Gesamtwert: <strong>${totalValue.toFixed(2)} €</strong>) sind nach Ablauf der Welle-2-Frist eingegangen oder noch nicht versendet. Diese Bestellungen werden nicht automatisch erfasst und erfordern manuelle Bearbeitung.
  </p>

  ${ordersTableHtml}

  <p style="margin: 24px 0 8px 0; color: #718096; font-size: 14px; line-height: 1.6;">
    Bitte melde dich im Admin-Portal an, um die Bestellungen zu bearbeiten.
  </p>

  <p style="margin: 32px 0 0 0; font-size: 16px; color: #2F4858;">
    From Monty
  </p>
</body>
</html>`;

  console.log(
    `[monty] Built digest: ${totalOrders} orders / ${eventOrders.size} events / ${totalValue.toFixed(2)} €`
  );

  if (DRY_RUN) {
    console.log('[monty] DRY RUN — would send to', TO_EMAIL);
    console.log('[monty] subject:', subject);
    console.log('[monty] html length:', html.length);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: TO_EMAIL,
    subject,
    html,
  });

  if (error) {
    console.error('[monty] Resend error:', error);
    process.exit(1);
  }

  console.log('[monty] Sent. messageId:', data?.id);
}

main().catch((err) => {
  console.error('[monty] Fatal:', err);
  process.exit(1);
});
