require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const SONGS_TABLE_ID = 'tblPjGWQlHuG8jp5X';
const CLASSES_TABLE_ID = 'tbl17SVI5gacwOP0n';

const CLASSES_FIELD_IDS = {
  class_id: 'fld1dXGae9I7xldun',
};

const SONGS_LINKED_FIELD_IDS = {
  class_link: 'fldMPAHLnyNralsLS',
};

async function main() {
  const classId = process.argv[2] || 'cls_test_school_20260320_verificationtes_bc4a53';

  console.log('Testing song query for classId: ' + classId + '\n');

  // Step 1: Find the class record
  console.log('1. Finding class record...');
  const classRecords = await base(CLASSES_TABLE_ID).select({
    filterByFormula: '{' + CLASSES_FIELD_IDS.class_id + '} = "' + classId + '"',
    maxRecords: 1,
  }).firstPage();

  if (classRecords.length === 0) {
    console.log('   Class not found!');
    return;
  }

  const classRecordId = classRecords[0].id;
  console.log('   Class record ID: ' + classRecordId);

  // Step 2: Try the current query approach (string comparison)
  console.log('\n2. Query songs with string comparison: {class_link} = "' + classRecordId + '"');
  try {
    const songs1 = await base(SONGS_TABLE_ID).select({
      filterByFormula: '{' + SONGS_LINKED_FIELD_IDS.class_link + '} = "' + classRecordId + '"',
    }).all();
    console.log('   Found: ' + songs1.length + ' songs');
  } catch (err) {
    console.log('   Error: ' + err.message);
  }

  // Step 3: Try SEARCH approach
  console.log('\n3. Query songs with SEARCH: SEARCH("' + classRecordId + '", ARRAYJOIN({class_link}))');
  try {
    const songs2 = await base(SONGS_TABLE_ID).select({
      filterByFormula: 'SEARCH("' + classRecordId + '", ARRAYJOIN({' + SONGS_LINKED_FIELD_IDS.class_link + '})) > 0',
    }).all();
    console.log('   Found: ' + songs2.length + ' songs');
    for (const s of songs2) {
      console.log('   - ' + s.get('title'));
    }
  } catch (err) {
    console.log('   Error: ' + err.message);
  }

  // Step 4: Try FIND approach
  console.log('\n4. Query songs with FIND: FIND("' + classRecordId + '", ARRAYJOIN({class_link}))');
  try {
    const songs3 = await base(SONGS_TABLE_ID).select({
      filterByFormula: 'FIND("' + classRecordId + '", ARRAYJOIN({' + SONGS_LINKED_FIELD_IDS.class_link + '})) > 0',
    }).all();
    console.log('   Found: ' + songs3.length + ' songs');
    for (const s of songs3) {
      console.log('   - ' + s.get('title'));
    }
  } catch (err) {
    console.log('   Error: ' + err.message);
  }

  // Step 5: Also check using the text class_id field (legacy)
  console.log('\n5. Query songs with text class_id: {class_id} = "' + classId + '"');
  try {
    const songs4 = await base(SONGS_TABLE_ID).select({
      filterByFormula: '{class_id} = "' + classId + '"',
    }).all();
    console.log('   Found: ' + songs4.length + ' songs');
    for (const s of songs4) {
      console.log('   - ' + s.get('title'));
    }
  } catch (err) {
    console.log('   Error: ' + err.message);
  }
}

main().catch(console.error);
