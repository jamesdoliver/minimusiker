#!/usr/bin/env node
/**
 * Fix Choir/Teacher Song Registrations
 *
 * Moves registrations and orders that point to choir/teacher_song classes
 * to the "Alle Kinder" (is_default) class for the same event.
 *
 * Usage:
 *   node scripts/fix-choir-registrations.js          # dry-run (read-only)
 *   node scripts/fix-choir-registrations.js --fix     # execute updates
 */

require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');

// =============================================================================
// TABLE IDs
// =============================================================================

const CLASSES_TABLE_ID = 'tbl17SVI5gacwOP0n';
const REGISTRATIONS_TABLE_ID = 'tblXsmPuZcePcre5u';
const ORDERS_TABLE_ID = 'tblu9AGaLSoEVwqq7';

// =============================================================================
// SETUP
// =============================================================================

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID environment variables');
  process.exit(1);
}

const airtable = new Airtable({ apiKey: AIRTABLE_API_KEY });
const base = airtable.base(AIRTABLE_BASE_ID);

const FIX_MODE = process.argv.includes('--fix');
const NON_REGISTRABLE_TYPES = ['choir', 'teacher_song'];

// =============================================================================
// DATA FETCHING
// =============================================================================

/**
 * Fetch all classes and build lookup maps
 */
async function fetchClasses() {
  console.log('Fetching all classes...');

  const classMap = new Map(); // recordId → { classType, eventRecordIds, isDefault, className }
  const eventDefaultMap = new Map(); // eventRecordId → defaultClassRecordId

  await base(CLASSES_TABLE_ID)
    .select({
      fields: ['class_id', 'class_name', 'class_type', 'is_default', 'event_id'],
    })
    .eachPage((records, fetchNextPage) => {
      for (const record of records) {
        const classType = record.get('class_type') || 'regular';
        const isDefault = Boolean(record.get('is_default'));
        const eventRecordIds = record.get('event_id') || [];
        const className = record.get('class_name') || '';
        const classId = record.get('class_id') || '';

        classMap.set(record.id, {
          classType,
          isDefault,
          eventRecordIds,
          className,
          classId,
        });

        // Build event → default class map
        if (isDefault) {
          for (const eventRecordId of eventRecordIds) {
            eventDefaultMap.set(eventRecordId, record.id);
          }
        }
      }
      fetchNextPage();
    });

  console.log(`Found ${classMap.size} classes total`);
  console.log(`Found ${eventDefaultMap.size} events with default ("Alle Kinder") classes`);

  return { classMap, eventDefaultMap };
}

/**
 * Fetch all registrations
 */
async function fetchRegistrations() {
  console.log('\nFetching all registrations...');

  const registrations = [];

  await base(REGISTRATIONS_TABLE_ID)
    .select({
      fields: ['registered_child', 'class_id', 'event_id', 'parent_id'],
    })
    .eachPage((records, fetchNextPage) => {
      for (const record of records) {
        registrations.push({
          recordId: record.id,
          childName: record.get('registered_child') || '',
          classIds: record.get('class_id') || [],
          eventIds: record.get('event_id') || [],
          parentIds: record.get('parent_id') || [],
        });
      }
      fetchNextPage();
    });

  console.log(`Found ${registrations.length} registrations total`);
  return registrations;
}

/**
 * Fetch all orders
 */
async function fetchOrders() {
  console.log('\nFetching all orders...');

  const orders = [];

  await base(ORDERS_TABLE_ID)
    .select({
      fields: ['order_id', 'class_id', 'event_id', 'order_number'],
    })
    .eachPage((records, fetchNextPage) => {
      for (const record of records) {
        orders.push({
          recordId: record.id,
          orderId: record.get('order_id') || '',
          orderNumber: record.get('order_number') || '',
          classIds: record.get('class_id') || [],
          eventIds: record.get('event_id') || [],
        });
      }
      fetchNextPage();
    });

  console.log(`Found ${orders.length} orders total`);
  return orders;
}

// =============================================================================
// ANALYSIS
// =============================================================================

/**
 * Find records pointing to non-registrable classes
 */
function findAffectedRecords(records, classMap, eventDefaultMap, recordType) {
  const affected = [];

  for (const record of records) {
    const classRecordIds = record.classIds;
    if (!classRecordIds || classRecordIds.length === 0) continue;

    const classRecordId = classRecordIds[0]; // Linked record → first entry
    const classInfo = classMap.get(classRecordId);
    if (!classInfo) continue;

    if (!NON_REGISTRABLE_TYPES.includes(classInfo.classType)) continue;

    // This record points to a choir/teacher_song class
    const eventRecordId = classInfo.eventRecordIds[0];
    const defaultClassRecordId = eventDefaultMap.get(eventRecordId);

    const defaultClassInfo = defaultClassRecordId ? classMap.get(defaultClassRecordId) : null;

    affected.push({
      recordId: record.recordId,
      recordType,
      childName: record.childName || record.orderNumber || record.orderId || '(unknown)',
      fromClassRecordId: classRecordId,
      fromClassName: classInfo.className,
      fromClassType: classInfo.classType,
      toClassRecordId: defaultClassRecordId,
      toClassName: defaultClassInfo ? defaultClassInfo.className : null,
      eventRecordId,
      hasDefault: Boolean(defaultClassRecordId),
    });
  }

  return affected;
}

// =============================================================================
// UPDATE
// =============================================================================

/**
 * Update records to point to default class, in batches of 10
 */
async function updateRecords(affected, tableName, tableId) {
  const updatable = affected.filter(r => r.hasDefault);
  const skipped = affected.filter(r => !r.hasDefault);

  if (skipped.length > 0) {
    console.log(`\n  WARNING: Skipping ${skipped.length} ${tableName} - no "Alle Kinder" class found:`);
    for (const r of skipped) {
      console.log(`    - ${r.childName} (${r.fromClassName}) [event: ${r.eventRecordId}]`);
    }
  }

  if (updatable.length === 0) {
    console.log(`\n  No ${tableName} to update.`);
    return;
  }

  console.log(`\n  Updating ${updatable.length} ${tableName}...`);

  if (!FIX_MODE) {
    for (const r of updatable) {
      console.log(`    [DRY RUN] Would move: ${r.childName} from "${r.fromClassName}" (${r.fromClassType}) → "${r.toClassName}"`);
    }
    return;
  }

  // Batch updates (Airtable limit: 10 per request)
  for (let i = 0; i < updatable.length; i += 10) {
    const batch = updatable.slice(i, i + 10);
    const updates = batch.map(r => ({
      id: r.recordId,
      fields: {
        class_id: [r.toClassRecordId],
      },
    }));

    await base(tableId).update(updates);
    console.log(`    Updated batch ${Math.floor(i / 10) + 1}/${Math.ceil(updatable.length / 10)}`);
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('='.repeat(70));
  console.log('Fix Choir/Teacher Song Registrations');
  console.log(`Mode: ${FIX_MODE ? '*** LIVE FIX ***' : 'DRY RUN (read-only)'}`);
  console.log('='.repeat(70));

  // 1. Fetch all classes
  const { classMap, eventDefaultMap } = await fetchClasses();

  // Show non-registrable classes found
  const nonRegistrableClasses = [...classMap.entries()]
    .filter(([, info]) => NON_REGISTRABLE_TYPES.includes(info.classType));
  console.log(`\nNon-registrable classes found: ${nonRegistrableClasses.length}`);
  for (const [recordId, info] of nonRegistrableClasses) {
    const hasDefault = info.eventRecordIds.some(eid => eventDefaultMap.has(eid));
    console.log(`  - ${info.className} (${info.classType}) [record: ${recordId}] ${hasDefault ? '✓ has default' : '⚠ NO default'}`);
  }

  // 2. Fetch registrations and orders
  const registrations = await fetchRegistrations();
  const orders = await fetchOrders();

  // 3. Find affected records
  const affectedRegistrations = findAffectedRecords(registrations, classMap, eventDefaultMap, 'registration');
  const affectedOrders = findAffectedRecords(orders, classMap, eventDefaultMap, 'order');

  console.log('\n' + '='.repeat(70));
  console.log('RESULTS');
  console.log('='.repeat(70));
  console.log(`Affected registrations: ${affectedRegistrations.length}`);
  console.log(`Affected orders: ${affectedOrders.length}`);

  if (affectedRegistrations.length === 0 && affectedOrders.length === 0) {
    console.log('\nNo records need updating. All clear!');
    return;
  }

  // 4. Print audit log
  const auditLog = {
    timestamp: new Date().toISOString(),
    mode: FIX_MODE ? 'fix' : 'dry-run',
    registrations: affectedRegistrations,
    orders: affectedOrders,
  };
  console.log('\n--- AUDIT LOG (JSON) ---');
  console.log(JSON.stringify(auditLog, null, 2));
  console.log('--- END AUDIT LOG ---\n');

  // 5. Execute updates
  await updateRecords(affectedRegistrations, 'registrations', REGISTRATIONS_TABLE_ID);
  await updateRecords(affectedOrders, 'orders', ORDERS_TABLE_ID);

  console.log('\n' + '='.repeat(70));
  console.log(FIX_MODE ? 'DONE - Updates applied.' : 'DONE - Dry run complete. Use --fix to apply changes.');
  console.log('='.repeat(70));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
