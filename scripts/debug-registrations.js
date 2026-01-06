require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
const REGISTRATIONS_TABLE_ID = process.env.REGISTRATIONS_TABLE_ID;

async function debugRegistrations() {
  console.log('\n📋 Fetching all registrations from Registrations table...\n');

  try {
    const registrations = await base(REGISTRATIONS_TABLE_ID)
      .select({
        returnFieldsByFieldId: true
      })
      .all();

    console.log(`✅ Found ${registrations.length} total registration(s)\n`);

    if (registrations.length === 0) {
      console.log('❌ No registrations found in table!');
      return;
    }

    registrations.forEach((reg, index) => {
      console.log(`\n--- Registration ${index + 1} ---`);
      console.log('Record ID:', reg.id);
      console.log('\nAll fields:');
      console.log(JSON.stringify(reg.fields, null, 2));

      // Try to identify the parent_id field
      const fields = reg.fields;
      console.log('\n🔍 Looking for parent_id field:');

      // Check various possible field formats
      if (fields.parent_id) {
        console.log('  ✅ Found fields.parent_id:', fields.parent_id);
      }
      if (fields.fldParent || fields.fldparent) {
        console.log('  ✅ Found fields.fldParent:', fields.fldParent || fields.fldparent);
      }

      // List all field keys to help identify the correct one
      console.log('\n📝 All field keys:', Object.keys(fields));
    });

    // Now test the query formula that's failing
    console.log('\n\n🧪 Testing query formula...');
    const parentRecordId = 'recqwG8NHzTP2luT0';

    // Test 1: Current formula with SEARCH
    console.log('\n--- Test 1: SEARCH with ARRAYJOIN ---');
    try {
      const test1 = await base(REGISTRATIONS_TABLE_ID)
        .select({
          filterByFormula: `SEARCH('${parentRecordId}', ARRAYJOIN({parent_id}))`,
          returnFieldsByFieldId: true
        })
        .all();
      console.log(`✅ Found ${test1.length} registration(s)`);
    } catch (err) {
      console.log('❌ Error:', err.message);
    }

    // Test 2: Direct field match
    console.log('\n--- Test 2: Direct field match ---');
    try {
      const test2 = await base(REGISTRATIONS_TABLE_ID)
        .select({
          filterByFormula: `{parent_id} = '${parentRecordId}'`,
          returnFieldsByFieldId: true
        })
        .all();
      console.log(`✅ Found ${test2.length} registration(s)`);
    } catch (err) {
      console.log('❌ Error:', err.message);
    }

    // Test 3: Without returnFieldsByFieldId
    console.log('\n--- Test 3: SEARCH without returnFieldsByFieldId ---');
    try {
      const test3 = await base(REGISTRATIONS_TABLE_ID)
        .select({
          filterByFormula: `SEARCH('${parentRecordId}', ARRAYJOIN({parent_id}))`
        })
        .all();
      console.log(`✅ Found ${test3.length} registration(s)`);
      if (test3.length > 0) {
        console.log('First result fields:', JSON.stringify(test3[0].fields, null, 2));
      }
    } catch (err) {
      console.log('❌ Error:', err.message);
    }

  } catch (error) {
    console.error('❌ Error fetching registrations:', error);
  }
}

debugRegistrations();
