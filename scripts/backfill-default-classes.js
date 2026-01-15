/**
 * Backfill script to add "Alle Kinder" catch-all classes to existing events
 *
 * Usage:
 *   node scripts/backfill-default-classes.js          # Dry run (shows what would be created)
 *   node scripts/backfill-default-classes.js --run    # Actually create the classes
 */

const Airtable = require('airtable');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const CLASSES_TABLE_ID = 'tbl17SVI5gacwOP0n';
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const PARENT_JOURNEY_TABLE = 'parent_journey_table';

const CLASSES_FIELD_IDS = {
  class_id: 'fld1dXGae9I7xldun',
  event_id: 'fldSSaeBuQDkOhOIT',
  class_name: 'fld1kaSb8my7q5mHt',
  main_teacher: 'fldsODu2rjT8ZMqLl',
  legacy_booking_id: 'fldXGF3yXrHeI4vWn',
  is_default: 'fldJouWNH4fudWQl0',
  total_children: 'flddABwj9UilV2OtG',
};

const AIRTABLE_FIELD_IDS = {
  booking_id: 'fldUB8dAiQd61VncB',
  class_id: 'fldtiPDposZlSD2lm',
  class: 'fldJMcFElbkkPGhSe',
  school_name: 'fld2Rd4S9aWGOjkJI',
  event_type: 'fldOZ20fduUR0mboV',
  booking_date: 'fldZx9CQHCvoqjJ71',
  parent_email: 'fldwiX1CSfJZS0AIz',
  registered_child: 'flddZJuHdOqeighMf',
  total_children: 'fldonCg4373zaXQfM',
};

const DEFAULT_CLASS_NAME = 'Alle Kinder';

function generateClassId(schoolName, bookingDate, className) {
  const normalize = (str) => str.toLowerCase()
    .replace(/[äöüß]/g, c => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' }[c] || c))
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const schoolSlug = normalize(schoolName).substring(0, 30);
  const dateStr = bookingDate.replace(/-/g, '');
  const classSlug = normalize(className).substring(0, 20);
  const hash = crypto.createHash('md5')
    .update(`${schoolName}${bookingDate}${className}`)
    .digest('hex')
    .substring(0, 6);

  return `cls_${schoolSlug}_${dateStr}_${classSlug}_${hash}`;
}

async function backfillDefaultClasses() {
  const DRY_RUN = !process.argv.includes('--run');

  console.log('='.repeat(60));
  console.log('Backfill Default Classes for Existing Events');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (use --run to execute)' : 'LIVE RUN'}\n`);

  // 1. Get all events
  console.log('1. Fetching all events...');
  const allEvents = [];
  await airtable.table(EVENTS_TABLE_ID)
    .select()
    .eachPage((records, fetchNextPage) => {
      allEvents.push(...records);
      fetchNextPage();
    });

  console.log(`   Found ${allEvents.length} events\n`);

  // 2. Get all existing default classes
  console.log('2. Checking for existing default classes...');
  const existingDefaults = new Set();
  await airtable.table(CLASSES_TABLE_ID)
    .select({
      filterByFormula: `{${CLASSES_FIELD_IDS.is_default}} = TRUE()`,
    })
    .eachPage((records, fetchNextPage) => {
      for (const record of records) {
        const bookingId = record.fields.legacy_booking_id || record.fields[CLASSES_FIELD_IDS.legacy_booking_id];
        if (bookingId) existingDefaults.add(bookingId);
      }
      fetchNextPage();
    });

  console.log(`   Found ${existingDefaults.size} events with default classes\n`);

  // 3. Find events without default classes
  const eventsToBackfill = [];
  for (const event of allEvents) {
    const eventId = event.fields.event_id || event.fields['fldcNaHZyr6E5khDe'];
    if (!existingDefaults.has(eventId)) {
      eventsToBackfill.push({
        recordId: event.id,
        eventId,
        schoolName: event.fields.school_name || event.fields['fld5QcpEsDFrLun6w'] || 'Unknown School',
        eventDate: event.fields.event_date || event.fields['fld7pswBblm9jlOsS'] || '',
      });
    }
  }

  console.log(`3. Events needing default classes: ${eventsToBackfill.length}\n`);

  if (eventsToBackfill.length === 0) {
    console.log('All events already have default classes. Nothing to do.');
    return;
  }

  // 4. Process each event
  console.log('4. Processing events...\n');
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const event of eventsToBackfill) {
    const { recordId, eventId, schoolName, eventDate } = event;

    if (!eventDate) {
      console.log(`   SKIP: ${schoolName} - No event date`);
      skipped++;
      continue;
    }

    const classId = generateClassId(schoolName, eventDate, DEFAULT_CLASS_NAME);
    console.log(`   ${DRY_RUN ? '[DRY]' : '[CREATE]'} ${schoolName} (${eventDate})`);
    console.log(`      Event ID: ${eventId}`);
    console.log(`      Class ID: ${classId}`);

    if (!DRY_RUN) {
      try {
        // Create in parent_journey_table (legacy)
        await airtable.table(PARENT_JOURNEY_TABLE).create({
          [AIRTABLE_FIELD_IDS.booking_id]: eventId,
          [AIRTABLE_FIELD_IDS.class_id]: classId,
          [AIRTABLE_FIELD_IDS.class]: DEFAULT_CLASS_NAME,
          [AIRTABLE_FIELD_IDS.school_name]: schoolName,
          [AIRTABLE_FIELD_IDS.event_type]: 'MiniMusiker',
          [AIRTABLE_FIELD_IDS.booking_date]: eventDate,
          [AIRTABLE_FIELD_IDS.parent_email]: '',
          [AIRTABLE_FIELD_IDS.registered_child]: '',
        });

        // Create in normalized Classes table
        await airtable.table(CLASSES_TABLE_ID).create([{
          fields: {
            [CLASSES_FIELD_IDS.class_id]: classId,
            [CLASSES_FIELD_IDS.class_name]: DEFAULT_CLASS_NAME,
            [CLASSES_FIELD_IDS.main_teacher]: '',
            [CLASSES_FIELD_IDS.legacy_booking_id]: eventId,
            [CLASSES_FIELD_IDS.event_id]: [recordId],
            [CLASSES_FIELD_IDS.is_default]: true,
          }
        }]);

        console.log(`      ✓ Created\n`);
        created++;
      } catch (err) {
        console.log(`      ✗ Error: ${err.message}\n`);
        errors++;
      }
    } else {
      console.log(`      (would create)\n`);
      created++;
    }
  }

  // 5. Summary
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Total events:     ${allEvents.length}`);
  console.log(`Already had:      ${existingDefaults.size}`);
  console.log(`Needed backfill:  ${eventsToBackfill.length}`);
  console.log(`${DRY_RUN ? 'Would create' : 'Created'}:      ${created}`);
  console.log(`Skipped:          ${skipped}`);
  if (!DRY_RUN) console.log(`Errors:           ${errors}`);

  if (DRY_RUN) {
    console.log('\nThis was a dry run. Run with --run to create the classes.');
  }
}

backfillDefaultClasses().catch(console.error);
