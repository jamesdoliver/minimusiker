/**
 * Backfill Normalized Tables (Events + Classes)
 *
 * Populates the normalized Events and Classes tables from parent_journey_table.
 * This ensures orders can link to Event and Class records.
 *
 * Data Flow:
 * 1. Group parent_journey_table records by booking_id → Create Events
 * 2. Group by booking_id + class name → Create Classes (linked to Events)
 *
 * Usage:
 *   node scripts/backfill-normalized-tables.js          # Run backfill
 *   node scripts/backfill-normalized-tables.js --dry-run # Preview without creating
 */

// Load environment variables first
require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');
const crypto = require('crypto');

// =============================================================================
// TABLE IDs
// =============================================================================

const PARENT_JOURNEY_TABLE_ID = 'tblocVr4DF001I1Ar';
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const CLASSES_TABLE_ID = 'tbl17SVI5gacwOP0n';

// =============================================================================
// FIELD NAMES (Airtable SDK uses field names)
// =============================================================================

const PARENT_JOURNEY_FIELDS = {
  booking_id: 'booking_id',
  school_name: 'school_name',
  event_type: 'event_type',
  booking_date: 'booking_date',
  class: 'class',
  class_id: 'class_id',
  main_teacher: 'main_teacher',
  other_teachers: 'other_teachers',
  total_children: 'total_children',
  assigned_staff: 'assigned_staff',
  assigned_engineer: 'assigned_engineer',
};

const EVENTS_FIELDS = {
  event_id: 'event_id',
  school_name: 'school_name',
  event_date: 'event_date',
  event_type: 'event_type',
  assigned_staff: 'assigned_staff',
  assigned_engineer: 'assigned_engineer',
  created_at: 'created_at',
  legacy_booking_id: 'legacy_booking_id',
};

const CLASSES_FIELDS = {
  class_id: 'class_id',
  event_id: 'event_id', // Linked record field
  class_name: 'class_name',
  main_teacher: 'main_teacher',
  other_teachers: 'other_teachers',
  total_children: 'total_children',
  // created_at is a formula/computed field in Airtable - don't set it
  legacy_booking_id: 'legacy_booking_id',
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
// ID GENERATION FUNCTIONS (copied from eventIdentifiers.ts)
// =============================================================================

/**
 * Generate a unique event ID from school name, event type, and booking date
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

  let dateStr = '';
  if (bookingDate) {
    const dateOnly = bookingDate.split('T')[0];
    dateStr = dateOnly.replace(/-/g, '');
  }

  const hashInput = `${schoolName}|${eventType}|${bookingDate || ''}`;
  const hash = crypto.createHash('md5').update(hashInput).digest('hex').substring(0, 6);

  if (dateStr) {
    return `evt_${schoolSlug}_${eventSlug}_${dateStr}_${hash}`;
  }
  return `evt_${schoolSlug}_${eventSlug}_${hash}`;
}

/**
 * Generate a unique class ID from school name, event date, and class name
 */
function generateClassId(schoolName, bookingDate, className) {
  const schoolSlug = schoolName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 30);

  const classSlug = className
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 15);

  const dateOnly = bookingDate.split('T')[0];
  const dateStr = dateOnly.replace(/-/g, '');

  const hashInput = `${schoolName}|${bookingDate}|${className}`;
  const hash = crypto.createHash('md5').update(hashInput).digest('hex').substring(0, 6);

  return `cls_${schoolSlug}_${dateStr}_${classSlug}_${hash}`;
}

// =============================================================================
// DATA FETCHING
// =============================================================================

/**
 * Fetch all parent_journey_table records with relevant fields
 */
async function fetchParentJourneyRecords() {
  console.log('Fetching parent_journey_table records...');

  const records = [];

  await base(PARENT_JOURNEY_TABLE_ID)
    .select({
      fields: Object.values(PARENT_JOURNEY_FIELDS),
    })
    .eachPage((pageRecords, fetchNextPage) => {
      for (const record of pageRecords) {
        records.push({
          id: record.id,
          bookingId: record.get(PARENT_JOURNEY_FIELDS.booking_id),
          schoolName: record.get(PARENT_JOURNEY_FIELDS.school_name),
          eventType: record.get(PARENT_JOURNEY_FIELDS.event_type),
          bookingDate: record.get(PARENT_JOURNEY_FIELDS.booking_date),
          className: record.get(PARENT_JOURNEY_FIELDS.class),
          classId: record.get(PARENT_JOURNEY_FIELDS.class_id),
          mainTeacher: record.get(PARENT_JOURNEY_FIELDS.main_teacher),
          otherTeachers: record.get(PARENT_JOURNEY_FIELDS.other_teachers),
          totalChildren: record.get(PARENT_JOURNEY_FIELDS.total_children),
          assignedStaff: record.get(PARENT_JOURNEY_FIELDS.assigned_staff),
          assignedEngineer: record.get(PARENT_JOURNEY_FIELDS.assigned_engineer),
        });
      }
      fetchNextPage();
    });

  console.log(`Found ${records.length} parent_journey records`);
  return records;
}

/**
 * Fetch existing Events to check for duplicates
 */
async function fetchExistingEvents() {
  console.log('Fetching existing Events...');

  const eventsMap = new Map();

  await base(EVENTS_TABLE_ID)
    .select({
      fields: [EVENTS_FIELDS.event_id, EVENTS_FIELDS.legacy_booking_id],
    })
    .eachPage((records, fetchNextPage) => {
      for (const record of records) {
        const eventId = record.get(EVENTS_FIELDS.event_id);
        const legacyBookingId = record.get(EVENTS_FIELDS.legacy_booking_id);

        if (eventId) {
          eventsMap.set(eventId, {
            recordId: record.id,
            eventId,
            legacyBookingId,
          });
        }

        // Also index by legacy_booking_id for matching
        if (legacyBookingId) {
          eventsMap.set(`legacy:${legacyBookingId}`, {
            recordId: record.id,
            eventId,
            legacyBookingId,
          });
        }
      }
      fetchNextPage();
    });

  console.log(`Found ${eventsMap.size} existing Event entries`);
  return eventsMap;
}

/**
 * Fetch existing Classes to check for duplicates
 */
async function fetchExistingClasses() {
  console.log('Fetching existing Classes...');

  const classesMap = new Map();

  await base(CLASSES_TABLE_ID)
    .select({
      fields: [CLASSES_FIELDS.class_id, CLASSES_FIELDS.legacy_booking_id],
    })
    .eachPage((records, fetchNextPage) => {
      for (const record of records) {
        const classId = record.get(CLASSES_FIELDS.class_id);

        if (classId) {
          classesMap.set(classId, {
            recordId: record.id,
            classId,
          });
        }
      }
      fetchNextPage();
    });

  console.log(`Found ${classesMap.size} existing Class entries`);
  return classesMap;
}

// =============================================================================
// DATA TRANSFORMATION
// =============================================================================

/**
 * Group parent_journey records by booking_id to extract unique events
 */
function extractUniqueEvents(records) {
  const eventsMap = new Map();

  for (const record of records) {
    const { bookingId, schoolName, eventType, bookingDate, assignedStaff, assignedEngineer } = record;

    // Skip records without booking_id
    if (!bookingId) continue;

    // Skip if we already have this event
    if (eventsMap.has(bookingId)) continue;

    // Skip if missing required data
    if (!schoolName) {
      console.log(`[SKIP EVENT] Missing school_name for booking_id: ${bookingId}`);
      continue;
    }

    eventsMap.set(bookingId, {
      legacyBookingId: bookingId,
      schoolName,
      eventType: eventType || 'concert',
      bookingDate,
      assignedStaff,
      assignedEngineer,
    });
  }

  console.log(`Extracted ${eventsMap.size} unique events`);
  return eventsMap;
}

/**
 * Group parent_journey records by booking_id + class name to extract unique classes
 */
function extractUniqueClasses(records) {
  const classesMap = new Map();

  for (const record of records) {
    const { bookingId, schoolName, className, bookingDate, mainTeacher, otherTeachers, totalChildren } = record;

    // Skip records without required data
    if (!bookingId || !className || !schoolName || !bookingDate) {
      continue;
    }

    // Create a composite key for uniqueness
    const key = `${bookingId}|${className}`;

    // Skip if we already have this class
    if (classesMap.has(key)) continue;

    classesMap.set(key, {
      legacyBookingId: bookingId,
      schoolName,
      bookingDate,
      className,
      mainTeacher,
      otherTeachers,
      totalChildren,
    });
  }

  console.log(`Extracted ${classesMap.size} unique classes`);
  return classesMap;
}

// =============================================================================
// CREATE RECORDS
// =============================================================================

/**
 * Create Event record in Airtable
 */
async function createEvent(eventData) {
  const { legacyBookingId, schoolName, eventType, bookingDate, assignedStaff, assignedEngineer } = eventData;

  // Generate the standardized event_id
  const eventId = generateEventId(schoolName, eventType || 'minimusiker', bookingDate);

  const fields = {
    [EVENTS_FIELDS.event_id]: eventId,
    [EVENTS_FIELDS.school_name]: schoolName,
    [EVENTS_FIELDS.event_type]: eventType || undefined,
    [EVENTS_FIELDS.event_date]: bookingDate || undefined,
    [EVENTS_FIELDS.legacy_booking_id]: legacyBookingId,
    // created_at is a formula/computed field - don't set it
  };

  // Only add linked records if they exist
  if (assignedStaff && assignedStaff.length > 0) {
    fields[EVENTS_FIELDS.assigned_staff] = assignedStaff;
  }
  if (assignedEngineer && assignedEngineer.length > 0) {
    fields[EVENTS_FIELDS.assigned_engineer] = assignedEngineer;
  }

  // Remove undefined values
  Object.keys(fields).forEach(key => {
    if (fields[key] === undefined) delete fields[key];
  });

  const records = await base(EVENTS_TABLE_ID).create([{ fields }]);
  return {
    recordId: records[0].id,
    eventId,
  };
}

/**
 * Create Class record in Airtable
 */
async function createClass(classData, eventRecordId) {
  const { legacyBookingId, schoolName, bookingDate, className, mainTeacher, otherTeachers, totalChildren } = classData;

  // Generate the standardized class_id
  const classId = generateClassId(schoolName, bookingDate, className);

  const fields = {
    [CLASSES_FIELDS.class_id]: classId,
    [CLASSES_FIELDS.class_name]: className,
    [CLASSES_FIELDS.main_teacher]: mainTeacher || undefined,
    [CLASSES_FIELDS.other_teachers]: otherTeachers || undefined,
    [CLASSES_FIELDS.legacy_booking_id]: legacyBookingId,
    // created_at is a formula/computed field - don't set it
  };

  // Only add total_children if it's a positive number
  if (totalChildren && totalChildren > 0) {
    fields[CLASSES_FIELDS.total_children] = totalChildren;
  }

  // Link to Event (required)
  if (eventRecordId) {
    fields[CLASSES_FIELDS.event_id] = [eventRecordId];
  }

  // Remove undefined values
  Object.keys(fields).forEach(key => {
    if (fields[key] === undefined) delete fields[key];
  });

  const records = await base(CLASSES_TABLE_ID).create([{ fields }]);
  return {
    recordId: records[0].id,
    classId,
  };
}

// =============================================================================
// MAIN BACKFILL FUNCTION
// =============================================================================

async function backfillNormalizedTables() {
  console.log('\n========================================');
  console.log('  Normalized Tables Backfill');
  console.log('  (Events + Classes from parent_journey)');
  if (DRY_RUN) {
    console.log('  ** DRY RUN MODE - No records will be created **');
  }
  console.log('========================================\n');

  // Fetch all data
  const parentJourneyRecords = await fetchParentJourneyRecords();
  const existingEventsMap = await fetchExistingEvents();
  const existingClassesMap = await fetchExistingClasses();

  // Extract unique events and classes
  const uniqueEvents = extractUniqueEvents(parentJourneyRecords);
  const uniqueClasses = extractUniqueClasses(parentJourneyRecords);

  // Track statistics
  const stats = {
    eventsCreated: 0,
    eventsSkipped: 0,
    eventsErrors: 0,
    classesCreated: 0,
    classesSkipped: 0,
    classesOrphaned: 0,
    classesErrors: 0,
  };

  // Map from legacyBookingId to Event record ID (for Class linking)
  const eventRecordIdMap = new Map();

  // =============================================================================
  // PHASE 1: Create Events
  // =============================================================================
  console.log('\n--- PHASE 1: Creating Events ---\n');

  for (const [legacyBookingId, eventData] of uniqueEvents) {
    try {
      // Generate the event_id to check for duplicates
      const eventId = generateEventId(
        eventData.schoolName,
        eventData.eventType || 'minimusiker',
        eventData.bookingDate
      );

      // Check if event already exists (by event_id or legacy_booking_id)
      const existingByEventId = existingEventsMap.get(eventId);
      const existingByLegacy = existingEventsMap.get(`legacy:${legacyBookingId}`);

      if (existingByEventId || existingByLegacy) {
        const existing = existingByEventId || existingByLegacy;
        console.log(`[SKIP EVENT] Already exists: ${eventData.schoolName} (${eventData.bookingDate})`);
        eventRecordIdMap.set(legacyBookingId, existing.recordId);
        stats.eventsSkipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`[DRY RUN] Would create Event: ${eventData.schoolName} (${eventData.bookingDate})`);
        console.log(`          event_id: ${eventId}`);
        eventRecordIdMap.set(legacyBookingId, 'DRY_RUN_PLACEHOLDER');
        stats.eventsCreated++;
        continue;
      }

      // Create the Event record
      console.log(`[CREATE EVENT] ${eventData.schoolName} (${eventData.bookingDate})`);
      const result = await createEvent(eventData);
      eventRecordIdMap.set(legacyBookingId, result.recordId);
      console.log(`              Created: ${result.eventId}`);
      stats.eventsCreated++;

    } catch (error) {
      console.error(`[ERROR EVENT] ${eventData.schoolName}:`, error.message || error);
      stats.eventsErrors++;
    }
  }

  // =============================================================================
  // PHASE 2: Create Classes
  // =============================================================================
  console.log('\n--- PHASE 2: Creating Classes ---\n');

  for (const [key, classData] of uniqueClasses) {
    try {
      // Generate the class_id to check for duplicates
      const classId = generateClassId(
        classData.schoolName,
        classData.bookingDate,
        classData.className
      );

      // Check if class already exists
      if (existingClassesMap.has(classId)) {
        console.log(`[SKIP CLASS] Already exists: ${classData.className} @ ${classData.schoolName}`);
        stats.classesSkipped++;
        continue;
      }

      // Get the Event record ID for linking
      const eventRecordId = eventRecordIdMap.get(classData.legacyBookingId);

      if (!eventRecordId) {
        console.log(`[ORPHAN CLASS] No Event found for: ${classData.className} @ ${classData.schoolName}`);
        console.log(`               (legacy_booking_id: ${classData.legacyBookingId})`);
        stats.classesOrphaned++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`[DRY RUN] Would create Class: ${classData.className} @ ${classData.schoolName}`);
        console.log(`          class_id: ${classId}`);
        stats.classesCreated++;
        continue;
      }

      // Create the Class record
      console.log(`[CREATE CLASS] ${classData.className} @ ${classData.schoolName}`);
      const result = await createClass(classData, eventRecordId);
      console.log(`               Created: ${result.classId}`);
      stats.classesCreated++;

    } catch (error) {
      console.error(`[ERROR CLASS] ${classData.className}:`, error.message || error);
      stats.classesErrors++;
    }
  }

  // =============================================================================
  // SUMMARY
  // =============================================================================
  console.log('\n========================================');
  console.log('  Backfill Complete');
  console.log('========================================');
  console.log(`\nEvents:`);
  console.log(`  Created: ${stats.eventsCreated}`);
  console.log(`  Skipped: ${stats.eventsSkipped} (already exist)`);
  console.log(`  Errors:  ${stats.eventsErrors}`);
  console.log(`\nClasses:`);
  console.log(`  Created: ${stats.classesCreated}`);
  console.log(`  Skipped: ${stats.classesSkipped} (already exist)`);
  console.log(`  Orphaned: ${stats.classesOrphaned} (no parent Event)`);
  console.log(`  Errors:  ${stats.classesErrors}`);

  if (DRY_RUN) {
    console.log('\n** DRY RUN - No records were actually created **');
    console.log('Run without --dry-run to create records.\n');
  } else {
    console.log('\nRecords created. Orders should now be able to link to Events and Classes.\n');
  }
}

// =============================================================================
// RUN
// =============================================================================

backfillNormalizedTables()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  });
