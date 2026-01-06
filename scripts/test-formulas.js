require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
const REGISTRATIONS_TABLE_ID = process.env.REGISTRATIONS_TABLE_ID;

const parentRecordId = 'recqwG8NHzTP2luT0';

async function testFormula(description, formula) {
  console.log(`\n--- ${description} ---`);
  console.log(`Formula: ${formula}`);
  try {
    const results = await base(REGISTRATIONS_TABLE_ID)
      .select({
        filterByFormula: formula
      })
      .all();
    console.log(`✅ Found ${results.length} registration(s)`);
    if (results.length > 0) {
      console.log('First result:', results[0].id, JSON.stringify(results[0].fields, null, 2));
    }
    return results.length;
  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
    return -1;
  }
}

async function runTests() {
  console.log('\n🧪 Testing different filter formulas for parent_id...\n');
  console.log(`Looking for parent: ${parentRecordId}`);

  // Test 1: SEARCH with ARRAYJOIN
  await testFormula(
    'Test 1: SEARCH with ARRAYJOIN',
    `SEARCH('${parentRecordId}', ARRAYJOIN({parent_id}))`
  );

  // Test 2: SEARCH with ARRAYJOIN and comma separator
  await testFormula(
    'Test 2: SEARCH with ARRAYJOIN + comma',
    `SEARCH('${parentRecordId}', ARRAYJOIN({parent_id}, ','))`
  );

  // Test 3: FIND instead of SEARCH
  await testFormula(
    'Test 3: FIND with ARRAYJOIN',
    `FIND('${parentRecordId}', ARRAYJOIN({parent_id}))`
  );

  // Test 4: Direct equality check
  await testFormula(
    'Test 4: Direct equality',
    `{parent_id} = '${parentRecordId}'`
  );

  // Test 5: OR with array positions
  await testFormula(
    'Test 5: RECORD_ID check',
    `RECORD_ID() = 'reclQ2rJ7FHx3Cw0P'`
  );

  // Test 6: Using AND with ARRAYJOIN and >0
  await testFormula(
    'Test 6: FIND > 0',
    `FIND('${parentRecordId}', ARRAYJOIN({parent_id}, ',')) > 0`
  );

  // Test 7: Check if parent_id is not empty
  await testFormula(
    'Test 7: parent_id not empty',
    `{parent_id} != ''`
  );

  // Test 8: Using concatenate
  await testFormula(
    'Test 8: CONCATENATE approach',
    `FIND('${parentRecordId}', CONCATENATE({parent_id}))`
  );

  // Test 9: Simple field existence
  await testFormula(
    'Test 9: Check Id field = 4',
    `{Id} = 4`
  );

  console.log('\n✅ Tests complete');
}

runTests();
