#!/usr/bin/env node
/**
 * Migrate Orders with Malformed Event IDs
 *
 * Finds orders where booking_id has double underscore (missing event_type)
 * and migrates them to the correct event ID format with 'minimusiker'.
 *
 * Usage:
 *   node scripts/migrate-malformed-event-ids.js           # Dry run (preview only)
 *   node scripts/migrate-malformed-event-ids.js --apply   # Actually apply changes
 */

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');
const crypto = require('crypto');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const ORDERS_TABLE_ID = 'tblu9AGaLSoEVwqq7';
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';

const ORDERS_FIELD_IDS = {
  booking_id: 'fldF4eBUFu5NcRYjd',
  event_id: 'fldxJwmQCsx533oe0',  // Linked record to Events table
};

const EVENTS_FIELD_IDS = {
  event_id: 'fldcNaHZyr6E5khDe',  // Primary field with generated event ID
};

// Regex to match malformed event IDs with double underscore (empty event_type)
// Pattern: evt_{school_slug}__{date}_{hash}
const MALFORMED_PATTERN = /^evt_(.+)__(\d{8})_([a-f0-9]{6})$/;

/**
 * Generate event ID (same logic as src/lib/utils/eventIdentifiers.ts)
 */
function generateEventId(schoolName, eventType, bookingDate) {
  const schoolSlug = schoolName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 30);

  const eventSlug = eventType
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 20);

  const dateOnly = bookingDate.split('T')[0];
  const dateStr = dateOnly.replace(/-/g, '');

  const hashInput = `${schoolName}|${eventType}|${bookingDate}`;
  const hash = crypto.createHash('md5').update(hashInput).digest('hex').substring(0, 6);

  return `evt_${schoolSlug}_${eventSlug}_${dateStr}_${hash}`;
}

/**
 * Convert school slug back to approximate school name
 * Note: This loses some info (capitalization, special chars) but works for ID generation
 */
function slugToName(slug) {
  return slug
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Convert YYYYMMDD to YYYY-MM-DD
 */
function formatDate(dateStr) {
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

async function migrate(applyChanges = false) {
  console.log('=== MALFORMED EVENT ID MIGRATION ===\n');
  console.log(`Mode: ${applyChanges ? 'APPLY CHANGES' : 'DRY RUN (preview only)'}\n`);

  // Fetch all orders
  console.log('Fetching orders from Airtable...');
  const allOrders = await base(ORDERS_TABLE_ID)
    .select({
      fields: ['booking_id', 'order_number', 'order_date'],
    })
    .all();

  console.log(`Total orders: ${allOrders.length}\n`);

  // Pattern to match correct event IDs (with minimusiker)
  const CORRECT_PATTERN = /^evt_(.+)_minimusiker_(\d{8})_([a-f0-9]{6})$/;

  // First pass: build a map of school_slug + date -> correct event ID
  // by finding existing orders with proper format
  const correctIdMap = new Map(); // "school_slug|date" -> correct_event_id

  for (const order of allOrders) {
    const bookingId = order.fields.booking_id;
    if (!bookingId) continue;

    const match = bookingId.match(CORRECT_PATTERN);
    if (match) {
      const [, schoolSlug, dateStr] = match;
      const key = `${schoolSlug}|${dateStr}`;
      correctIdMap.set(key, bookingId);
    }
  }

  console.log(`Found ${correctIdMap.size} correct event ID format(s) to use as targets.\n`);

  // Find orders with malformed booking_id
  const malformedOrders = [];
  const migrationMap = new Map(); // old_id -> { new_id, orders[] }

  for (const order of allOrders) {
    const bookingId = order.fields.booking_id;
    if (!bookingId) continue;

    const match = bookingId.match(MALFORMED_PATTERN);
    if (match) {
      const [, schoolSlug, dateStr, oldHash] = match;
      const key = `${schoolSlug}|${dateStr}`;

      // Try to find existing correct event ID for this school/date
      let correctEventId = correctIdMap.get(key);

      if (!correctEventId) {
        // Fall back to generating one (may have different hash)
        const schoolName = slugToName(schoolSlug);
        const bookingDate = formatDate(dateStr);
        correctEventId = generateEventId(schoolName, 'MiniMusiker', bookingDate);
        console.log(`⚠ No existing correct ID found for ${schoolSlug}/${dateStr}, generated: ${correctEventId}`);
      }

      const schoolName = slugToName(schoolSlug);
      const bookingDate = formatDate(dateStr);

      malformedOrders.push({
        recordId: order.id,
        orderNumber: order.fields.order_number,
        orderDate: order.fields.order_date,
        oldBookingId: bookingId,
        newBookingId: correctEventId,
        schoolName,
        bookingDate,
      });

      // Group by old ID for summary
      if (!migrationMap.has(bookingId)) {
        migrationMap.set(bookingId, {
          newId: correctEventId,
          schoolName,
          bookingDate,
          orders: [],
          hasExistingTarget: correctIdMap.has(key),
        });
      }
      migrationMap.get(bookingId).orders.push(order.fields.order_number);
    }
  }

  if (malformedOrders.length === 0) {
    console.log('No malformed event IDs found. All orders are using correct format.');
    return;
  }

  // Print summary by event ID
  console.log('=== MALFORMED EVENT IDS FOUND ===\n');

  for (const [oldId, data] of migrationMap) {
    console.log(`School: ${data.schoolName}`);
    console.log(`Date: ${data.bookingDate}`);
    console.log(`Old ID: ${oldId}`);
    console.log(`New ID: ${data.newId}`);
    console.log(`Target: ${data.hasExistingTarget ? '✓ Found existing orders with correct ID' : '⚠ Generated (no existing orders found)'}`);
    console.log(`Orders affected: ${data.orders.length}`);
    console.log(`Order numbers: ${data.orders.join(', ')}`);
    console.log('');
  }

  console.log(`Total orders to migrate: ${malformedOrders.length}\n`);

  if (!applyChanges) {
    console.log('=== DRY RUN COMPLETE ===');
    console.log('Run with --apply to actually update the records:');
    console.log('  node scripts/migrate-malformed-event-ids.js --apply\n');
    return;
  }

  // Apply changes
  console.log('=== APPLYING CHANGES ===\n');

  // First, build a cache of Event record IDs by event_id
  console.log('Looking up Event records...');
  const eventRecordCache = new Map(); // event_id string -> Airtable record ID

  const allEvents = await base(EVENTS_TABLE_ID)
    .select({ fields: [EVENTS_FIELD_IDS.event_id] })
    .all();

  for (const event of allEvents) {
    const eventIdValue = event.fields[EVENTS_FIELD_IDS.event_id];
    if (eventIdValue) {
      eventRecordCache.set(eventIdValue, event.id);
    }
  }
  console.log(`Found ${eventRecordCache.size} Events in cache\n`);

  let successCount = 0;
  let errorCount = 0;
  let linkedCount = 0;

  for (const order of malformedOrders) {
    try {
      // Look up the Event record ID for the correct event_id
      const eventRecordId = eventRecordCache.get(order.newBookingId);

      const updateFields = {
        [ORDERS_FIELD_IDS.booking_id]: order.newBookingId,
      };

      // Add linked record if Event exists
      if (eventRecordId) {
        updateFields[ORDERS_FIELD_IDS.event_id] = [eventRecordId];
        linkedCount++;
      }

      await base(ORDERS_TABLE_ID).update(order.recordId, updateFields);

      const linkStatus = eventRecordId ? '+ linked' : '(no Event found)';
      console.log(`✓ Updated order ${order.orderNumber}: ${order.oldBookingId} → ${order.newBookingId} ${linkStatus}`);
      successCount++;
    } catch (error) {
      console.error(`✗ Failed to update order ${order.orderNumber}: ${error.message}`);
      errorCount++;
    }

    // Rate limit: Airtable allows 5 requests/second
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  console.log('\n=== MIGRATION COMPLETE ===');
  console.log(`Successfully updated: ${successCount}`);
  console.log(`Event links added: ${linkedCount}`);
  console.log(`Failed: ${errorCount}`);
}

// Run the migration
const applyChanges = process.argv.includes('--apply');
migrate(applyChanges).catch(console.error);
