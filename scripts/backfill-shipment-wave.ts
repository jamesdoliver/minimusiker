/**
 * Backfill script: Populate shipment_wave on existing Orders in Airtable.
 *
 * Fetches all orders, parses their line_items JSON, classifies each order
 * using computeShipmentWave(), and updates orders that don't already have
 * a shipment_wave set.
 *
 * Usage:
 *   npx tsx scripts/backfill-shipment-wave.ts
 *   npx tsx scripts/backfill-shipment-wave.ts --dry-run
 */

import { config } from 'dotenv';
import { computeShipmentWave } from '../src/lib/config/variantClassification';
import { ORDERS_TABLE_ID, ORDERS_FIELD_IDS } from '../src/lib/types/airtable';

config({ path: '.env.local' });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in .env.local');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Airtable REST helpers
// ---------------------------------------------------------------------------

const BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ORDERS_TABLE_ID}`;

const headers: HeadersInit = {
  Authorization: `Bearer ${AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json',
};

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

/**
 * Fetch all records from the Orders table, paginating through all results.
 * Only requests the fields we need (order_number, line_items, shipment_wave).
 */
async function fetchAllOrders(): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({
      'fields[]': ORDERS_FIELD_IDS.order_number,
      returnFieldsByFieldId: 'true',
      pageSize: '100',
    });
    // Append additional fields (URLSearchParams only keeps last for duplicate keys)
    params.append('fields[]', ORDERS_FIELD_IDS.line_items);
    params.append('fields[]', ORDERS_FIELD_IDS.shipment_wave);

    if (offset) {
      params.set('offset', offset);
    }

    const url = `${BASE_URL}?${params.toString()}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable fetch failed: ${response.status} ${errorText}`);
    }

    const data: AirtableListResponse = await response.json();
    allRecords.push(...data.records);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

/**
 * Update records in batches of 10 (Airtable's max per request).
 */
async function updateRecordsBatch(
  updates: Array<{ id: string; fields: Record<string, unknown> }>,
): Promise<void> {
  const response = await fetch(BASE_URL, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ records: updates }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Airtable update failed: ${response.status} ${errorText}`);
  }
}

/**
 * Pause for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface BackfillStats {
  total: number;
  skippedAlreadySet: number;
  skippedNoLineItems: number;
  skippedNoWave: number;
  updated: number;
  errors: number;
}

async function backfillShipmentWave(dryRun: boolean) {
  const stats: BackfillStats = {
    total: 0,
    skippedAlreadySet: 0,
    skippedNoLineItems: 0,
    skippedNoWave: 0,
    updated: 0,
    errors: 0,
  };

  console.log('\n=== Backfill shipment_wave on Existing Orders ===\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE UPDATE'}\n`);

  // Step 1: Fetch all orders
  console.log('Fetching all orders from Airtable...');
  const allOrders = await fetchAllOrders();
  stats.total = allOrders.length;
  console.log(`Found ${stats.total} total orders.\n`);

  // Step 2: Classify each order and collect updates
  const pendingUpdates: Array<{ id: string; fields: Record<string, unknown> }> = [];

  for (const record of allOrders) {
    const orderNumber = record.fields[ORDERS_FIELD_IDS.order_number] as string | number | undefined;
    const existingWave = record.fields[ORDERS_FIELD_IDS.shipment_wave] as string | undefined;
    const lineItemsRaw = record.fields[ORDERS_FIELD_IDS.line_items] as string | undefined;

    const label = orderNumber ? `#${orderNumber}` : record.id;

    // Skip orders that already have a wave set
    if (existingWave) {
      stats.skippedAlreadySet++;
      continue;
    }

    // Skip orders with no line_items data
    if (!lineItemsRaw) {
      stats.skippedNoLineItems++;
      continue;
    }

    // Parse line_items JSON
    let lineItems: Array<{ variant_id: string; quantity: number }>;
    try {
      lineItems = JSON.parse(lineItemsRaw);
    } catch {
      console.log(`  [SKIP] Order ${label}: invalid line_items JSON`);
      stats.skippedNoLineItems++;
      continue;
    }

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      stats.skippedNoLineItems++;
      continue;
    }

    // Compute wave
    const wave = computeShipmentWave(lineItems);

    if (!wave) {
      stats.skippedNoWave++;
      continue;
    }

    console.log(`Processing order ${label}... -> ${wave}`);

    pendingUpdates.push({
      id: record.id,
      fields: {
        [ORDERS_FIELD_IDS.shipment_wave]: wave,
      },
    });
  }

  console.log(`\nOrders to update: ${pendingUpdates.length}`);

  if (dryRun) {
    console.log('Dry run — no updates performed.\n');
  } else {
    // Step 3: Send updates in batches of 10
    const BATCH_SIZE = 10;
    const totalBatches = Math.ceil(pendingUpdates.length / BATCH_SIZE);

    for (let i = 0; i < pendingUpdates.length; i += BATCH_SIZE) {
      const batch = pendingUpdates.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      try {
        await updateRecordsBatch(batch);
        stats.updated += batch.length;
        console.log(`  Batch ${batchNum}/${totalBatches}: updated ${batch.length} records`);
      } catch (error) {
        stats.errors += batch.length;
        console.error(
          `  Batch ${batchNum}/${totalBatches}: FAILED — ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Rate-limit: wait 250ms between batches to stay within Airtable limits
      if (i + BATCH_SIZE < pendingUpdates.length) {
        await sleep(250);
      }
    }

    console.log('');
  }

  // Summary
  console.log('=== Summary ===\n');
  console.log(`Total orders:              ${stats.total}`);
  console.log(`Already had wave (skipped): ${stats.skippedAlreadySet}`);
  console.log(`No line_items (skipped):    ${stats.skippedNoLineItems}`);
  console.log(`No classifiable wave:       ${stats.skippedNoWave}`);
  console.log(`${dryRun ? 'Would update' : 'Updated'}:              ${dryRun ? pendingUpdates.length : stats.updated}`);
  if (stats.errors > 0) {
    console.log(`Errors:                     ${stats.errors}`);
  }
  console.log('\nDone.\n');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

backfillShipmentWave(dryRun)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
