/**
 * Test different Airtable filter formulas for linked records
 */

require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');

const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const airtable = new Airtable({ apiKey: AIRTABLE_API_KEY });
const base = airtable.base(AIRTABLE_BASE_ID);

// Test booking ID we know is linked
const testBookingId = 'recCiDznI8faQYP9v';  // Österfeldschule

async function testFilters() {
  console.log('Testing Airtable filter formulas...\n');
  console.log(`Looking for Events linked to booking: ${testBookingId}\n`);

  const formulas = [
    // Different formula attempts
    `FIND("${testBookingId}", ARRAYJOIN({simplybook_booking}))`,
    `FIND("${testBookingId}", {simplybook_booking})`,
    `SEARCH("${testBookingId}", ARRAYJOIN({simplybook_booking}))`,
    // For linked record, try matching the display value (school name)
    `{simplybook_booking} = "${testBookingId}"`,
  ];

  for (const formula of formulas) {
    console.log(`Formula: ${formula}`);
    try {
      const records = await base(EVENTS_TABLE_ID).select({
        filterByFormula: formula,
        maxRecords: 1,
      }).firstPage();

      if (records.length > 0) {
        console.log(`  ✓ Found: ${records[0].get('school_name')} (access_code: ${records[0].get('access_code')})`);
      } else {
        console.log(`  ✗ No results`);
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
    }
    console.log();
  }

  // Alternative: Fetch events with simplybook_booking and filter in JS
  console.log('\nAlternative: Fetch and filter in JavaScript...');
  const allEvents = [];
  await base(EVENTS_TABLE_ID).select({
    filterByFormula: `{simplybook_booking} != ""`,
    fields: ['school_name', 'simplybook_booking', 'access_code'],
    maxRecords: 100,
  }).eachPage((records, fetchNextPage) => {
    allEvents.push(...records);
    fetchNextPage();
  });

  const matchingEvent = allEvents.find(record => {
    const bookings = record.get('simplybook_booking');
    return bookings && bookings.includes(testBookingId);
  });

  if (matchingEvent) {
    console.log(`  ✓ Found via JS filter: ${matchingEvent.get('school_name')} (access_code: ${matchingEvent.get('access_code')})`);
  } else {
    console.log(`  ✗ Not found via JS filter`);
  }
}

testFilters()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
