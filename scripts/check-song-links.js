require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const SONGS_TABLE_ID = 'tblPjGWQlHuG8jp5X';

async function main() {
  const songTitle = process.argv[2] || 'Verification Test Song';

  console.log('Looking for song: "' + songTitle + '"\n');

  const records = await base(SONGS_TABLE_ID).select({
    filterByFormula: 'SEARCH("' + songTitle + '", {title}) > 0',
    returnFieldsByFieldId: true,
  }).all();

  if (records.length === 0) {
    console.log('Song not found');
    return;
  }

  console.log('Found ' + records.length + ' song(s)\n');

  for (const record of records) {
    console.log('Record ID: ' + record.id);
    console.log('All fields:');
    for (const [fieldId, value] of Object.entries(record.fields)) {
      console.log('  ' + fieldId + ': ' + JSON.stringify(value));
    }
    console.log('---');
  }

  // Check what field IDs are used for linked records
  console.log('\nKnown Song linked field IDs:');
  console.log('  class_link (SONGS_LINKED_FIELD_IDS): Check teacherService.ts');
}

main().catch(console.error);
