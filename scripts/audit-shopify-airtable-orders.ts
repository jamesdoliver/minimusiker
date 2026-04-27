/**
 * Read-only audit: compare Shopify orders against the Airtable Orders table.
 *
 * Fetches every order from both sources, joins on Shopify GID, and reports:
 *   - count totals + orphans (one side missing)
 *   - payment_status / refund_amount mismatches (refunds the webhook missed)
 *   - fulfillment_status / cancel_reason / is_test mismatches
 *   - "silent refunds": Shopify says money was refunded, Airtable doesn't reflect it
 *
 * Usage:
 *   npx tsx scripts/audit-shopify-airtable-orders.ts
 *   npx tsx scripts/audit-shopify-airtable-orders.ts --json   # machine-readable
 *   npx tsx scripts/audit-shopify-airtable-orders.ts --since=2024-01-01
 */

require('dotenv').config({ path: '.env.local' });

if (!process.env.SHOPIFY_STORE_DOMAIN && process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN) {
  process.env.SHOPIFY_STORE_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
}

import Airtable from 'airtable';
import { ORDERS_TABLE_ID, ORDERS_FIELD_IDS } from '../src/lib/types/airtable';
import { tokenManager } from '../src/lib/services/shopifyTokenManager';

const JSON_OUTPUT = process.argv.includes('--json');
const SINCE_ARG = process.argv.find((a) => a.startsWith('--since='));
const SINCE_DATE = SINCE_ARG ? SINCE_ARG.split('=')[1] : null;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
const SAMPLE_LIMIT = 8;

interface ShopifyOrder {
  id: string;
  name: string;
  createdAt: string;
  test: boolean;
  closedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  totalPriceSet: { shopMoney: { amount: string } };
  totalRefundedSet: { shopMoney: { amount: string } };
}

interface AirtableOrder {
  recordId: string;
  gid: string;
  orderNumber: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  totalAmount: number;
  refundAmount: number;
  cancelReason: string;
  isTest: boolean;
  orderDate: string;
}

async function shopifyGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = await tokenManager.getAccessToken();
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN!;
  const url = `https://${storeDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`Shopify GraphQL: ${JSON.stringify(json.errors)}`);
  return json.data as T;
}

async function fetchAllShopifyOrders(): Promise<ShopifyOrder[]> {
  const orders: ShopifyOrder[] = [];
  let cursor: string | null = null;
  let page = 0;
  const queryFilter = SINCE_DATE ? `created_at:>=${SINCE_DATE}` : null;

  const gql = `
    query AuditOrders($first: Int!, $after: String, $query: String) {
      orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT) {
        edges {
          node {
            id
            name
            createdAt
            test
            closedAt
            cancelledAt
            cancelReason
            displayFinancialStatus
            displayFulfillmentStatus
            totalPriceSet { shopMoney { amount } }
            totalRefundedSet { shopMoney { amount } }
          }
          cursor
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;

  while (true) {
    page++;
    const data = await shopifyGraphQL<{
      orders: {
        edges: Array<{ node: ShopifyOrder }>;
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    }>(gql, { first: 250, after: cursor, query: queryFilter });

    for (const edge of data.orders.edges) orders.push(edge.node);
    if (!JSON_OUTPUT) {
      process.stderr.write(`\r[shopify] page ${page} → ${orders.length} orders`);
    }
    if (!data.orders.pageInfo.hasNextPage) break;
    cursor = data.orders.pageInfo.endCursor;
  }
  if (!JSON_OUTPUT) process.stderr.write('\n');
  return orders;
}

async function fetchAllAirtableOrders(): Promise<AirtableOrder[]> {
  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID!
  );
  const records = await base(ORDERS_TABLE_ID)
    .select({ returnFieldsByFieldId: true })
    .all();

  return records.map((r) => ({
    recordId: r.id,
    gid: (r.get(ORDERS_FIELD_IDS.order_id) as string) || '',
    orderNumber: (r.get(ORDERS_FIELD_IDS.order_number) as string) || '',
    paymentStatus: (r.get(ORDERS_FIELD_IDS.payment_status) as string) || '',
    fulfillmentStatus:
      (r.get(ORDERS_FIELD_IDS.fulfillment_status) as string) || '',
    totalAmount: (r.get(ORDERS_FIELD_IDS.total_amount) as number) || 0,
    refundAmount: (r.get(ORDERS_FIELD_IDS.refund_amount) as number) || 0,
    cancelReason: (r.get(ORDERS_FIELD_IDS.cancel_reason) as string) || '',
    isTest: r.get(ORDERS_FIELD_IDS.is_test) === true,
    orderDate: (r.get(ORDERS_FIELD_IDS.order_date) as string) || '',
  }));
}

function normalizeFinancial(s: string | null): string {
  // GraphQL: PAID, REFUNDED, PARTIALLY_REFUNDED, VOIDED, AUTHORIZED, PARTIALLY_PAID, PENDING
  // Airtable: paid, refunded, partially_refunded, voided, pending
  if (!s) return '';
  const u = s.toUpperCase();
  if (u === 'PAID' || u === 'PARTIALLY_PAID') return 'paid';
  if (u === 'REFUNDED') return 'refunded';
  if (u === 'PARTIALLY_REFUNDED') return 'partially_refunded';
  if (u === 'VOIDED') return 'voided';
  return 'pending';
}

function normalizeFulfillment(s: string | null): string {
  if (!s) return 'pending';
  const u = s.toUpperCase();
  if (u === 'FULFILLED') return 'fulfilled';
  if (u === 'PARTIALLY_FULFILLED' || u === 'PARTIAL') return 'partial';
  return 'pending';
}

function normalizeCancelReason(s: string | null): string {
  return (s || '').toLowerCase();
}

interface Mismatch {
  gid: string;
  orderNumber: string;
  shopify: unknown;
  airtable: unknown;
}

interface AuditReport {
  shopifyTotal: number;
  airtableTotal: number;
  joined: number;
  shopifyOnly: Array<Pick<ShopifyOrder, 'id' | 'name' | 'createdAt' | 'displayFinancialStatus'>>;
  airtableOnly: Array<{ recordId: string; gid: string; orderNumber: string; orderDate: string }>;
  mismatches: {
    paymentStatus: Mismatch[];
    fulfillmentStatus: Mismatch[];
    refundAmount: Mismatch[];
    cancelReason: Mismatch[];
    isTest: Mismatch[];
  };
  silentRefunds: {
    shopifyRefundedAirtableNot: Mismatch[]; // financial_status conflicts
    refundAmountPositiveAirtableZero: Mismatch[]; // money refunded but amount field doesn't show it
  };
  archivedTestOrders: Array<{ gid: string; name: string; closedAt: string | null }>;
}

function buildReport(shopify: ShopifyOrder[], airtable: AirtableOrder[]): AuditReport {
  const airtableByGid = new Map<string, AirtableOrder>();
  for (const o of airtable) {
    if (o.gid) airtableByGid.set(o.gid, o);
  }
  const shopifyByGid = new Map<string, ShopifyOrder>();
  for (const o of shopify) shopifyByGid.set(o.id, o);

  const r: AuditReport = {
    shopifyTotal: shopify.length,
    airtableTotal: airtable.length,
    joined: 0,
    shopifyOnly: [],
    airtableOnly: [],
    mismatches: {
      paymentStatus: [],
      fulfillmentStatus: [],
      refundAmount: [],
      cancelReason: [],
      isTest: [],
    },
    silentRefunds: {
      shopifyRefundedAirtableNot: [],
      refundAmountPositiveAirtableZero: [],
    },
    archivedTestOrders: [],
  };

  for (const s of shopify) {
    if (s.test === true && s.closedAt) {
      r.archivedTestOrders.push({ gid: s.id, name: s.name, closedAt: s.closedAt });
    }

    const a = airtableByGid.get(s.id);
    if (!a) {
      r.shopifyOnly.push({
        id: s.id,
        name: s.name,
        createdAt: s.createdAt,
        displayFinancialStatus: s.displayFinancialStatus,
      });
      continue;
    }
    r.joined++;

    const sPay = normalizeFinancial(s.displayFinancialStatus);
    const aPay = (a.paymentStatus || '').toLowerCase();
    if (sPay !== aPay) {
      r.mismatches.paymentStatus.push({
        gid: s.id,
        orderNumber: s.name,
        shopify: s.displayFinancialStatus,
        airtable: a.paymentStatus,
      });
    }

    const sFul = normalizeFulfillment(s.displayFulfillmentStatus);
    const aFul = (a.fulfillmentStatus || '').toLowerCase();
    if (sFul !== aFul) {
      r.mismatches.fulfillmentStatus.push({
        gid: s.id,
        orderNumber: s.name,
        shopify: s.displayFulfillmentStatus,
        airtable: a.fulfillmentStatus,
      });
    }

    const sRefund = parseFloat(s.totalRefundedSet?.shopMoney?.amount || '0');
    const aRefund = a.refundAmount;
    if (Math.abs(sRefund - aRefund) > 0.01) {
      r.mismatches.refundAmount.push({
        gid: s.id,
        orderNumber: s.name,
        shopify: sRefund,
        airtable: aRefund,
      });
      if (sRefund > 0.01 && aRefund < 0.01) {
        r.silentRefunds.refundAmountPositiveAirtableZero.push({
          gid: s.id,
          orderNumber: s.name,
          shopify: sRefund,
          airtable: aRefund,
        });
      }
    }

    if (sPay === 'refunded' || sPay === 'partially_refunded') {
      if (aPay !== 'refunded' && aPay !== 'partially_refunded') {
        r.silentRefunds.shopifyRefundedAirtableNot.push({
          gid: s.id,
          orderNumber: s.name,
          shopify: s.displayFinancialStatus,
          airtable: a.paymentStatus || '(blank)',
        });
      }
    }

    const sCancel = normalizeCancelReason(s.cancelReason);
    const aCancel = normalizeCancelReason(a.cancelReason);
    if (sCancel !== aCancel) {
      r.mismatches.cancelReason.push({
        gid: s.id,
        orderNumber: s.name,
        shopify: s.cancelReason || '(none)',
        airtable: a.cancelReason || '(none)',
      });
    }

    const sTest = s.test === true;
    const aTest = a.isTest === true;
    if (sTest !== aTest) {
      r.mismatches.isTest.push({
        gid: s.id,
        orderNumber: s.name,
        shopify: sTest,
        airtable: aTest,
      });
    }
  }

  for (const a of airtable) {
    if (!a.gid) continue;
    if (!shopifyByGid.has(a.gid)) {
      r.airtableOnly.push({
        recordId: a.recordId,
        gid: a.gid,
        orderNumber: a.orderNumber,
        orderDate: a.orderDate,
      });
    }
  }

  return r;
}

function printReport(r: AuditReport): void {
  if (JSON_OUTPUT) {
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  const sample = <T,>(arr: T[]): T[] => arr.slice(0, SAMPLE_LIMIT);

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  Shopify ↔ Airtable Order Audit');
  console.log('══════════════════════════════════════════════════════════════\n');

  console.log(`Shopify orders fetched:  ${r.shopifyTotal}`);
  console.log(`Airtable orders fetched: ${r.airtableTotal}`);
  console.log(`Joined by GID:           ${r.joined}\n`);

  console.log(`─── Orphans ────────────────────────────────────────────────`);
  console.log(`Shopify-only (not in Airtable):  ${r.shopifyOnly.length}`);
  for (const o of sample(r.shopifyOnly)) {
    console.log(`  ${o.name}  ${o.createdAt.slice(0, 10)}  ${o.displayFinancialStatus}  ${o.id}`);
  }
  if (r.shopifyOnly.length > SAMPLE_LIMIT) console.log(`  … +${r.shopifyOnly.length - SAMPLE_LIMIT} more`);

  console.log(`\nAirtable-only (not in Shopify): ${r.airtableOnly.length}`);
  for (const o of sample(r.airtableOnly)) {
    console.log(`  ${o.orderNumber}  ${o.orderDate.slice(0, 10)}  ${o.gid}`);
  }
  if (r.airtableOnly.length > SAMPLE_LIMIT) console.log(`  … +${r.airtableOnly.length - SAMPLE_LIMIT} more`);

  console.log(`\n─── Silent Refunds (the issue Gian flagged) ────────────────`);
  console.log(`Shopify says refunded, Airtable doesn't: ${r.silentRefunds.shopifyRefundedAirtableNot.length}`);
  for (const m of sample(r.silentRefunds.shopifyRefundedAirtableNot)) {
    console.log(`  ${m.orderNumber}  shopify=${m.shopify}  airtable=${m.airtable}`);
  }
  if (r.silentRefunds.shopifyRefundedAirtableNot.length > SAMPLE_LIMIT) {
    console.log(`  … +${r.silentRefunds.shopifyRefundedAirtableNot.length - SAMPLE_LIMIT} more`);
  }

  console.log(`\nMoney refunded in Shopify, refund_amount=0 in Airtable: ${r.silentRefunds.refundAmountPositiveAirtableZero.length}`);
  for (const m of sample(r.silentRefunds.refundAmountPositiveAirtableZero)) {
    console.log(`  ${m.orderNumber}  shopify=€${(m.shopify as number).toFixed(2)}  airtable=€${(m.airtable as number).toFixed(2)}`);
  }
  if (r.silentRefunds.refundAmountPositiveAirtableZero.length > SAMPLE_LIMIT) {
    console.log(`  … +${r.silentRefunds.refundAmountPositiveAirtableZero.length - SAMPLE_LIMIT} more`);
  }

  console.log(`\n─── Field Mismatches (Shopify vs Airtable) ─────────────────`);
  console.log(`payment_status:     ${r.mismatches.paymentStatus.length}`);
  for (const m of sample(r.mismatches.paymentStatus)) {
    console.log(`  ${m.orderNumber}  shopify=${m.shopify}  airtable=${m.airtable || '(blank)'}`);
  }
  if (r.mismatches.paymentStatus.length > SAMPLE_LIMIT) console.log(`  … +${r.mismatches.paymentStatus.length - SAMPLE_LIMIT} more`);

  console.log(`\nfulfillment_status: ${r.mismatches.fulfillmentStatus.length}`);
  for (const m of sample(r.mismatches.fulfillmentStatus)) {
    console.log(`  ${m.orderNumber}  shopify=${m.shopify}  airtable=${m.airtable || '(blank)'}`);
  }
  if (r.mismatches.fulfillmentStatus.length > SAMPLE_LIMIT) console.log(`  … +${r.mismatches.fulfillmentStatus.length - SAMPLE_LIMIT} more`);

  console.log(`\nrefund_amount:      ${r.mismatches.refundAmount.length}`);
  for (const m of sample(r.mismatches.refundAmount)) {
    console.log(`  ${m.orderNumber}  shopify=€${(m.shopify as number).toFixed(2)}  airtable=€${(m.airtable as number).toFixed(2)}`);
  }
  if (r.mismatches.refundAmount.length > SAMPLE_LIMIT) console.log(`  … +${r.mismatches.refundAmount.length - SAMPLE_LIMIT} more`);

  console.log(`\ncancel_reason:      ${r.mismatches.cancelReason.length}`);
  for (const m of sample(r.mismatches.cancelReason)) {
    console.log(`  ${m.orderNumber}  shopify=${m.shopify}  airtable=${m.airtable}`);
  }
  if (r.mismatches.cancelReason.length > SAMPLE_LIMIT) console.log(`  … +${r.mismatches.cancelReason.length - SAMPLE_LIMIT} more`);

  console.log(`\nis_test:            ${r.mismatches.isTest.length}`);
  for (const m of sample(r.mismatches.isTest)) {
    console.log(`  ${m.orderNumber}  shopify=${m.shopify}  airtable=${m.airtable}`);
  }
  if (r.mismatches.isTest.length > SAMPLE_LIMIT) console.log(`  … +${r.mismatches.isTest.length - SAMPLE_LIMIT} more`);

  console.log(`\n─── Archived Test Orders (in Shopify) ──────────────────────`);
  console.log(`Test orders that have been archived: ${r.archivedTestOrders.length}`);
  for (const o of sample(r.archivedTestOrders)) {
    console.log(`  ${o.name}  closed=${o.closedAt?.slice(0, 10)}  ${o.gid}`);
  }
  if (r.archivedTestOrders.length > SAMPLE_LIMIT) console.log(`  … +${r.archivedTestOrders.length - SAMPLE_LIMIT} more`);

  console.log('\n══════════════════════════════════════════════════════════════\n');
}

async function main() {
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    throw new Error('Missing Airtable env vars');
  }
  if (!process.env.SHOPIFY_STORE_DOMAIN) {
    throw new Error('Missing SHOPIFY_STORE_DOMAIN');
  }

  if (!JSON_OUTPUT) {
    process.stderr.write(`[audit] Fetching Shopify orders${SINCE_DATE ? ` since ${SINCE_DATE}` : ''}…\n`);
  }
  const [shopify, airtable] = await Promise.all([
    fetchAllShopifyOrders(),
    fetchAllAirtableOrders(),
  ]);
  if (!JSON_OUTPUT) {
    process.stderr.write(`[audit] Building report…\n`);
  }
  const report = buildReport(shopify, airtable);
  printReport(report);
}

main().catch((err) => {
  console.error('[audit] Fatal:', err);
  process.exit(1);
});
