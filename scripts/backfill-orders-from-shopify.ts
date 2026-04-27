/**
 * One-shot: resync the Airtable Orders table from Shopify.
 *
 * For every Airtable order with a Shopify GID, fetch the canonical Shopify
 * state and overwrite mirrored fields. Same logic as the
 * /api/admin/orders/backfill-from-shopify endpoint, runnable from local.
 *
 * Usage:
 *   npx tsx scripts/backfill-orders-from-shopify.ts            # write
 *   npx tsx scripts/backfill-orders-from-shopify.ts --dry-run  # report only
 */

require('dotenv').config({ path: '.env.local' });

if (!process.env.SHOPIFY_STORE_DOMAIN && process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN) {
  process.env.SHOPIFY_STORE_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
}

import Airtable, { FieldSet } from 'airtable';
import { ORDERS_TABLE_ID, ORDERS_FIELD_IDS } from '../src/lib/types/airtable';
import { shopifyAdminService } from '../src/lib/services/shopifyAdminService';
import {
  diffShopifyVsAirtable,
  type ExistingAirtableOrderFields,
} from '../src/lib/utils/shopifyOrderSync';

const DRY_RUN = process.argv.includes('--dry-run');
const SHOPIFY_BATCH = 50;
const AIRTABLE_BATCH = 10;

interface PendingUpdate {
  recordId: string;
  orderNumber: string;
  gid: string;
  existing: ExistingAirtableOrderFields;
}

async function main() {
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    throw new Error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID');
  }
  if (!process.env.SHOPIFY_STORE_DOMAIN) {
    throw new Error('Missing SHOPIFY_STORE_DOMAIN');
  }

  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID
  );

  console.log('[backfill] Fetching all Airtable orders…');
  const allRecords = await base(ORDERS_TABLE_ID)
    .select({ returnFieldsByFieldId: true })
    .all();

  const pending: PendingUpdate[] = [];
  let withoutGid = 0;
  for (const r of allRecords) {
    const gid = r.get(ORDERS_FIELD_IDS.order_id) as string | undefined;
    if (!gid || !gid.startsWith('gid://shopify/Order/')) {
      withoutGid++;
      continue;
    }
    pending.push({
      recordId: r.id,
      orderNumber: (r.get(ORDERS_FIELD_IDS.order_number) as string) || '—',
      gid,
      existing: {
        payment_status: r.get(ORDERS_FIELD_IDS.payment_status) as string | undefined,
        fulfillment_status: r.get(ORDERS_FIELD_IDS.fulfillment_status) as string | undefined,
        refund_amount: r.get(ORDERS_FIELD_IDS.refund_amount) as number | undefined,
        cancel_reason: r.get(ORDERS_FIELD_IDS.cancel_reason) as string | undefined,
        is_test: r.get(ORDERS_FIELD_IDS.is_test) === true,
      },
    });
  }
  console.log(
    `[backfill] ${pending.length} orders with GID, ${withoutGid} without GID (skipped)`
  );

  const updates: Array<{
    id: string;
    fields: Partial<FieldSet>;
    orderNumber: string;
    changed: string[];
  }> = [];
  const fieldChangeCounts: Record<string, number> = {};
  let resolved = 0;
  let unchanged = 0;
  let missing = 0;

  for (let i = 0; i < pending.length; i += SHOPIFY_BATCH) {
    const chunk = pending.slice(i, i + SHOPIFY_BATCH);
    const ids = chunk.map((p) => p.gid);
    process.stderr.write(
      `\r[backfill] Fetching Shopify ${Math.min(i + SHOPIFY_BATCH, pending.length)}/${pending.length}`
    );
    const snapshots = await shopifyAdminService.getOrdersSyncSnapshot(ids);
    for (const item of chunk) {
      const snap = snapshots.get(item.gid);
      if (!snap) {
        missing++;
        continue;
      }
      resolved++;
      const diff = diffShopifyVsAirtable(snap, item.existing);
      if (!diff) {
        unchanged++;
        continue;
      }
      for (const f of diff.changed) {
        fieldChangeCounts[f] = (fieldChangeCounts[f] || 0) + 1;
      }
      updates.push({
        id: item.recordId,
        fields: diff.fields as Partial<FieldSet>,
        orderNumber: item.orderNumber,
        changed: diff.changed.map(String),
      });
    }
  }
  process.stderr.write('\n');

  console.log('\n──────── Diff summary ────────');
  console.log(`  Airtable orders with GID:   ${pending.length}`);
  console.log(`  Resolved from Shopify:      ${resolved}`);
  console.log(`  Missing from Shopify:       ${missing}`);
  console.log(`  Already in sync:            ${unchanged}`);
  console.log(`  Need update:                ${updates.length}`);
  console.log(`\n  Field change counts:`);
  for (const [k, v] of Object.entries(fieldChangeCounts)) {
    console.log(`    ${k.padEnd(20)} ${v}`);
  }

  console.log(`\n  First 10 changes (preview):`);
  for (const u of updates.slice(0, 10)) {
    console.log(`    ${u.orderNumber.padEnd(8)} ${u.changed.join(', ')}`);
  }
  if (updates.length > 10) console.log(`    … +${updates.length - 10} more`);
  console.log('───────────────────────────────\n');

  if (DRY_RUN) {
    console.log('[backfill] DRY RUN — no writes performed.');
    return;
  }

  console.log(`[backfill] Writing ${updates.length} updates to Airtable…`);
  let written = 0;
  for (let i = 0; i < updates.length; i += AIRTABLE_BATCH) {
    const batch = updates
      .slice(i, i + AIRTABLE_BATCH)
      .map((u) => ({ id: u.id, fields: u.fields }));
    await base(ORDERS_TABLE_ID).update(batch);
    written += batch.length;
    process.stderr.write(`\r[backfill] Wrote ${written}/${updates.length}`);
  }
  process.stderr.write('\n');
  console.log(`[backfill] Done. Updated ${written} records.`);
}

main().catch((err) => {
  console.error('[backfill] Fatal:', err);
  process.exit(1);
});
