const Airtable = require('airtable');
require('dotenv').config({ path: '.env.local' });

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';

const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() + 19);
const cutoffStr = cutoffDate.toISOString().split('T')[0];

console.log('Looking for events after:', cutoffStr);
console.log('---');

base(EVENTS_TABLE_ID).select({
  filterByFormula: `IS_AFTER({event_date}, '${cutoffStr}')`,
  maxRecords: 5,
}).firstPage((err, records) => {
  if (err) { console.error(err); return; }
  if (records.length === 0) {
    console.log('No events found >19 days in the future');
    return;
  }
  console.log(`Found ${records.length} events. Use any of these event_id values for early-bird testing:\n`);
  records.forEach(r => {
    console.log(`Event ID: ${r.fields.event_id}`);
    console.log(`  School: ${r.fields.school_name}`);
    console.log(`  Date: ${r.fields.event_date}`);
    console.log('');
  });
});
