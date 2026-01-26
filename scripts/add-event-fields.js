/**
 * Admin Booking View - Status & Event Type Fields Setup
 *
 * This script documents the new fields that need to be added to the Events table
 * and verifies they exist after manual creation in Airtable's web interface.
 *
 * FIELDS TO ADD MANUALLY IN AIRTABLE:
 *
 * Events Table (tblVWx1RrsGRjsNn5):
 * 1. is_minimusikertag_plus (Checkbox) - default false
 * 2. is_kita (Checkbox) - default false
 * 3. is_schulsong (Checkbox) - default false
 * 4. status (Single Select) - options: Confirmed, On Hold, Cancelled
 *
 * After creating fields in Airtable, run this script to get the field IDs.
 *
 * Usage: node scripts/add-event-fields.js
 */

require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');

const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';

// Expected field names (you'll need to add these in Airtable's web interface)
const EXPECTED_FIELDS = [
  'is_minimusikertag_plus',
  'is_kita',
  'is_schulsong',
  'status'
];

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const base = airtable.base(process.env.AIRTABLE_BASE_ID);

async function verifyAndGetFieldIds() {
  console.log('='.repeat(60));
  console.log('Admin Booking View - Event Fields Verification');
  console.log('='.repeat(60));
  console.log();

  console.log('Step 1: Checking if new fields exist in Events table...\n');

  try {
    // Get a sample record to inspect available fields
    const records = await base(EVENTS_TABLE_ID)
      .select({ maxRecords: 1 })
      .firstPage();

    if (records.length === 0) {
      console.log('No records found in Events table. Creating a test query...');
      return;
    }

    const record = records[0];
    const availableFields = Object.keys(record.fields);

    console.log('Available fields in Events table:');
    availableFields.forEach(field => {
      console.log(`  - ${field}`);
    });
    console.log();

    // Check for expected fields
    const missingFields = [];
    const foundFields = [];

    for (const field of EXPECTED_FIELDS) {
      if (availableFields.includes(field)) {
        foundFields.push(field);
        const value = record.get(field);
        console.log(`✓ Found field: ${field} (current value: ${JSON.stringify(value)})`);
      } else {
        missingFields.push(field);
        console.log(`✗ Missing field: ${field}`);
      }
    }

    console.log();

    if (missingFields.length > 0) {
      console.log('='.repeat(60));
      console.log('ACTION REQUIRED: Add the following fields in Airtable:');
      console.log('='.repeat(60));
      console.log();
      console.log('Table: Events (tblVWx1RrsGRjsNn5)');
      console.log();

      for (const field of missingFields) {
        if (field === 'status') {
          console.log(`  ${field}:`);
          console.log('    Type: Single Select');
          console.log('    Options: Confirmed, On Hold, Cancelled');
          console.log();
        } else {
          console.log(`  ${field}:`);
          console.log('    Type: Checkbox');
          console.log('    Default: unchecked');
          console.log();
        }
      }

      console.log('After adding fields, run this script again to verify.');
    } else {
      console.log('='.repeat(60));
      console.log('SUCCESS: All required fields exist!');
      console.log('='.repeat(60));
      console.log();
      console.log('You can now update the field IDs in src/lib/types/airtable.ts');
      console.log('Use the following command to get field IDs:');
      console.log();
      console.log('  node scripts/get-event-field-ids.js');
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.statusCode === 404) {
      console.log('\nTable not found. Check EVENTS_TABLE_ID is correct.');
    }
  }
}

// Also provide ability to get field IDs
async function getFieldIds() {
  console.log('\n='.repeat(60));
  console.log('Getting Field IDs for new fields...');
  console.log('='.repeat(60));
  console.log();
  console.log('NOTE: To get field IDs, you need to use Airtable API with returnFieldsByFieldId.');
  console.log('Here is how to find them in the Airtable web interface:');
  console.log();
  console.log('1. Open your Events table in Airtable');
  console.log('2. Click on the field header dropdown');
  console.log('3. Select "Edit field"');
  console.log('4. The field ID appears in the URL or can be found in API docs');
  console.log();
  console.log('Alternatively, use this API call to see field IDs:');
  console.log();

  try {
    const records = await base(EVENTS_TABLE_ID)
      .select({
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage();

    if (records.length > 0) {
      console.log('Field IDs in this record:');
      const fieldIds = Object.keys(records[0].fields);
      fieldIds.forEach(id => {
        const value = records[0].fields[id];
        console.log(`  ${id}: ${JSON.stringify(value)}`);
      });
    }
  } catch (error) {
    console.log('Could not fetch with returnFieldsByFieldId:', error.message);
  }
}

async function main() {
  await verifyAndGetFieldIds();
  await getFieldIds();
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
