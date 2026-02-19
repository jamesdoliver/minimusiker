#!/usr/bin/env node
/**
 * Airtable Duplicate Audit Script
 *
 * Scans all 4 main tables (Parents, Events, Registrations, SchoolBookings)
 * for duplicate records, reports findings, and offers interactive fix-with-confirmation.
 *
 * Duplicate Detection Rules:
 *   Parents:        Same parent_email (case-insensitive) → keep oldest by created_at
 *   Events:         Same school_name + event_date → keep most linked (classes, simplybook_booking); skip Deleted
 *   Registrations:  Same parent_id + event_id + registered_child (case-insensitive) → keep earliest registration_date
 *   SchoolBookings: Same simplybook_id OR same school_name + start_date → keep the one linked from an Event
 *
 * Usage:
 *   node scripts/audit-duplicates.js --dry-run    # Report only, no changes
 *   node scripts/audit-duplicates.js              # Report + interactive fix
 */

require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');
const readline = require('readline');

// =============================================================================
// CONSTANTS
// =============================================================================

const PARENTS_TABLE_ID = 'tblaMYOUj93yp7jHE';
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const REGISTRATIONS_TABLE_ID = 'tblXsmPuZcePcre5u';
const SCHOOL_BOOKINGS_TABLE_ID = 'tblrktl5eLJEWE4M6';
const CLASSES_TABLE_ID = 'tbl17SVI5gacwOP0n';

const PARENTS_FIELDS = {
  parent_email: 'parent_email',
  parent_first_name: 'parent_first_name',
  parent_telephone: 'parent_telephone',
  created_at: 'created_at',
};

const EVENTS_FIELDS = {
  event_id: 'event_id',
  school_name: 'school_name',
  event_date: 'event_date',
  status: 'status',
  simplybook_booking: 'simplybook_booking',
};

const REGISTRATIONS_FIELDS = {
  event_id: 'event_id',
  parent_id: 'parent_id',
  registered_child: 'registered_child',
  registration_date: 'registration_date',
};

const CLASSES_FIELDS = {
  event_id: 'event_id',
  class_name: 'class_name',
};

const SCHOOL_BOOKINGS_FIELDS = {
  simplybook_id: 'simplybook_id',
  school_name: 'school_name',
  start_date: 'start_date',
  school_contact_name: 'school_contact_name',
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
// UTILITIES
// =============================================================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(str) {
  if (!str) return '';
  return str.toLowerCase().trim();
}

function askQuestion(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

/**
 * Batch write/delete with 200ms delay and 429 retry (30s backoff)
 */
async function batchOperation(tableName, operation, items, batchSize = 10) {
  let processed = 0;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    let retries = 0;
    while (true) {
      try {
        if (operation === 'update') {
          await base(tableName).update(batch);
        } else if (operation === 'destroy') {
          await base(tableName).destroy(batch.map((b) => (typeof b === 'string' ? b : b.id)));
        }
        processed += batch.length;
        break;
      } catch (error) {
        if (error.statusCode === 429 && retries < 3) {
          console.log('    Rate limited, waiting 30s before retry...');
          await sleep(30000);
          retries++;
          continue;
        }
        throw error;
      }
    }
    if (i + batchSize < items.length) {
      await sleep(200);
    }
  }
  return processed;
}

// =============================================================================
// FETCH FUNCTIONS
// =============================================================================

async function fetchAllParents() {
  const records = [];
  await base(PARENTS_TABLE_ID)
    .select({
      fields: [
        PARENTS_FIELDS.parent_email,
        PARENTS_FIELDS.parent_first_name,
        PARENTS_FIELDS.parent_telephone,
        PARENTS_FIELDS.created_at,
      ],
    })
    .eachPage((page, next) => {
      for (const r of page) {
        records.push({
          id: r.id,
          email: r.get(PARENTS_FIELDS.parent_email),
          firstName: r.get(PARENTS_FIELDS.parent_first_name),
          telephone: r.get(PARENTS_FIELDS.parent_telephone),
          createdAt: r.get(PARENTS_FIELDS.created_at),
        });
      }
      next();
    });
  return records;
}

async function fetchAllEvents() {
  const records = [];
  await base(EVENTS_TABLE_ID)
    .select({
      fields: [
        EVENTS_FIELDS.event_id,
        EVENTS_FIELDS.school_name,
        EVENTS_FIELDS.event_date,
        EVENTS_FIELDS.status,
        EVENTS_FIELDS.simplybook_booking,
      ],
    })
    .eachPage((page, next) => {
      for (const r of page) {
        records.push({
          id: r.id,
          eventId: r.get(EVENTS_FIELDS.event_id),
          schoolName: r.get(EVENTS_FIELDS.school_name),
          eventDate: r.get(EVENTS_FIELDS.event_date),
          status: r.get(EVENTS_FIELDS.status),
          simplybookBooking: r.get(EVENTS_FIELDS.simplybook_booking) || [],
        });
      }
      next();
    });
  return records;
}

async function fetchAllRegistrations() {
  const records = [];
  await base(REGISTRATIONS_TABLE_ID)
    .select({
      fields: [
        REGISTRATIONS_FIELDS.event_id,
        REGISTRATIONS_FIELDS.parent_id,
        REGISTRATIONS_FIELDS.registered_child,
        REGISTRATIONS_FIELDS.registration_date,
      ],
    })
    .eachPage((page, next) => {
      for (const r of page) {
        records.push({
          id: r.id,
          eventId: r.get(REGISTRATIONS_FIELDS.event_id) || [],
          parentId: r.get(REGISTRATIONS_FIELDS.parent_id) || [],
          childName: r.get(REGISTRATIONS_FIELDS.registered_child),
          registrationDate: r.get(REGISTRATIONS_FIELDS.registration_date),
        });
      }
      next();
    });
  return records;
}

async function fetchAllSchoolBookings() {
  const records = [];
  await base(SCHOOL_BOOKINGS_TABLE_ID)
    .select({
      fields: [
        SCHOOL_BOOKINGS_FIELDS.simplybook_id,
        SCHOOL_BOOKINGS_FIELDS.school_name,
        SCHOOL_BOOKINGS_FIELDS.start_date,
        SCHOOL_BOOKINGS_FIELDS.school_contact_name,
      ],
    })
    .eachPage((page, next) => {
      for (const r of page) {
        records.push({
          id: r.id,
          simplybookId: r.get(SCHOOL_BOOKINGS_FIELDS.simplybook_id),
          schoolName: r.get(SCHOOL_BOOKINGS_FIELDS.school_name),
          startDate: r.get(SCHOOL_BOOKINGS_FIELDS.start_date),
          contactName: r.get(SCHOOL_BOOKINGS_FIELDS.school_contact_name),
        });
      }
      next();
    });
  return records;
}

async function fetchAllClasses() {
  const records = [];
  await base(CLASSES_TABLE_ID)
    .select({
      fields: [
        CLASSES_FIELDS.event_id,
        CLASSES_FIELDS.class_name,
      ],
    })
    .eachPage((page, next) => {
      for (const r of page) {
        records.push({
          id: r.id,
          eventId: r.get(CLASSES_FIELDS.event_id) || [],
          className: r.get(CLASSES_FIELDS.class_name),
        });
      }
      next();
    });
  return records;
}

// =============================================================================
// DETECT FUNCTIONS
// =============================================================================

function findParentDuplicates(parents) {
  const groups = new Map();
  for (const p of parents) {
    if (!p.email) continue;
    const key = normalize(p.email);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  const duplicates = [];
  for (const [email, list] of groups) {
    if (list.length < 2) continue;
    // Keep oldest by created_at
    list.sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt) : new Date('2099-01-01');
      const db = b.createdAt ? new Date(b.createdAt) : new Date('2099-01-01');
      return da - db;
    });
    duplicates.push({ key: email, keep: list[0], remove: list.slice(1) });
  }
  return duplicates;
}

function findEventDuplicates(events, classes) {
  // Build a map of event record ID → number of linked classes
  const classCountByEvent = new Map();
  for (const c of classes) {
    const eventRecordId = c.eventId[0];
    if (!eventRecordId) continue;
    classCountByEvent.set(eventRecordId, (classCountByEvent.get(eventRecordId) || 0) + 1);
  }

  const groups = new Map();
  for (const e of events) {
    if (!e.schoolName || !e.eventDate) continue;
    if (e.status === 'Deleted') continue;
    const key = `${normalize(e.schoolName)}|${e.eventDate}`;
    if (!groups.has(key)) groups.set(key, []);
    // Attach computed class count
    e.classCount = classCountByEvent.get(e.id) || 0;
    groups.get(key).push(e);
  }

  const duplicates = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    // Keep the one with the most linked records (classes + simplybook_booking)
    list.sort((a, b) => {
      const scoreA = a.classCount + a.simplybookBooking.length;
      const scoreB = b.classCount + b.simplybookBooking.length;
      return scoreB - scoreA; // descending
    });
    duplicates.push({ key, keep: list[0], remove: list.slice(1) });
  }
  return duplicates;
}

function findRegistrationDuplicates(registrations) {
  const groups = new Map();
  for (const r of registrations) {
    const parentId = r.parentId[0];
    const eventId = r.eventId[0];
    if (!parentId || !eventId) continue;
    const key = `${parentId}|${eventId}|${normalize(r.childName)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  const duplicates = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    // Keep earliest by registration_date
    list.sort((a, b) => {
      const da = a.registrationDate ? new Date(a.registrationDate) : new Date('2099-01-01');
      const db = b.registrationDate ? new Date(b.registrationDate) : new Date('2099-01-01');
      return da - db;
    });
    duplicates.push({ key, keep: list[0], remove: list.slice(1) });
  }
  return duplicates;
}

function findSchoolBookingDuplicates(bookings, events) {
  // Build set of booking record IDs referenced by any Event's simplybook_booking
  const linkedBookingIds = new Set();
  for (const e of events) {
    for (const bId of e.simplybookBooking || []) {
      linkedBookingIds.add(bId);
    }
  }

  // Group by simplybook_id
  const bySimplybookId = new Map();
  for (const b of bookings) {
    if (!b.simplybookId) continue;
    const key = String(b.simplybookId);
    if (!bySimplybookId.has(key)) bySimplybookId.set(key, []);
    bySimplybookId.get(key).push(b);
  }

  // Group by school_name + start_date
  const bySchoolDate = new Map();
  for (const b of bookings) {
    if (!b.schoolName || !b.startDate) continue;
    const key = `${normalize(b.schoolName)}|${b.startDate}`;
    if (!bySchoolDate.has(key)) bySchoolDate.set(key, []);
    bySchoolDate.get(key).push(b);
  }

  // Merge duplicate groups (avoid double-counting)
  const seen = new Set();
  const duplicates = [];

  function processGroup(list, key) {
    if (list.length < 2) return;
    // Deduplicate records across groups
    const ids = list.map((b) => b.id).sort().join(',');
    if (seen.has(ids)) return;
    seen.add(ids);

    // Keep the one linked from an Event, or first if none linked
    const linked = list.find((b) => linkedBookingIds.has(b.id));
    const keep = linked || list[0];
    const remove = list.filter((b) => b.id !== keep.id);
    duplicates.push({ key, keep, remove });
  }

  for (const [key, list] of bySimplybookId) processGroup(list, `simplybook:${key}`);
  for (const [key, list] of bySchoolDate) processGroup(list, `school+date:${key}`);

  return duplicates;
}

// =============================================================================
// REPORT FUNCTIONS
// =============================================================================

function printParentReport(duplicates) {
  if (duplicates.length === 0) {
    console.log('  No duplicate Parents found.\n');
    return;
  }
  console.log(`  ${duplicates.length} duplicate group(s):\n`);
  for (const g of duplicates) {
    console.log(`    Email: ${g.keep.email}`);
    console.log(`      KEEP:   ${g.keep.id} (${g.keep.firstName || '?'}, created ${g.keep.createdAt || '?'})`);
    for (const r of g.remove) {
      console.log(`      REMOVE: ${r.id} (${r.firstName || '?'}, created ${r.createdAt || '?'})`);
    }
    console.log('');
  }
}

function printEventReport(duplicates) {
  if (duplicates.length === 0) {
    console.log('  No duplicate Events found.\n');
    return;
  }
  console.log(`  ${duplicates.length} duplicate group(s):\n`);
  for (const g of duplicates) {
    const [school, date] = g.key.split('|');
    console.log(`    School+Date: ${school} | ${date}`);
    console.log(`      KEEP:   ${g.keep.id} (${g.keep.eventId}, classes=${g.keep.classCount}, bookings=${g.keep.simplybookBooking.length})`);
    for (const r of g.remove) {
      console.log(`      REMOVE: ${r.id} (${r.eventId}, classes=${r.classCount}, bookings=${r.simplybookBooking.length})`);
    }
    console.log('');
  }
}

function printRegistrationReport(duplicates) {
  if (duplicates.length === 0) {
    console.log('  No duplicate Registrations found.\n');
    return;
  }
  console.log(`  ${duplicates.length} duplicate group(s):\n`);
  for (const g of duplicates.slice(0, 20)) {
    console.log(`    Child: "${g.keep.childName}" (parent=${g.keep.parentId[0]}, event=${g.keep.eventId[0]})`);
    console.log(`      KEEP:   ${g.keep.id} (date: ${g.keep.registrationDate || '?'})`);
    for (const r of g.remove) {
      console.log(`      REMOVE: ${r.id} (date: ${r.registrationDate || '?'})`);
    }
  }
  if (duplicates.length > 20) {
    console.log(`    ... and ${duplicates.length - 20} more groups`);
  }
  console.log('');
}

function printSchoolBookingReport(duplicates) {
  if (duplicates.length === 0) {
    console.log('  No duplicate SchoolBookings found.\n');
    return;
  }
  console.log(`  ${duplicates.length} duplicate group(s):\n`);
  for (const g of duplicates) {
    console.log(`    Key: ${g.key}`);
    console.log(`      KEEP:   ${g.keep.id} (${g.keep.contactName || g.keep.schoolName || '?'})`);
    for (const r of g.remove) {
      console.log(`      REMOVE: ${r.id} (${r.contactName || r.schoolName || '?'})`);
    }
    console.log('');
  }
}

function printSummary(parentDups, eventDups, regDups, bookingDups) {
  const rows = [
    {
      table: 'Parents',
      groups: parentDups.length,
      toDelete: parentDups.reduce((s, g) => s + g.remove.length, 0),
      relinks: parentDups.reduce((s, g) => s + g.relinkCount, 0),
    },
    {
      table: 'Events',
      groups: eventDups.length,
      toDelete: eventDups.reduce((s, g) => s + g.remove.length, 0),
      relinks: eventDups.reduce((s, g) => s + g.relinkCount, 0),
    },
    {
      table: 'Registrations',
      groups: regDups.length,
      toDelete: regDups.reduce((s, g) => s + g.remove.length, 0),
      relinks: 0,
    },
    {
      table: 'SchoolBookings',
      groups: bookingDups.length,
      toDelete: bookingDups.reduce((s, g) => s + g.remove.length, 0),
      relinks: 0,
    },
  ];

  console.log('\n========================================');
  console.log('  SUMMARY');
  console.log('========================================');
  console.log('Table              | Groups | To Delete | Re-links');
  console.log('---------------------------------------------------');
  for (const row of rows) {
    const t = row.table.padEnd(18);
    const g = String(row.groups).padStart(6);
    const d = String(row.toDelete).padStart(9);
    const r = String(row.relinks).padStart(8);
    console.log(`${t} |${g} |${d} |${r}`);
  }
  console.log('');
}

// =============================================================================
// FIX FUNCTIONS
// =============================================================================

async function fixParentDuplicates(duplicates, registrations) {
  let totalRelinked = 0;
  let totalDeleted = 0;

  for (const group of duplicates) {
    try {
      const keepId = group.keep.id;
      const removeIds = group.remove.map((r) => r.id);

      // Re-link registrations from removed parents to kept parent
      const affectedRegs = registrations.filter(
        (r) => r.parentId[0] && removeIds.includes(r.parentId[0])
      );

      if (affectedRegs.length > 0) {
        const updates = affectedRegs.map((r) => ({
          id: r.id,
          fields: { [REGISTRATIONS_FIELDS.parent_id]: [keepId] },
        }));
        await batchOperation(REGISTRATIONS_TABLE_ID, 'update', updates);
        totalRelinked += affectedRegs.length;
        console.log(`    Re-linked ${affectedRegs.length} registrations for ${group.keep.email}`);
      }

      // Delete duplicate parent records
      await batchOperation(PARENTS_TABLE_ID, 'destroy', removeIds);
      totalDeleted += removeIds.length;
    } catch (error) {
      console.error(`    ERROR fixing parent group ${group.keep.email}: ${error.message}`);
    }
  }

  console.log(`  Parents: deleted ${totalDeleted}, re-linked ${totalRelinked} registrations`);
  return { deleted: totalDeleted, relinked: totalRelinked };
}

async function fixEventDuplicates(duplicates, classes, registrations) {
  let totalClassesRelinked = 0;
  let totalRegsRelinked = 0;
  let totalDeleted = 0;

  for (const group of duplicates) {
    try {
      const keepId = group.keep.id;
      const removeIds = group.remove.map((r) => r.id);

      // Re-link classes from removed events to kept event
      const affectedClasses = classes.filter(
        (c) => c.eventId[0] && removeIds.includes(c.eventId[0])
      );

      if (affectedClasses.length > 0) {
        const updates = affectedClasses.map((c) => ({
          id: c.id,
          fields: { [CLASSES_FIELDS.event_id]: [keepId] },
        }));
        await batchOperation(CLASSES_TABLE_ID, 'update', updates);
        totalClassesRelinked += affectedClasses.length;
      }

      // Re-link registrations from removed events to kept event
      const affectedRegs = registrations.filter(
        (r) => r.eventId[0] && removeIds.includes(r.eventId[0])
      );

      if (affectedRegs.length > 0) {
        const updates = affectedRegs.map((r) => ({
          id: r.id,
          fields: { [REGISTRATIONS_FIELDS.event_id]: [keepId] },
        }));
        await batchOperation(REGISTRATIONS_TABLE_ID, 'update', updates);
        totalRegsRelinked += affectedRegs.length;
      }

      // Delete duplicate event records
      await batchOperation(EVENTS_TABLE_ID, 'destroy', removeIds);
      totalDeleted += removeIds.length;
    } catch (error) {
      console.error(`    ERROR fixing event group ${group.key}: ${error.message}`);
    }
  }

  console.log(`  Events: deleted ${totalDeleted}, re-linked ${totalClassesRelinked} classes + ${totalRegsRelinked} registrations`);
  return { deleted: totalDeleted, classesRelinked: totalClassesRelinked, regsRelinked: totalRegsRelinked };
}

async function fixSchoolBookingDuplicates(duplicates) {
  let totalDeleted = 0;

  for (const group of duplicates) {
    try {
      const removeIds = group.remove.map((r) => r.id);
      await batchOperation(SCHOOL_BOOKINGS_TABLE_ID, 'destroy', removeIds);
      totalDeleted += removeIds.length;
    } catch (error) {
      console.error(`    ERROR fixing booking group ${group.key}: ${error.message}`);
    }
  }

  console.log(`  SchoolBookings: deleted ${totalDeleted}`);
  return { deleted: totalDeleted };
}

async function fixRegistrationDuplicates(duplicates) {
  let totalDeleted = 0;

  for (const group of duplicates) {
    try {
      const removeIds = group.remove.map((r) => r.id);
      await batchOperation(REGISTRATIONS_TABLE_ID, 'destroy', removeIds);
      totalDeleted += removeIds.length;
    } catch (error) {
      console.error(`    ERROR fixing registration group ${group.key}: ${error.message}`);
    }
  }

  console.log(`  Registrations: deleted ${totalDeleted}`);
  return { deleted: totalDeleted };
}

// =============================================================================
// FIX PHASE WRAPPER
// =============================================================================

async function fixPhase(parentDups, eventDups, regDups, bookingDups, registrations, classes) {
  // 1. Parents first
  if (parentDups.length > 0) {
    const answer = await askQuestion(`Fix ${parentDups.length} duplicate groups in Parents? (y/n) `);
    if (answer === 'y') {
      console.log('  Fixing Parents...');
      await fixParentDuplicates(parentDups, registrations);
    } else {
      console.log('  Skipped Parents.');
    }
  }

  // 2. Events second
  if (eventDups.length > 0) {
    const answer = await askQuestion(`Fix ${eventDups.length} duplicate groups in Events? (y/n) `);
    if (answer === 'y') {
      console.log('  Fixing Events...');
      await fixEventDuplicates(eventDups, classes, registrations);
    } else {
      console.log('  Skipped Events.');
    }
  }

  // 3. SchoolBookings third
  if (bookingDups.length > 0) {
    const answer = await askQuestion(`Fix ${bookingDups.length} duplicate groups in SchoolBookings? (y/n) `);
    if (answer === 'y') {
      console.log('  Fixing SchoolBookings...');
      await fixSchoolBookingDuplicates(bookingDups);
    } else {
      console.log('  Skipped SchoolBookings.');
    }
  }

  // 4. Registrations last
  if (regDups.length > 0) {
    const answer = await askQuestion(`Fix ${regDups.length} duplicate groups in Registrations? (y/n) `);
    if (answer === 'y') {
      console.log('  Fixing Registrations...');
      await fixRegistrationDuplicates(regDups);
    } else {
      console.log('  Skipped Registrations.');
    }
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('\n========================================');
  console.log('  Airtable Duplicate Audit');
  console.log('========================================');
  if (DRY_RUN) {
    console.log('  ** DRY RUN MODE -- report only, no changes **');
  }
  console.log('========================================\n');

  // Phase 1: Fetch all tables in parallel
  console.log('Phase 1: Fetching all records...\n');
  const [parents, events, registrations, bookings, classes] = await Promise.all([
    fetchAllParents(),
    fetchAllEvents(),
    fetchAllRegistrations(),
    fetchAllSchoolBookings(),
    fetchAllClasses(),
  ]);

  console.log(`  Parents:        ${parents.length} records`);
  console.log(`  Events:         ${events.length} records`);
  console.log(`  Registrations:  ${registrations.length} records`);
  console.log(`  SchoolBookings: ${bookings.length} records`);
  console.log(`  Classes:        ${classes.length} records`);

  // Phase 2: Detect duplicates
  console.log('\nPhase 2: Detecting duplicates...\n');

  const parentDups = findParentDuplicates(parents);
  const eventDups = findEventDuplicates(events, classes);
  const regDups = findRegistrationDuplicates(registrations);
  const bookingDups = []; // SchoolBookings skipped intentionally

  // Count re-links for summary (mutate groups to attach counts)
  for (const g of parentDups) {
    g.relinkCount = registrations.filter(
      (r) => r.parentId[0] && g.remove.some((rem) => rem.id === r.parentId[0])
    ).length;
  }
  for (const g of eventDups) {
    const removeIds = g.remove.map((r) => r.id);
    const classRelinks = classes.filter((c) => c.eventId[0] && removeIds.includes(c.eventId[0])).length;
    const regRelinks = registrations.filter((r) => r.eventId[0] && removeIds.includes(r.eventId[0])).length;
    g.relinkCount = classRelinks + regRelinks;
  }

  // Phase 3: Report
  console.log('Phase 3: Duplicate Report\n');

  console.log('--- Parents ---');
  printParentReport(parentDups);

  console.log('--- Events ---');
  printEventReport(eventDups);

  console.log('--- Registrations ---');
  printRegistrationReport(regDups);

  console.log('--- SchoolBookings ---');
  printSchoolBookingReport(bookingDups);

  printSummary(parentDups, eventDups, regDups, bookingDups);

  const totalToDelete =
    parentDups.reduce((s, g) => s + g.remove.length, 0) +
    eventDups.reduce((s, g) => s + g.remove.length, 0) +
    regDups.reduce((s, g) => s + g.remove.length, 0) +
    bookingDups.reduce((s, g) => s + g.remove.length, 0);

  if (totalToDelete === 0) {
    console.log('No duplicates found across any table. All clean!');
    return;
  }

  // Phase 4: Confirm & Fix
  if (DRY_RUN) {
    console.log('Dry run complete. Run without --dry-run to fix duplicates.\n');
    return;
  }

  console.log('Phase 4: Fix Duplicates\n');
  await fixPhase(parentDups, eventDups, regDups, bookingDups, registrations, classes);

  console.log('\nDone!\n');
}

// =============================================================================
// RUN
// =============================================================================

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Audit failed:', error);
    process.exit(1);
  });
