#!/usr/bin/env node
/**
 * Clean Up Duplicate Child Registrations
 *
 * For each set of duplicate registrations (same child + parent + event):
 * - Keep the earliest registration (by registration_date)
 * - Delete all others
 *
 * Target: "Schule an der Ruhr" event (2026-02-05)
 *
 * Usage:
 *   node scripts/cleanup-duplicate-registrations.js --dry-run
 *   node scripts/cleanup-duplicate-registrations.js
 */

require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');

// =============================================================================
// TABLE IDs
// =============================================================================

const REGISTRATIONS_TABLE_ID = 'tblXsmPuZcePcre5u';
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';

// =============================================================================
// FIELD NAMES
// =============================================================================

const REGISTRATION_FIELDS = {
  event_id: 'event_id',
  parent_id: 'parent_id',
  registered_child: 'registered_child',
  class_id: 'class_id',
  registration_date: 'registration_date',
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

// Target event identifier
const TARGET_EVENT_SCHOOL = 'schule_an_der_ruhr';
const TARGET_EVENT_DATE = '2026-02-05';

// =============================================================================
// DATA FETCHING
// =============================================================================

/**
 * Find the Ruhr event record ID
 */
async function findRuhrEventRecordId() {
  console.log('Looking for Schule an der Ruhr event...');

  const events = [];

  await base(EVENTS_TABLE_ID)
    .select({
      fields: ['event_id', 'school_name', 'event_date'],
    })
    .eachPage((records, fetchNextPage) => {
      for (const record of records) {
        const eventId = record.get('event_id') || '';
        const eventDate = record.get('event_date') || '';

        if (eventId.includes(TARGET_EVENT_SCHOOL) && eventDate.startsWith(TARGET_EVENT_DATE)) {
          events.push({
            recordId: record.id,
            eventId: eventId,
            schoolName: record.get('school_name'),
            eventDate: eventDate,
          });
        }
      }
      fetchNextPage();
    });

  if (events.length === 0) {
    throw new Error(`Could not find event for ${TARGET_EVENT_SCHOOL} on ${TARGET_EVENT_DATE}`);
  }

  console.log(`Found event: ${events[0].eventId} (record: ${events[0].recordId})`);
  return events[0].recordId;
}

/**
 * Fetch all registrations for the target event
 */
async function fetchRegistrationsForEvent(eventRecordId) {
  console.log('\nFetching registrations for event...');

  const registrations = [];

  await base(REGISTRATIONS_TABLE_ID)
    .select()
    .eachPage((records, fetchNextPage) => {
      for (const record of records) {
        // event_id is a linked record field - it returns an array of record IDs
        const eventLinks = record.get(REGISTRATION_FIELDS.event_id) || [];
        const parentLinks = record.get(REGISTRATION_FIELDS.parent_id) || [];

        if (eventLinks.includes(eventRecordId)) {
          registrations.push({
            recordId: record.id,
            eventId: eventLinks,
            parentId: parentLinks.length > 0 ? parentLinks[0] : null,
            childName: record.get(REGISTRATION_FIELDS.registered_child) || '',
            classId: record.get(REGISTRATION_FIELDS.class_id),
            registrationDate: record.get(REGISTRATION_FIELDS.registration_date),
          });
        }
      }
      fetchNextPage();
    });

  console.log(`Found ${registrations.length} registrations for this event`);
  return registrations;
}

// =============================================================================
// DUPLICATE DETECTION
// =============================================================================

/**
 * Normalize child name for comparison (lowercase, trim whitespace)
 */
function normalizeChildName(name) {
  if (!name) return '';
  return name.toLowerCase().trim();
}

/**
 * Group registrations by child + parent to find duplicates
 */
function findDuplicateGroups(registrations) {
  const groups = new Map();

  for (const reg of registrations) {
    // Key: normalized child name + parent ID
    const key = `${normalizeChildName(reg.childName)}|${reg.parentId || 'no_parent'}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(reg);
  }

  // Filter to only groups with multiple registrations (duplicates)
  const duplicates = [];
  for (const [key, regList] of groups) {
    if (regList.length > 1) {
      const [childName, parentId] = key.split('|');
      duplicates.push({
        childName: regList[0].childName, // Use original name for display
        normalizedChildName: childName,
        parentId: parentId,
        registrations: regList,
        duplicateCount: regList.length,
      });
    }
  }

  // Sort by duplicate count (most duplicates first)
  duplicates.sort((a, b) => b.duplicateCount - a.duplicateCount);

  return duplicates;
}

// =============================================================================
// CLEANUP FUNCTIONS
// =============================================================================

/**
 * Delete registration records in batches
 */
async function deleteRegistrations(recordIds) {
  if (recordIds.length === 0) return;

  console.log(`\n  Deleting ${recordIds.length} duplicate registration records...`);

  if (DRY_RUN) {
    for (const id of recordIds) {
      console.log(`    [DRY RUN] Would delete: ${id}`);
    }
    return;
  }

  // Delete in batches of 10 (Airtable limit)
  const batchSize = 10;
  for (let i = 0; i < recordIds.length; i += batchSize) {
    const batch = recordIds.slice(i, i + batchSize);
    await base(REGISTRATIONS_TABLE_ID).destroy(batch);
    console.log(`    Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(recordIds.length / batchSize)}`);
  }
}

// =============================================================================
// MAIN CLEANUP
// =============================================================================

async function cleanupDuplicateRegistrations() {
  console.log('\n========================================');
  console.log('  Cleanup Duplicate Registrations');
  console.log('========================================');
  if (DRY_RUN) {
    console.log('  ** DRY RUN MODE - No changes will be made **');
  }
  console.log('========================================\n');

  // Find the target event
  const eventRecordId = await findRuhrEventRecordId();

  // Fetch all registrations for this event
  const registrations = await fetchRegistrationsForEvent(eventRecordId);

  if (registrations.length === 0) {
    console.log('\nNo registrations found for this event!');
    return;
  }

  // Find duplicates
  console.log('\nSearching for duplicate registrations...\n');
  const duplicateGroups = findDuplicateGroups(registrations);

  if (duplicateGroups.length === 0) {
    console.log('No duplicate registrations found!');
    console.log(`All ${registrations.length} registrations are unique.`);
    return;
  }

  // Calculate totals
  const totalDuplicates = duplicateGroups.reduce(
    (sum, g) => sum + (g.duplicateCount - 1),
    0
  );

  console.log(`Found ${duplicateGroups.length} children with duplicate registrations`);
  console.log(`Total duplicate records to remove: ${totalDuplicates}`);
  console.log(`Expected final registration count: ${registrations.length - totalDuplicates}\n`);

  // Display duplicate groups
  console.log('Duplicate Groups:');
  console.log('----------------------------------------');

  const allRecordsToDelete = [];
  const auditLog = [];

  for (const group of duplicateGroups) {
    console.log(`\nChild: "${group.childName}" (${group.duplicateCount} registrations)`);
    console.log(`  Parent ID: ${group.parentId}`);

    // Sort by registration_date ascending (keep earliest)
    const sorted = [...group.registrations].sort((a, b) => {
      const dateA = a.registrationDate ? new Date(a.registrationDate) : new Date(0);
      const dateB = b.registrationDate ? new Date(b.registrationDate) : new Date(0);
      return dateA - dateB;
    });

    const keep = sorted[0];
    const toDelete = sorted.slice(1);

    console.log(`  KEEP:   ${keep.recordId} (registered: ${keep.registrationDate || 'unknown'})`);

    for (const reg of toDelete) {
      console.log(`  DELETE: ${reg.recordId} (registered: ${reg.registrationDate || 'unknown'})`);
      allRecordsToDelete.push(reg.recordId);

      // Add to audit log
      auditLog.push({
        action: 'DELETE',
        recordId: reg.recordId,
        childName: reg.childName,
        parentId: reg.parentId,
        registrationDate: reg.registrationDate,
        reason: `Duplicate of ${keep.recordId}`,
      });
    }
  }

  // Perform deletion
  console.log('\n========================================');
  console.log('  Executing Cleanup');
  console.log('========================================');

  await deleteRegistrations(allRecordsToDelete);

  // Output audit log
  console.log('\n========================================');
  console.log('  Audit Log');
  console.log('========================================');

  if (DRY_RUN) {
    console.log('\n[DRY RUN] The following records WOULD be deleted:\n');
  } else {
    console.log('\nThe following records were deleted:\n');
  }

  console.log(JSON.stringify(auditLog, null, 2));

  // Summary
  console.log('\n========================================');
  console.log('  Summary');
  console.log('========================================');
  console.log(`Children with duplicates:     ${duplicateGroups.length}`);
  console.log(`Duplicate records removed:    ${allRecordsToDelete.length}`);
  console.log(`Original registration count:  ${registrations.length}`);
  console.log(`Expected final count:         ${registrations.length - allRecordsToDelete.length}`);

  if (DRY_RUN) {
    console.log('\n** DRY RUN - No changes were made **');
    console.log('Run without --dry-run to execute the cleanup.\n');
  } else {
    console.log('\nCleanup complete! Duplicate registrations have been removed.\n');
  }
}

// =============================================================================
// RUN
// =============================================================================

cleanupDuplicateRegistrations()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  });
