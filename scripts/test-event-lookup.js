/**
 * Test the Event lookup by SchoolBooking ID
 */
require('dotenv').config({ path: '/Users/jamesoliver/WebstormProjects/MiniMusiker/.env.local' });

const Airtable = require('airtable');

const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const SCHOOL_BOOKINGS_TABLE_ID = 'tblrktl5eLJEWE4M6';

const EVENTS_FIELD_IDS = {
  event_id: 'fldcNaHZyr6E5khDe',
  school_name: 'fld5QcpEsDFrLun6w',
  event_date: 'fld7pswBblm9jlOsS',
  simplybook_booking: 'fldK7vyxLd9MxgmES',
  access_code: 'flduhYSy17fsa6n3x',
};

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const base = airtable.base(process.env.AIRTABLE_BASE_ID);

async function test() {
  console.log('Finding Österfeldschule booking...\n');

  // Find the Österfeldschule booking
  let bookingId = null;
  await base(SCHOOL_BOOKINGS_TABLE_ID).select({
    filterByFormula: `SEARCH("Österfeldschule", {school_name})`,
    maxRecords: 1,
  }).eachPage((records, fetchNextPage) => {
    if (records.length > 0) {
      bookingId = records[0].id;
      console.log(`Found booking: ${records[0].get('school_name')}`);
      console.log(`  Booking record ID: ${bookingId}\n`);
    }
    fetchNextPage();
  });

  if (!bookingId) {
    console.log('Booking not found');
    return;
  }

  // Now test the lookup - fetch all Events and filter
  console.log('Testing Event lookup with JS filtering...\n');

  const allEvents = [];
  await base(EVENTS_TABLE_ID).select({
    fields: Object.values(EVENTS_FIELD_IDS),
  }).eachPage((records, fetchNextPage) => {
    allEvents.push(...records);
    fetchNextPage();
  });

  console.log(`Total Events fetched: ${allEvents.length}`);

  // Find matching Event
  const matchingEvent = allEvents.find(record => {
    const bookings = record.get(EVENTS_FIELD_IDS.simplybook_booking);
    return bookings && bookings.includes(bookingId);
  });

  if (matchingEvent) {
    console.log(`\n✓ Found matching Event!`);
    console.log(`  School: ${matchingEvent.get(EVENTS_FIELD_IDS.school_name)}`);
    console.log(`  Event ID: ${matchingEvent.id}`);
    console.log(`  access_code: ${matchingEvent.get(EVENTS_FIELD_IDS.access_code)}`);
    console.log(`  simplybook_booking: ${JSON.stringify(matchingEvent.get(EVENTS_FIELD_IDS.simplybook_booking))}`);
  } else {
    console.log(`\n✗ No matching Event found for booking ${bookingId}`);

    // Show Events that have simplybook_booking links
    console.log('\nEvents with simplybook_booking links:');
    let count = 0;
    for (const e of allEvents) {
      const bookings = e.get(EVENTS_FIELD_IDS.simplybook_booking);
      if (bookings && bookings.length > 0) {
        console.log(`  ${e.get(EVENTS_FIELD_IDS.school_name)}: ${JSON.stringify(bookings)}`);
        count++;
        if (count >= 5) {
          console.log('  ...');
          break;
        }
      }
    }
  }
}

test()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
