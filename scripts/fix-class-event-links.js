#!/usr/bin/env node
/**
 * Fix script to backfill event_id links on classes that are missing them
 *
 * Root cause: Classes were created with simplybookId (e.g., "1602") as the eventId
 * because getEventBySchoolBookingId() returned null (Event not linked to SchoolBooking).
 * This caused getEventByEventId("1602") to fail, so classes were created without event_id link.
 *
 * This script:
 * 1. For each affected class, finds the Event by matching school/date pattern
 * 2. Updates the class to link to the Event via event_id field
 */

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID');
  process.exit(1);
}

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

// Table and field IDs (from src/lib/types/airtable.ts)
const CLASSES_TABLE = 'tbl17SVI5gacwOP0n';
const EVENTS_TABLE = 'tblVWx1RrsGRjsNn5'; // Correct ID from airtable.ts
const SCHOOL_BOOKINGS_TABLE = 'tblrktl5eLJEWE4M6';

const CLASSES_FIELDS = {
  class_id: 'fld1dXGae9I7xldun',
  event_id: 'fldSSaeBuQDkOhOIT',
  legacy_booking_id: 'fldXGF3yXrHeI4vWn',
};

// Affected class IDs from the bug report
const AFFECTED_CLASS_IDS = [
  'cls_schule_an_der_ruhr_20260205_1azwergesel_fb7b4d',
  'cls_schule_an_der_ruhr_20260205_1belefanten_166fc8',
  'cls_schule_an_der_ruhr_20260205_1cseehunde_0f7aee',
  'cls_schule_an_der_ruhr_20260205_2abienen_c9dcef',
  'cls_schule_an_der_ruhr_20260205_2bkatzen_659fa6',
  'cls_schule_an_der_ruhr_20260205_2cknguru_b0b2e0',
  'cls_schule_an_der_ruhr_20260205_3apinguin_7a7b41',
  'cls_schule_an_der_ruhr_20260205_3beichhrnchen_322ab0',
  'cls_schule_an_der_ruhr_20260205_3cdelfin_e1d57b',
  'cls_schule_an_der_ruhr_20260205_4aesel_91fb9a',
  'cls_schule_an_der_ruhr_20260205_4bfuchs_1422bf',
  'cls_schule_an_der_ruhr_20260205_4cschmetterling_a18339',
  'cls_gs_buchhaltung_20260330_3f_f60338',
  'cls_schule_an_der_ruhr_20260205_pausenchor_064718',
  'cls_schule_an_der_ruhr_20260205_jg1_04e7f4',
  'cls_schule_an_der_ruhr_20260205_jg2_205833',
  'cls_schule_an_der_ruhr_20260205_jg3_a1bb31',
  'cls_schule_an_der_ruhr_20260205_jahrgang4_70d273',
];

const DRY_RUN = process.argv.includes('--dry-run');

async function findEventBySimplybookId(simplybookId) {
  // Find SchoolBooking by simplybookId
  const bookings = await base(SCHOOL_BOOKINGS_TABLE)
    .select({
      filterByFormula: `{simplybook_id} = '${simplybookId}'`,
      maxRecords: 1,
    })
    .firstPage();

  if (bookings.length === 0) {
    console.log(`    No SchoolBooking found for simplybookId: ${simplybookId}`);
    return null;
  }

  const booking = bookings[0];
  const bookingRecordId = booking.id;
  const schoolName = booking.get('school_name');
  const startDate = booking.get('start_date');
  console.log(`    Found SchoolBooking: ${bookingRecordId}`);
  console.log(`    School: ${schoolName}, Date: ${startDate}`);

  // Generate expected event_id pattern to search directly
  if (!schoolName || !startDate) {
    console.log(`    Missing school_name or start_date`);
    return null;
  }

  const schoolSlug = schoolName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 30);
  const dateStr = startDate.replace(/-/g, '');

  // Try exact event_id match first
  const expectedEventId = `evt_${schoolSlug}_minimusiker_${dateStr}`;
  console.log(`    Looking for event_id: ${expectedEventId}`);

  let events = await base(EVENTS_TABLE)
    .select({
      filterByFormula: `{event_id} = '${expectedEventId}'`,
      maxRecords: 1,
    })
    .firstPage();

  if (events.length > 0) {
    console.log(`    Found Event: ${events[0].id}`);
    return events[0];
  }

  // Try partial match with school slug
  console.log(`    Exact match failed, trying partial match...`);
  events = await base(EVENTS_TABLE)
    .select({
      filterByFormula: `AND(FIND('${schoolSlug}', LOWER({event_id})) > 0, FIND('${dateStr}', {event_id}) > 0)`,
      maxRecords: 5,
    })
    .firstPage();

  if (events.length > 0) {
    console.log(`    Found ${events.length} Events by partial match:`);
    for (const event of events) {
      console.log(`      - ${event.id}: ${event.get('event_id')}`);
    }
    return events[0];
  }

  // Last resort: search by school_name field
  console.log(`    Trying search by school_name field...`);
  events = await base(EVENTS_TABLE)
    .select({
      filterByFormula: `AND({school_name} = '${schoolName.replace(/'/g, "\\'")}', {event_date} = '${startDate}')`,
      maxRecords: 5,
    })
    .firstPage();

  if (events.length > 0) {
    console.log(`    Found Event by school_name/date: ${events[0].id}`);
    return events[0];
  }

  console.log(`    No Event found for simplybookId: ${simplybookId}`);
  return null;
}

async function main() {
  console.log('=== Fixing Missing Event Links ===\n');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (will update records)'}\n`);

  // Step 1: Fetch the affected class records
  console.log('Step 1: Fetching affected class records...\n');

  const classRecords = [];
  for (const classId of AFFECTED_CLASS_IDS) {
    const records = await base(CLASSES_TABLE)
      .select({
        filterByFormula: `{class_id} = '${classId}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length > 0) {
      const record = records[0];
      classRecords.push({
        recordId: record.id,
        classId: record.get('class_id'),
        eventIdLink: record.get('event_id'),
        legacyBookingId: record.get('legacy_booking_id'),
      });
    }
  }

  console.log(`Found ${classRecords.length} class records\n`);

  // Filter to only classes missing event_id
  const classesToFix = classRecords.filter(c => !c.eventIdLink || c.eventIdLink.length === 0);
  console.log(`Classes needing fix: ${classesToFix.length}\n`);

  if (classesToFix.length === 0) {
    console.log('No classes need fixing!');
    return;
  }

  // Group by legacy_booking_id (simplybookId)
  const bySimplybookId = new Map();
  for (const cls of classesToFix) {
    const sbId = cls.legacyBookingId;
    if (!bySimplybookId.has(sbId)) {
      bySimplybookId.set(sbId, []);
    }
    bySimplybookId.get(sbId).push(cls);
  }

  console.log(`Unique simplybookIds: ${bySimplybookId.size}\n`);

  // Step 2: For each simplybookId, find the Event and update classes
  let fixed = 0;
  let failed = 0;

  for (const [simplybookId, classes] of bySimplybookId) {
    console.log(`\nProcessing simplybookId: ${simplybookId} (${classes.length} classes)`);

    const event = await findEventBySimplybookId(simplybookId);

    if (!event) {
      console.log(`  FAILED: Could not find Event for simplybookId ${simplybookId}`);
      failed += classes.length;
      continue;
    }

    const eventRecordId = event.id;
    const eventId = event.get('event_id');

    for (const cls of classes) {
      console.log(`  Updating class: ${cls.classId}`);
      console.log(`    Record ID: ${cls.recordId}`);
      console.log(`    Linking to Event: ${eventRecordId} (${eventId})`);

      if (!DRY_RUN) {
        try {
          await base(CLASSES_TABLE).update(cls.recordId, {
            [CLASSES_FIELDS.event_id]: [eventRecordId],
          });
          console.log(`    SUCCESS: Updated event_id link`);
          fixed++;
        } catch (err) {
          console.log(`    ERROR: ${err.message}`);
          failed++;
        }
      } else {
        console.log(`    DRY RUN: Would update event_id to [${eventRecordId}]`);
        fixed++;
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total classes processed: ${classesToFix.length}`);
  console.log(`Fixed: ${fixed}`);
  console.log(`Failed: ${failed}`);

  if (DRY_RUN) {
    console.log('\nThis was a DRY RUN. Run without --dry-run to apply changes.');
  }
}

main().catch(console.error);
