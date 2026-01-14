/**
 * Debug script to check Event-Booking links and access_codes
 */

require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');

const SCHOOL_BOOKINGS_TABLE_ID = 'tblrktl5eLJEWE4M6';
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID environment variables');
  process.exit(1);
}

const airtable = new Airtable({ apiKey: AIRTABLE_API_KEY });
const base = airtable.base(AIRTABLE_BASE_ID);

async function debug() {
  console.log('\n=== Debug: Event-Booking Links ===\n');

  // Get first few Events with their simplybook_booking and access_code
  console.log('Fetching Events...\n');

  const events = [];
  await base(EVENTS_TABLE_ID)
    .select({
      maxRecords: 10,
      fields: ['event_id', 'school_name', 'simplybook_booking', 'access_code'],
    })
    .eachPage((records, fetchNextPage) => {
      for (const record of records) {
        events.push({
          id: record.id,
          event_id: record.get('event_id'),
          school_name: record.get('school_name'),
          simplybook_booking: record.get('simplybook_booking'),
          access_code: record.get('access_code'),
        });
      }
      fetchNextPage();
    });

  console.log('Sample Events:');
  for (const event of events) {
    console.log(`  ${event.school_name}:`);
    console.log(`    event_id: ${event.event_id}`);
    console.log(`    simplybook_booking: ${JSON.stringify(event.simplybook_booking)}`);
    console.log(`    access_code: ${event.access_code}`);
    console.log();
  }

  // Get first few SchoolBookings
  console.log('\nFetching SchoolBookings...\n');

  const bookings = [];
  await base(SCHOOL_BOOKINGS_TABLE_ID)
    .select({
      maxRecords: 5,
      fields: ['school_name', 'start_date'],
    })
    .eachPage((records, fetchNextPage) => {
      for (const record of records) {
        bookings.push({
          id: record.id,
          school_name: record.get('school_name'),
          start_date: record.get('start_date'),
        });
      }
      fetchNextPage();
    });

  console.log('Sample SchoolBookings:');
  for (const booking of bookings) {
    console.log(`  ${booking.school_name}:`);
    console.log(`    booking record id: ${booking.id}`);
    console.log(`    start_date: ${booking.start_date}`);

    // Try the FIND query
    const findFormula = `FIND("${booking.id}", ARRAYJOIN({simplybook_booking}))`;
    console.log(`    Testing FIND formula: ${findFormula}`);

    try {
      const eventRecords = await base(EVENTS_TABLE_ID).select({
        filterByFormula: findFormula,
        maxRecords: 1,
      }).firstPage();

      if (eventRecords.length > 0) {
        console.log(`    ✓ Found matching Event: ${eventRecords[0].get('school_name')} (access_code: ${eventRecords[0].get('access_code')})`);
      } else {
        console.log(`    ✗ No Event found with this booking link`);
      }
    } catch (error) {
      console.log(`    ✗ Query error: ${error.message}`);
    }
    console.log();
  }
}

debug()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Debug failed:', error);
    process.exit(1);
  });
