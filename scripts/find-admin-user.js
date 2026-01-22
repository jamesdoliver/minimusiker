require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Personen table ID
const PERSONEN_TABLE_ID = 'tbllC4BRaKlxJclaP';

async function main() {
  console.log('Looking for admin users in Personen table...\n');

  const records = await base(PERSONEN_TABLE_ID).select({
    maxRecords: 20,
    returnFieldsByFieldId: true,
  }).firstPage();

  console.log('Found ' + records.length + ' person records\n');

  for (const record of records) {
    const fields = record.fields;

    // Find email and ID fields
    let email = null;
    let numericId = null;
    let name = null;

    for (const [fieldId, value] of Object.entries(fields)) {
      if (typeof value === 'string' && value.includes('@')) {
        email = value;
      }
      if (typeof value === 'number' && value > 0 && value < 10000) {
        numericId = value;
      }
    }

    // Get record name (first text field typically)
    for (const [fieldId, value] of Object.entries(fields)) {
      if (typeof value === 'string' && !value.includes('@') && value.length > 2 && value.length < 50) {
        name = value;
        break;
      }
    }

    console.log('Record: ' + record.id);
    console.log('  Name: ' + (name || 'N/A'));
    console.log('  Email: ' + (email || 'N/A'));
    console.log('  NumericId: ' + (numericId || 'N/A'));
    console.log('  All fields:', JSON.stringify(fields, null, 2).slice(0, 800));
    console.log('---');
  }
}

main().catch(console.error);
