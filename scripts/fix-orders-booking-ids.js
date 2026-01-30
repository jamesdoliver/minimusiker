/**
 * Fix Orders with Wrong Booking IDs
 *
 * This script finds Orders that have booking_ids referencing non-existent Events
 * and updates them to use the correct normalized booking_id.
 *
 * Problem: Some orders have booking_id = "evt_..._minimusikertag_..." but
 * the Event table only has "evt_..._minimusiker_..." (normalized)
 *
 * Usage:
 *   node scripts/fix-orders-booking-ids.js --dry-run    # Preview changes
 *   node scripts/fix-orders-booking-ids.js              # Execute fix
 */

require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');
const crypto = require('crypto');

// =============================================================================
// TABLE IDs
// =============================================================================

const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
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

const DRY_RUN = process.argv.includes('--dry-run');

// =============================================================================
// ID GENERATION (with normalization)
// =============================================================================

function normalizeEventTypeForId(eventType) {
  if (!eventType) return 'minimusiker';
  const normalized = eventType.toLowerCase().trim();
  if (
    normalized.includes('minimusik') ||
    normalized.includes('mini musik') ||
    normalized === 'concert'
  ) {
    return 'minimusiker';
  }
  return 'minimusiker';
}

function generateCorrectEventId(schoolName, bookingDate) {
  const normalizedEventType = normalizeEventTypeForId('MiniMusiker');

  const schoolSlug = schoolName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 30);

  const eventSlug = normalizedEventType
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 20);

  let dateStr = '';
  if (bookingDate) {
    const dateOnly = bookingDate.split('T')[0];
    dateStr = dateOnly.replace(/-/g, '');
  }

  const hashInput = `${schoolName}|${normalizedEventType}|${bookingDate || ''}`;
  const hash = crypto.createHash('md5').update(hashInput).digest('hex').substring(0, 6);

  if (dateStr) {
    return `evt_${schoolSlug}_${eventSlug}_${dateStr}_${hash}`;
  }
  return `evt_${schoolSlug}_${eventSlug}_${hash}`;
}

// =============================================================================
// MAIN FIX
// =============================================================================

async function fixOrdersBookingIds() {
  console.log('\n========================================');
  console.log('  Fix Orders with Wrong Booking IDs');
  console.log('========================================');
  if (DRY_RUN) {
    console.log('  ** DRY RUN MODE - No changes will be made **');
  }
  console.log('========================================\n');

  // Fetch all Events to build lookup maps
  console.log('Fetching Events...');
  const eventsMap = new Map();           // event_id -> event
  const eventsBySchoolDate = new Map();  // "school_name|event_date" -> event

  await base(EVENTS_TABLE_ID)
    .select({ fields: ['event_id', 'school_name', 'event_date'] })
    .eachPage((records, next) => {
      for (const r of records) {
        const eventId = r.get('event_id');
        const schoolName = r.get('school_name');
        const eventDate = r.get('event_date');

        if (eventId) {
          const event = {
            recordId: r.id,
            eventId,
            schoolName,
            eventDate
          };
          eventsMap.set(eventId, event);

          // Also index by school_name + event_date for fuzzy matching
          if (schoolName && eventDate) {
            const key = `${schoolName.toLowerCase()}|${eventDate}`;
            eventsBySchoolDate.set(key, event);
          }
        }
      }
      next();
    });

  console.log(`Found ${eventsMap.size} Events\n`);

  // Fetch all Orders
  console.log('Fetching Orders...');
  const orders = [];

  await base(ORDERS_TABLE_ID)
    .select({ fields: ['booking_id', 'school_name', 'event_id', 'order_number'] })
    .eachPage((records, next) => {
      for (const r of records) {
        orders.push({
          recordId: r.id,
          bookingId: r.get('booking_id'),
          schoolName: r.get('school_name'),
          eventLinkIds: r.get('event_id') || [],
          orderNumber: r.get('order_number')
        });
      }
      next();
    });

  console.log(`Found ${orders.length} Orders\n`);

  // Find orders with booking_ids that don't exist in Events
  console.log('Checking for orders with invalid booking_ids...\n');

  const ordersToFix = [];

  for (const order of orders) {
    if (!order.bookingId) continue;

    // Check if the booking_id exists in Events
    if (!eventsMap.has(order.bookingId)) {
      // This order has a booking_id that doesn't match any Event
      // Try to find the correct event by school_name + date

      // Extract date from booking_id (format: evt_..._YYYYMMDD_hash)
      const dateMatch = order.bookingId.match(/_(\d{8})_/);
      const bookingDate = dateMatch
        ? `${dateMatch[1].substring(0, 4)}-${dateMatch[1].substring(4, 6)}-${dateMatch[1].substring(6, 8)}`
        : null;

      // Look up the correct event by school_name + event_date
      let correctEvent = null;
      if (order.schoolName && bookingDate) {
        const lookupKey = `${order.schoolName.toLowerCase()}|${bookingDate}`;
        correctEvent = eventsBySchoolDate.get(lookupKey);
      }

      ordersToFix.push({
        ...order,
        extractedDate: bookingDate,
        correctEventId: correctEvent?.eventId || null,
        correctEventRecordId: correctEvent?.recordId || null,
        eventExists: !!correctEvent
      });
    }
  }

  if (ordersToFix.length === 0) {
    console.log('All orders have valid booking_ids!');
    return;
  }

  console.log(`Found ${ordersToFix.length} orders with invalid booking_ids:\n`);

  // Stats
  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  for (const order of ordersToFix) {
    console.log(`Order ${order.orderNumber} (${order.recordId})`);
    console.log(`  Current booking_id: ${order.bookingId}`);
    console.log(`  School: ${order.schoolName}`);
    console.log(`  Correct booking_id: ${order.correctEventId || 'UNKNOWN'}`);
    console.log(`  Event exists: ${order.eventExists ? 'YES' : 'NO'}`);

    if (!order.correctEventId || !order.eventExists) {
      console.log(`  -> SKIPPING: Cannot determine correct event\n`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  -> [DRY RUN] Would update booking_id and event_id link\n`);
      fixed++;
      continue;
    }

    try {
      // Update the order
      await base(ORDERS_TABLE_ID).update(order.recordId, {
        'booking_id': order.correctEventId,
        'event_id': [order.correctEventRecordId]
      });
      console.log(`  -> FIXED: Updated booking_id and event_id link\n`);
      fixed++;
    } catch (error) {
      console.log(`  -> ERROR: ${error.message}\n`);
      errors++;
    }
  }

  // Summary
  console.log('\n========================================');
  console.log('  Fix Complete');
  console.log('========================================');
  console.log(`Orders with invalid booking_ids: ${ordersToFix.length}`);
  console.log(`Fixed: ${fixed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (DRY_RUN) {
    console.log('\n** DRY RUN - No changes were made **');
    console.log('Run without --dry-run to execute the fix.\n');
  } else {
    console.log('\nOrders have been updated with correct booking_ids.\n');
  }
}

// =============================================================================
// RUN
// =============================================================================

fixOrdersBookingIds()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fix failed:', error);
    process.exit(1);
  });
