#!/usr/bin/env node
/**
 * Migration Script: Sync legacy parent_journey_table to normalized tables
 *
 * This script:
 * 1. Reads all records from parent_journey_table
 * 2. For each record:
 *    - Finds or creates Parent in Parents table
 *    - Finds Event in Events table (by booking_id)
 *    - Finds Class in Classes table (by class_id)
 *    - Creates Registration linking Parent → Event → Class
 *
 * Run with --dry-run to see what would be created without making changes
 */

require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Table IDs
const PARENTS_TABLE_ID = process.env.PARENTS_TABLE_ID;
const REGISTRATIONS_TABLE_ID = process.env.REGISTRATIONS_TABLE_ID;
const EVENTS_TABLE_ID = process.env.EVENTS_TABLE_ID;
const CLASSES_TABLE_ID = process.env.CLASSES_TABLE_ID;
const LEGACY_TABLE_NAME = 'parent_journey_table';

// Field IDs for normalized tables
const PARENTS_FIELD_IDS = {
  parent_id: 'fldnnzCB0aesXJdxu',
  parent_email: 'fldd3LuRL0TmzVESR',
  parent_first_name: 'fldtaXHWE5RP0nrw5',
  parent_telephone: 'fldG9NgGysXmZcQcu',
  email_campaigns: 'flddJfUYApbFbXbjy',
};

const EVENTS_FIELD_IDS = {
  event_id: 'fldcNaHZyr6E5khDe',
  legacy_booking_id: 'fldYrZSh7tdkwuWp4',
};

const CLASSES_FIELD_IDS = {
  class_id: 'fld1dXGae9I7xldun',
};

const REGISTRATIONS_FIELD_IDS = {
  event_id: 'fld4U9Wq5Skqf2Poq',
  parent_id: 'fldqfoJhaXH0Oj32J',
  class_id: 'fldfZeZiOGFg5UD0I',
  registered_child: 'fldkdMkuuJ21sIjOQ',
  child_id: 'fldjejm0H9GoBIg5h',
  registered_complete: 'fld9j3Y4ez5eYqFtU',
  order_number: 'fldxoKh20d5WuW4vt',
  legacy_record: 'fldphliFEPY9WlIFJ',
};

// Legacy table field IDs
const LEGACY_FIELD_IDS = {
  booking_id: 'fldUB8dAiQd61VncB',
  class_id: 'fldtiPDposZlSD2lm',
  school_name: 'fld2Rd4S9aWGOjkJI',
  registered_child: 'flddZJuHdOqeighMf',
  parent_first_name: 'fldTeWfHG1TQJbzgr',
  parent_email: 'fldwiX1CSfJZS0AIz',
  parent_telephone: 'fldYljDGY0MPzgzDx',
  email_campaigns: 'fldSTM8ogsqM357h1',
  order_number: 'fldeYzYUhAWIZxFX3',
  parent_id: 'fld4mmx0n71PSr1JM',
  child_id: 'fldGSeyNR9R1OzifJ',
  registered_complete: 'fldVRM60HDfNzO12o',
};

const isDryRun = process.argv.includes('--dry-run');

// Cache for lookups
const parentCache = new Map(); // email -> record ID
const eventCache = new Map();  // booking_id -> record ID
const classCache = new Map();  // class_id -> record ID
const existingRegistrations = new Set(); // legacy_record IDs already migrated

async function loadCaches() {
  console.log('Loading existing data into caches...\n');

  // Load parents
  const parents = await base(PARENTS_TABLE_ID).select({ returnFieldsByFieldId: true }).all();
  parents.forEach(p => {
    const email = p.fields[PARENTS_FIELD_IDS.parent_email];
    if (email) parentCache.set(email.toLowerCase(), p.id);
  });
  console.log(`  Loaded ${parentCache.size} parents`);

  // Load events
  const events = await base(EVENTS_TABLE_ID).select({ returnFieldsByFieldId: true }).all();
  events.forEach(e => {
    const eventId = e.fields[EVENTS_FIELD_IDS.event_id];
    const legacyId = e.fields[EVENTS_FIELD_IDS.legacy_booking_id];
    if (eventId) eventCache.set(eventId, e.id);
    if (legacyId) eventCache.set(legacyId, e.id);
  });
  console.log(`  Loaded ${events.length} events`);

  // Load classes
  const classes = await base(CLASSES_TABLE_ID).select({ returnFieldsByFieldId: true }).all();
  classes.forEach(c => {
    const classId = c.fields[CLASSES_FIELD_IDS.class_id];
    if (classId) classCache.set(classId, c.id);
  });
  console.log(`  Loaded ${classes.length} classes`);

  // Load existing registrations to avoid duplicates
  const registrations = await base(REGISTRATIONS_TABLE_ID).select({ returnFieldsByFieldId: true }).all();
  registrations.forEach(r => {
    const legacyRecord = r.fields[REGISTRATIONS_FIELD_IDS.legacy_record];
    if (legacyRecord) existingRegistrations.add(legacyRecord);
  });
  console.log(`  Loaded ${registrations.length} existing registrations`);
}

async function findOrCreateParent(legacyRecord) {
  const email = legacyRecord.fields[LEGACY_FIELD_IDS.parent_email];
  if (!email) return null;

  const normalizedEmail = email.toLowerCase().trim();

  // Check cache first
  if (parentCache.has(normalizedEmail)) {
    return parentCache.get(normalizedEmail);
  }

  // Create new parent
  const parentData = {
    [PARENTS_FIELD_IDS.parent_email]: email,
    [PARENTS_FIELD_IDS.parent_first_name]: legacyRecord.fields[LEGACY_FIELD_IDS.parent_first_name] || '',
    [PARENTS_FIELD_IDS.parent_telephone]: legacyRecord.fields[LEGACY_FIELD_IDS.parent_telephone] || '',
    [PARENTS_FIELD_IDS.parent_id]: legacyRecord.fields[LEGACY_FIELD_IDS.parent_id] || `P-${Date.now()}`,
  };

  const emailCampaigns = legacyRecord.fields[LEGACY_FIELD_IDS.email_campaigns];
  if (emailCampaigns) {
    parentData[PARENTS_FIELD_IDS.email_campaigns] = emailCampaigns;
  }

  if (isDryRun) {
    console.log(`    [DRY-RUN] Would create parent: ${email}`);
    return `dry-run-parent-${normalizedEmail}`;
  }

  const created = await base(PARENTS_TABLE_ID).create([{ fields: parentData }]);
  const newId = created[0].id;
  parentCache.set(normalizedEmail, newId);
  console.log(`    Created parent: ${email} (${newId})`);
  return newId;
}

function findEvent(bookingId) {
  return eventCache.get(bookingId) || null;
}

function findClass(classId) {
  return classCache.get(classId) || null;
}

async function createRegistration(legacyRecord, parentRecordId, eventRecordId, classRecordId) {
  const registrationData = {
    [REGISTRATIONS_FIELD_IDS.registered_child]: legacyRecord.fields[LEGACY_FIELD_IDS.registered_child] || '',
    [REGISTRATIONS_FIELD_IDS.legacy_record]: legacyRecord.id,
  };

  // Add linked records
  if (parentRecordId && !parentRecordId.startsWith('dry-run')) {
    registrationData[REGISTRATIONS_FIELD_IDS.parent_id] = [parentRecordId];
  }
  if (eventRecordId) {
    registrationData[REGISTRATIONS_FIELD_IDS.event_id] = [eventRecordId];
  }
  if (classRecordId) {
    registrationData[REGISTRATIONS_FIELD_IDS.class_id] = [classRecordId];
  }

  // Optional fields
  const childId = legacyRecord.fields[LEGACY_FIELD_IDS.child_id];
  if (childId) registrationData[REGISTRATIONS_FIELD_IDS.child_id] = childId;

  const orderNumber = legacyRecord.fields[LEGACY_FIELD_IDS.order_number];
  if (orderNumber) registrationData[REGISTRATIONS_FIELD_IDS.order_number] = orderNumber;

  const registeredComplete = legacyRecord.fields[LEGACY_FIELD_IDS.registered_complete];
  if (registeredComplete !== undefined) {
    registrationData[REGISTRATIONS_FIELD_IDS.registered_complete] = registeredComplete;
  }

  if (isDryRun) {
    console.log(`    [DRY-RUN] Would create registration for: ${registrationData[REGISTRATIONS_FIELD_IDS.registered_child]}`);
    return;
  }

  await base(REGISTRATIONS_TABLE_ID).create([{ fields: registrationData }]);
  console.log(`    Created registration for: ${registrationData[REGISTRATIONS_FIELD_IDS.registered_child]}`);
}

async function migrate() {
  console.log('\n========================================');
  console.log('MIGRATION: Legacy → Normalized Tables');
  console.log('========================================');
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  await loadCaches();

  // Load all legacy records
  console.log('\nLoading legacy records...');
  const legacyRecords = await base(LEGACY_TABLE_NAME).select({ returnFieldsByFieldId: true }).all();
  console.log(`Found ${legacyRecords.length} legacy records to process\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of legacyRecords) {
    const email = record.fields[LEGACY_FIELD_IDS.parent_email];
    const bookingId = record.fields[LEGACY_FIELD_IDS.booking_id];
    const classId = record.fields[LEGACY_FIELD_IDS.class_id];
    const childName = record.fields[LEGACY_FIELD_IDS.registered_child];

    console.log(`\nProcessing: ${email || 'NO EMAIL'} / ${childName || 'NO CHILD'}`);
    console.log(`  Legacy ID: ${record.id}`);
    console.log(`  Booking: ${bookingId}, Class: ${classId}`);

    // Skip if already migrated
    if (existingRegistrations.has(record.id)) {
      console.log('  ⏭️  Already migrated, skipping');
      skipped++;
      continue;
    }

    // Skip if no email
    if (!email) {
      console.log('  ⚠️  No email, skipping');
      skipped++;
      continue;
    }

    try {
      // Find or create parent
      const parentRecordId = await findOrCreateParent(record);

      // Find event (must already exist)
      const eventRecordId = findEvent(bookingId);
      if (!eventRecordId) {
        console.log(`  ⚠️  Event not found for booking_id: ${bookingId}`);
      }

      // Find class (must already exist)
      const classRecordId = findClass(classId);
      if (!classRecordId) {
        console.log(`  ⚠️  Class not found for class_id: ${classId}`);
      }

      // Create registration
      await createRegistration(record, parentRecordId, eventRecordId, classRecordId);
      created++;

    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      errors++;
    }
  }

  console.log('\n========================================');
  console.log('MIGRATION SUMMARY');
  console.log('========================================');
  console.log(`  Total legacy records: ${legacyRecords.length}`);
  console.log(`  Created:              ${created}`);
  console.log(`  Skipped:              ${skipped}`);
  console.log(`  Errors:               ${errors}`);
  if (isDryRun) {
    console.log('\n🔍 This was a DRY RUN. Run without --dry-run to apply changes.');
  }
  console.log('');
}

migrate().catch(console.error);
