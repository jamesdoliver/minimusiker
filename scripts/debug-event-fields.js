/**
 * Debug - check raw Event data
 */
require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');

const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const base = airtable.base(process.env.AIRTABLE_BASE_ID);

async function debug() {
  console.log('Checking Österfeldschule Event...\n');

  // Use SEARCH filter to find by school name
  const records = await base(EVENTS_TABLE_ID).select({
    filterByFormula: `SEARCH("Österfeldschule", {school_name})`,
    maxRecords: 1,
  }).firstPage();

  if (records.length === 0) {
    console.log('No Event found for Österfeldschule');
    return;
  }

  const record = records[0];
  console.log('Event record ID:', record.id);
  console.log('\nAll fields (raw):');
  console.log(JSON.stringify(record.fields, null, 2));

  // Try both methods of accessing simplybook_booking
  console.log('\nAccessing simplybook_booking:');
  console.log('  By field name:', record.get('simplybook_booking'));
  console.log('  By field ID (fldK7vyxLd9MxgmES):', record.get('fldK7vyxLd9MxgmES'));
}

debug()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
