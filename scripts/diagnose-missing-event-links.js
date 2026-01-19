#!/usr/bin/env node
/**
 * Diagnostic script to investigate why classes are missing event_id links
 *
 * This script:
 * 1. Queries the affected class records
 * 2. Checks if corresponding Events exist
 * 3. Checks if Events are linked to SchoolBookings
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
  class_name: 'fldqLJREP6vHCFHlw',
  event_id: 'fldSSaeBuQDkOhOIT',
  legacy_booking_id: 'fldXGF3yXrHeI4vWn',
};

const EVENTS_FIELDS = {
  event_id: 'fldcNaHZyr6E5khDe',
  school_name: 'fld15WUZ2hXDT0b9B',
  event_date: 'fld7nYlVpJNlvWCYc',
  simplybook_booking: 'fld9hM46FgV6nTmWJ',
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

async function main() {
  console.log('=== Diagnosing Missing Event Links ===\n');

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
        className: record.get('class_name'),
        eventId: record.get('event_id'), // Linked record field
        legacyBookingId: record.get('legacy_booking_id'),
      });
    } else {
      console.log(`  WARNING: Class not found: ${classId}`);
    }
  }

  console.log(`Found ${classRecords.length} class records:\n`);

  // Group by missing vs present event_id
  const missingEventId = classRecords.filter(c => !c.eventId || c.eventId.length === 0);
  const hasEventId = classRecords.filter(c => c.eventId && c.eventId.length > 0);

  console.log(`  - Classes WITH event_id link: ${hasEventId.length}`);
  console.log(`  - Classes WITHOUT event_id link: ${missingEventId.length}\n`);

  if (missingEventId.length === 0) {
    console.log('All classes already have event_id links!');
    return;
  }

  // Step 2: Check what legacy_booking_id values we have
  console.log('Step 2: Checking legacy_booking_id values...\n');

  const legacyIds = new Set();
  for (const cls of missingEventId) {
    if (cls.legacyBookingId) {
      legacyIds.add(cls.legacyBookingId);
    }
    console.log(`  ${cls.classId}`);
    console.log(`    legacy_booking_id: ${cls.legacyBookingId || 'MISSING'}`);
    console.log(`    event_id link: ${cls.eventId ? cls.eventId.join(', ') : 'MISSING'}\n`);
  }

  // Step 3: Search for Events that should match
  console.log('Step 3: Searching for matching Events...\n');

  // Extract unique school/date patterns from class_ids
  const patterns = new Map();
  for (const cls of missingEventId) {
    // Parse: cls_schule_an_der_ruhr_20260205_className_hash
    const match = cls.classId.match(/^cls_(.+?)_(\d{8})_/);
    if (match) {
      const schoolSlug = match[1];
      const dateStr = match[2];
      const key = `${schoolSlug}_${dateStr}`;
      if (!patterns.has(key)) {
        patterns.set(key, { schoolSlug, dateStr, classes: [] });
      }
      patterns.get(key).classes.push(cls);
    }
  }

  console.log(`Found ${patterns.size} unique school/date combinations:\n`);

  for (const [key, data] of patterns) {
    console.log(`  Pattern: ${key}`);
    console.log(`    School slug: ${data.schoolSlug}`);
    console.log(`    Date: ${data.dateStr}`);
    console.log(`    Classes: ${data.classes.length}`);

    // Search for Event with matching pattern
    // Expected event_id format: evt_schoolslug_minimusiker_YYYYMMDD
    const expectedEventId = `evt_${data.schoolSlug}_minimusiker_${data.dateStr}`;
    console.log(`    Expected event_id: ${expectedEventId}`);

    const eventRecords = await base(EVENTS_TABLE)
      .select({
        filterByFormula: `FIND('${data.schoolSlug}', LOWER({event_id})) > 0`,
        maxRecords: 10,
      })
      .firstPage();

    if (eventRecords.length > 0) {
      console.log(`    Found ${eventRecords.length} potential Event matches:`);
      for (const event of eventRecords) {
        const eventId = event.get('event_id');
        const schoolName = event.get('school_name');
        const eventDate = event.get('event_date');
        const simplybookBooking = event.get('simplybook_booking');

        console.log(`      - Event record: ${event.id}`);
        console.log(`        event_id: ${eventId}`);
        console.log(`        school_name: ${schoolName}`);
        console.log(`        event_date: ${eventDate}`);
        console.log(`        simplybook_booking: ${simplybookBooking ? simplybookBooking.join(', ') : 'NOT LINKED'}`);
      }
    } else {
      console.log(`    NO EVENTS FOUND for this pattern!`);
    }
    console.log('');
  }

  // Step 4: Check SchoolBookings for these schools
  console.log('Step 4: Checking SchoolBookings...\n');

  for (const [key, data] of patterns) {
    console.log(`  Searching SchoolBookings for: ${data.schoolSlug}`);

    const bookings = await base(SCHOOL_BOOKINGS_TABLE)
      .select({
        filterByFormula: `FIND('${data.schoolSlug.replace(/_/g, ' ')}', LOWER({school_name})) > 0`,
        maxRecords: 5,
      })
      .firstPage();

    if (bookings.length > 0) {
      console.log(`    Found ${bookings.length} SchoolBookings:`);
      for (const booking of bookings) {
        const schoolName = booking.get('school_name');
        const startDate = booking.get('start_date');
        const simplybookId = booking.get('simplybook_id');

        console.log(`      - Booking record: ${booking.id}`);
        console.log(`        school_name: ${schoolName}`);
        console.log(`        start_date: ${startDate}`);
        console.log(`        simplybook_id: ${simplybookId}`);
      }
    } else {
      console.log(`    No SchoolBookings found`);
    }
    console.log('');
  }

  // Summary
  console.log('=== SUMMARY ===\n');
  console.log(`Total affected classes: ${missingEventId.length}`);
  console.log(`Unique legacy_booking_id values: ${legacyIds.size}`);
  console.log(`Legacy IDs: ${Array.from(legacyIds).join(', ')}`);
  console.log('\nNext steps:');
  console.log('1. If Events exist, update classes to link to them');
  console.log('2. If Events missing simplybook_booking, link them to SchoolBookings');
}

main().catch(console.error);
