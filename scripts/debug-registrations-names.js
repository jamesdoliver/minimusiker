require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
const REGISTRATIONS_TABLE_ID = process.env.REGISTRATIONS_TABLE_ID;

async function debugRegistrationsByName() {
  console.log('\n📋 Fetching registrations with FIELD NAMES...\n');

  try {
    const registrations = await base(REGISTRATIONS_TABLE_ID)
      .select()
      .all();

    console.log(`✅ Found ${registrations.length} registration(s)\n`);

    registrations.forEach((reg, index) => {
      console.log(`\n--- Registration ${index + 1} ---`);
      console.log('Record ID:', reg.id);
      console.log('\nField names and values:');
      console.log(JSON.stringify(reg.fields, null, 2));
    });

    // Test with field names
    console.log('\n\n🧪 Testing query with field NAMES...');
    const parentRecordId = 'recqwG8NHzTP2luT0';

    const results = await base(REGISTRATIONS_TABLE_ID)
      .select({
        filterByFormula: `SEARCH('${parentRecordId}', ARRAYJOIN({parent_id}))`
      })
      .all();

    console.log(`\n✅ Found ${results.length} registration(s) for parent ${parentRecordId}`);

    if (results.length > 0) {
      results.forEach((reg, index) => {
        console.log(`\nResult ${index + 1}:`, JSON.stringify(reg.fields, null, 2));
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugRegistrationsByName();
