/**
 * Fix Duplicate Events Migration
 *
 * This script finds and fixes duplicate Event records that were created due to
 * different event type values being passed to generateEventId().
 *
 * Problem:
 * - Schools have multiple event_ids for the same booking (e.g., "minimusikertag" vs "minimusiker")
 * - This causes classes to be split across different events
 * - Parent registrations fail because they're using the wrong event code
 *
 * Solution:
 * 1. Find all Events grouped by (school_name, event_date)
 * 2. Identify groups with multiple event_ids (duplicates)
 * 3. Determine the "correct" event_id using normalized generation
 * 4. For each duplicate group:
 *    a. Keep/create the event with correct event_id
 *    b. Update Classes to link to correct Event
 *    c. Update parent_journey_table records with correct booking_id
 *    d. Update Orders to use correct booking_id
 *    e. Delete the duplicate Event records
 *
 * Usage:
 *   node scripts/fix-duplicate-events.js --dry-run    # Preview changes
 *   node scripts/fix-duplicate-events.js              # Execute migration
 */

require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');
const crypto = require('crypto');

// =============================================================================
// TABLE IDs
// =============================================================================

const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const CLASSES_TABLE_ID = 'tbl17SVI5gacwOP0n';
const PARENT_JOURNEY_TABLE_ID = 'tblocVr4DF001I1Ar';
const ORDERS_TABLE_ID = 'tblu9AGaLSoEVwqq7';

// =============================================================================
// FIELD NAMES
// =============================================================================

const EVENTS_FIELDS = {
  event_id: 'event_id',
  school_name: 'school_name',
  event_date: 'event_date',
  event_type: 'event_type',
  assigned_staff: 'assigned_staff',
  assigned_engineer: 'assigned_engineer',
  simplybook_booking: 'simplybook_booking',
  legacy_booking_id: 'legacy_booking_id',
};

const CLASSES_FIELDS = {
  class_id: 'class_id',
  event_id: 'event_id', // Linked record to Events
  class_name: 'class_name',
};

const PARENT_JOURNEY_FIELDS = {
  booking_id: 'booking_id',
  school_name: 'school_name',
  booking_date: 'booking_date',
};

const ORDERS_FIELDS = {
  booking_id: 'booking_id',
};

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

/**
 * Normalize event type for consistent event ID generation.
 * All MiniMusiker variations map to canonical "minimusiker".
 */
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

/**
 * Generate the correct event ID using normalized event type
 */
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
// DATA FETCHING
// =============================================================================

/**
 * Fetch all Events from Airtable
 */
async function fetchAllEvents() {
  console.log('Fetching all Events...');

  const events = [];

  await base(EVENTS_TABLE_ID)
    .select({
      fields: [
        EVENTS_FIELDS.event_id,
        EVENTS_FIELDS.school_name,
        EVENTS_FIELDS.event_date,
        EVENTS_FIELDS.event_type,
        EVENTS_FIELDS.assigned_staff,
        EVENTS_FIELDS.assigned_engineer,
        EVENTS_FIELDS.simplybook_booking,
        EVENTS_FIELDS.legacy_booking_id,
      ],
    })
    .eachPage((records, fetchNextPage) => {
      for (const record of records) {
        events.push({
          recordId: record.id,
          eventId: record.get(EVENTS_FIELDS.event_id),
          schoolName: record.get(EVENTS_FIELDS.school_name),
          eventDate: record.get(EVENTS_FIELDS.event_date),
          eventType: record.get(EVENTS_FIELDS.event_type),
          assignedStaff: record.get(EVENTS_FIELDS.assigned_staff),
          assignedEngineer: record.get(EVENTS_FIELDS.assigned_engineer),
          simplybookBooking: record.get(EVENTS_FIELDS.simplybook_booking),
          legacyBookingId: record.get(EVENTS_FIELDS.legacy_booking_id),
        });
      }
      fetchNextPage();
    });

  console.log(`Found ${events.length} Events`);
  return events;
}

/**
 * Fetch all Classes from Airtable
 */
async function fetchAllClasses() {
  console.log('Fetching all Classes...');

  const classes = [];

  await base(CLASSES_TABLE_ID)
    .select({
      fields: [
        CLASSES_FIELDS.class_id,
        CLASSES_FIELDS.event_id,
        CLASSES_FIELDS.class_name,
      ],
    })
    .eachPage((records, fetchNextPage) => {
      for (const record of records) {
        classes.push({
          recordId: record.id,
          classId: record.get(CLASSES_FIELDS.class_id),
          eventLinkIds: record.get(CLASSES_FIELDS.event_id) || [],
          className: record.get(CLASSES_FIELDS.class_name),
        });
      }
      fetchNextPage();
    });

  console.log(`Found ${classes.length} Classes`);
  return classes;
}

/**
 * Fetch parent_journey_table records with booking_id
 */
async function fetchParentJourneyRecords() {
  console.log('Fetching parent_journey_table records...');

  const records = [];

  await base(PARENT_JOURNEY_TABLE_ID)
    .select({
      fields: [
        PARENT_JOURNEY_FIELDS.booking_id,
        PARENT_JOURNEY_FIELDS.school_name,
        PARENT_JOURNEY_FIELDS.booking_date,
      ],
    })
    .eachPage((pageRecords, fetchNextPage) => {
      for (const record of pageRecords) {
        records.push({
          recordId: record.id,
          bookingId: record.get(PARENT_JOURNEY_FIELDS.booking_id),
          schoolName: record.get(PARENT_JOURNEY_FIELDS.school_name),
          bookingDate: record.get(PARENT_JOURNEY_FIELDS.booking_date),
        });
      }
      fetchNextPage();
    });

  console.log(`Found ${records.length} parent_journey records`);
  return records;
}

/**
 * Fetch Orders with booking_id
 * Returns empty array if table is not accessible (permissions issue)
 */
async function fetchOrders() {
  console.log('Fetching Orders...');

  const orders = [];

  try {
    await base(ORDERS_TABLE_ID)
      .select({
        fields: [ORDERS_FIELDS.booking_id],
      })
      .eachPage((records, fetchNextPage) => {
        for (const record of records) {
          orders.push({
            recordId: record.id,
            bookingId: record.get(ORDERS_FIELDS.booking_id),
          });
        }
        fetchNextPage();
      });

    console.log(`Found ${orders.length} Orders`);
  } catch (error) {
    if (error.statusCode === 403) {
      console.log('  (Orders table not accessible - skipping Orders updates)');
    } else {
      throw error;
    }
  }

  return orders;
}

// =============================================================================
// DUPLICATE DETECTION
// =============================================================================

/**
 * Group events by school_name + event_date to find duplicates
 */
function findDuplicateGroups(events) {
  // Group by school_name + event_date
  const groups = new Map();

  for (const event of events) {
    if (!event.schoolName || !event.eventDate) continue;

    const key = `${event.schoolName}|${event.eventDate}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(event);
  }

  // Filter to only groups with multiple events (duplicates)
  const duplicates = [];
  for (const [key, eventList] of groups) {
    if (eventList.length > 1) {
      const [schoolName, eventDate] = key.split('|');
      duplicates.push({
        schoolName,
        eventDate,
        events: eventList,
        correctEventId: generateCorrectEventId(schoolName, eventDate),
      });
    }
  }

  return duplicates;
}

// =============================================================================
// UPDATE FUNCTIONS
// =============================================================================

/**
 * Update Classes to link to the correct Event
 */
async function updateClassEventLinks(classes, oldEventRecordId, newEventRecordId) {
  const affectedClasses = classes.filter(
    (c) => c.eventLinkIds.includes(oldEventRecordId)
  );

  if (affectedClasses.length === 0) return 0;

  console.log(`  Updating ${affectedClasses.length} Classes to link to correct Event...`);

  if (DRY_RUN) {
    for (const cls of affectedClasses) {
      console.log(`    [DRY RUN] Would update Class ${cls.className} (${cls.recordId})`);
    }
    return affectedClasses.length;
  }

  // Update in batches of 10 (Airtable limit)
  const batchSize = 10;
  for (let i = 0; i < affectedClasses.length; i += batchSize) {
    const batch = affectedClasses.slice(i, i + batchSize);
    await base(CLASSES_TABLE_ID).update(
      batch.map((cls) => ({
        id: cls.recordId,
        fields: {
          [CLASSES_FIELDS.event_id]: [newEventRecordId],
        },
      }))
    );
  }

  return affectedClasses.length;
}

/**
 * Update parent_journey_table records with correct booking_id
 */
async function updateParentJourneyBookingIds(records, oldBookingId, newBookingId) {
  const affected = records.filter((r) => r.bookingId === oldBookingId);

  if (affected.length === 0) return 0;

  console.log(`  Updating ${affected.length} parent_journey records...`);

  if (DRY_RUN) {
    for (const rec of affected) {
      console.log(`    [DRY RUN] Would update record ${rec.recordId}`);
    }
    return affected.length;
  }

  // Update in batches of 10
  const batchSize = 10;
  for (let i = 0; i < affected.length; i += batchSize) {
    const batch = affected.slice(i, i + batchSize);
    await base(PARENT_JOURNEY_TABLE_ID).update(
      batch.map((rec) => ({
        id: rec.recordId,
        fields: {
          [PARENT_JOURNEY_FIELDS.booking_id]: newBookingId,
        },
      }))
    );
  }

  return affected.length;
}

/**
 * Update Orders with correct booking_id
 */
async function updateOrderBookingIds(orders, oldBookingId, newBookingId) {
  const affected = orders.filter((o) => o.bookingId === oldBookingId);

  if (affected.length === 0) return 0;

  console.log(`  Updating ${affected.length} Orders...`);

  if (DRY_RUN) {
    for (const order of affected) {
      console.log(`    [DRY RUN] Would update Order ${order.recordId}`);
    }
    return affected.length;
  }

  // Update in batches of 10
  const batchSize = 10;
  for (let i = 0; i < affected.length; i += batchSize) {
    const batch = affected.slice(i, i + batchSize);
    await base(ORDERS_TABLE_ID).update(
      batch.map((order) => ({
        id: order.recordId,
        fields: {
          [ORDERS_FIELDS.booking_id]: newBookingId,
        },
      }))
    );
  }

  return affected.length;
}

/**
 * Delete duplicate Event records
 */
async function deleteEvents(eventRecordIds) {
  if (eventRecordIds.length === 0) return;

  console.log(`  Deleting ${eventRecordIds.length} duplicate Event records...`);

  if (DRY_RUN) {
    for (const id of eventRecordIds) {
      console.log(`    [DRY RUN] Would delete Event ${id}`);
    }
    return;
  }

  // Delete in batches of 10
  const batchSize = 10;
  for (let i = 0; i < eventRecordIds.length; i += batchSize) {
    const batch = eventRecordIds.slice(i, i + batchSize);
    await base(EVENTS_TABLE_ID).destroy(batch);
  }
}

/**
 * Update an Event's event_id if it doesn't match the correct one
 */
async function updateEventId(eventRecordId, correctEventId) {
  console.log(`  Updating Event ${eventRecordId} to correct event_id: ${correctEventId}`);

  if (DRY_RUN) {
    console.log(`    [DRY RUN] Would update event_id`);
    return;
  }

  await base(EVENTS_TABLE_ID).update(eventRecordId, {
    [EVENTS_FIELDS.event_id]: correctEventId,
  });
}

// =============================================================================
// MAIN MIGRATION
// =============================================================================

async function fixDuplicateEvents() {
  console.log('\n========================================');
  console.log('  Fix Duplicate Events Migration');
  console.log('========================================');
  if (DRY_RUN) {
    console.log('  ** DRY RUN MODE - No changes will be made **');
  }
  console.log('========================================\n');

  // Fetch all data
  const events = await fetchAllEvents();
  const classes = await fetchAllClasses();
  const parentJourneyRecords = await fetchParentJourneyRecords();
  const orders = await fetchOrders();

  // Find duplicates
  console.log('\nSearching for duplicate events...\n');
  const duplicateGroups = findDuplicateGroups(events);

  if (duplicateGroups.length === 0) {
    console.log('No duplicate events found!');
    return;
  }

  console.log(`Found ${duplicateGroups.length} groups of duplicate events:\n`);

  // Stats
  const stats = {
    groupsProcessed: 0,
    eventsDeleted: 0,
    eventsUpdated: 0,
    classesUpdated: 0,
    parentJourneyUpdated: 0,
    ordersUpdated: 0,
    errors: 0,
  };

  // Process each duplicate group
  for (const group of duplicateGroups) {
    console.log('----------------------------------------');
    console.log(`School: ${group.schoolName}`);
    console.log(`Date: ${group.eventDate}`);
    console.log(`Correct event_id: ${group.correctEventId}`);
    console.log(`Found ${group.events.length} duplicate events:`);

    for (const event of group.events) {
      console.log(`  - ${event.eventId} (record: ${event.recordId})`);
    }

    try {
      // Find the event with the correct event_id, or choose one to keep
      let keepEvent = group.events.find((e) => e.eventId === group.correctEventId);
      const duplicatesToDelete = [];

      if (keepEvent) {
        // We have the correct event already
        duplicatesToDelete.push(
          ...group.events.filter((e) => e.recordId !== keepEvent.recordId)
        );
      } else {
        // No event has the correct event_id - keep the first one and update its event_id
        keepEvent = group.events[0];
        duplicatesToDelete.push(...group.events.slice(1));

        // Update the kept event's event_id to the correct one
        await updateEventId(keepEvent.recordId, group.correctEventId);
        stats.eventsUpdated++;
      }

      console.log(`\n  Keeping Event: ${keepEvent.recordId} (will have event_id: ${group.correctEventId})`);
      console.log(`  Deleting ${duplicatesToDelete.length} duplicates`);

      // Update linked records for each duplicate being deleted
      for (const duplicate of duplicatesToDelete) {
        console.log(`\n  Processing duplicate: ${duplicate.eventId}`);

        // Update Classes
        const classesUpdated = await updateClassEventLinks(
          classes,
          duplicate.recordId,
          keepEvent.recordId
        );
        stats.classesUpdated += classesUpdated;

        // Update parent_journey_table
        const pjUpdated = await updateParentJourneyBookingIds(
          parentJourneyRecords,
          duplicate.eventId,
          group.correctEventId
        );
        stats.parentJourneyUpdated += pjUpdated;

        // Update Orders
        const ordersUpdated = await updateOrderBookingIds(
          orders,
          duplicate.eventId,
          group.correctEventId
        );
        stats.ordersUpdated += ordersUpdated;
      }

      // Delete duplicates
      await deleteEvents(duplicatesToDelete.map((d) => d.recordId));
      stats.eventsDeleted += duplicatesToDelete.length;

      stats.groupsProcessed++;

    } catch (error) {
      console.error(`  ERROR: ${error.message}`);
      stats.errors++;
    }

    console.log('');
  }

  // Summary
  console.log('\n========================================');
  console.log('  Migration Complete');
  console.log('========================================');
  console.log(`Groups processed:        ${stats.groupsProcessed}`);
  console.log(`Events updated:          ${stats.eventsUpdated}`);
  console.log(`Events deleted:          ${stats.eventsDeleted}`);
  console.log(`Classes updated:         ${stats.classesUpdated}`);
  console.log(`parent_journey updated:  ${stats.parentJourneyUpdated}`);
  console.log(`Orders updated:          ${stats.ordersUpdated}`);
  console.log(`Errors:                  ${stats.errors}`);

  if (DRY_RUN) {
    console.log('\n** DRY RUN - No changes were made **');
    console.log('Run without --dry-run to execute the migration.\n');
  } else {
    console.log('\nMigration complete! Duplicate events have been merged.\n');
  }
}

// =============================================================================
// RUN
// =============================================================================

fixDuplicateEvents()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
