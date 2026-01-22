require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const CLASSES_TABLE_ID = 'tbl17SVI5gacwOP0n';

const CLASSES_FIELD_IDS = {
  class_id: 'fld1dXGae9I7xldun',
  class_name: 'fld1kaSb8my7q5mHt',
  legacy_booking_id: 'fldXGF3yXrHeI4vWn',
  total_children: 'flddABwj9UilV2OtG',
  event_id: 'fldSSaeBuQDkOhOIT',
};

async function main() {
  const className = process.argv[2] || 'Verification Test Class';

  console.log('Searching for class: "' + className + '" in Airtable...\n');

  const records = await base(CLASSES_TABLE_ID).select({
    filterByFormula: 'SEARCH("' + className + '", {' + CLASSES_FIELD_IDS.class_name + '}) > 0',
    returnFieldsByFieldId: true,
  }).all();

  if (records.length === 0) {
    console.log('ERROR: Class NOT found in Airtable!');
    process.exit(1);
  }

  console.log('SUCCESS: Found ' + records.length + ' matching class(es)\n');

  for (const record of records) {
    console.log('Record ID: ' + record.id);
    console.log('  class_id: ' + record.fields[CLASSES_FIELD_IDS.class_id]);
    console.log('  class_name: ' + record.fields[CLASSES_FIELD_IDS.class_name]);
    console.log('  legacy_booking_id: ' + record.fields[CLASSES_FIELD_IDS.legacy_booking_id]);
    console.log('  total_children: ' + record.fields[CLASSES_FIELD_IDS.total_children]);
    console.log('  event_id (linked): ' + JSON.stringify(record.fields[CLASSES_FIELD_IDS.event_id]));
    console.log('---');
  }
}

main().catch(console.error);
