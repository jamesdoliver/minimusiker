/**
 * Script to add admin_notes field to Events table in Airtable
 * Run with: node scripts/add-admin-notes-field.js
 */

require('dotenv').config({ path: '.env.local' });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';

async function createField(tableId, fieldName, fieldType, description) {
  const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${tableId}/fields`;

  const body = {
    name: fieldName,
    type: fieldType,
    description: description,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create field ${fieldName}: ${JSON.stringify(error)}`);
  }

  return response.json();
}

async function main() {
  if (!AIRTABLE_API_KEY) {
    console.error('Error: AIRTABLE_API_KEY not found in environment');
    process.exit(1);
  }

  if (!AIRTABLE_BASE_ID) {
    console.error('Error: AIRTABLE_BASE_ID not found in environment');
    process.exit(1);
  }

  console.log('Creating admin_notes field in Events table...\n');

  try {
    const result = await createField(
      EVENTS_TABLE_ID,
      'admin_notes',
      'multilineText',
      'Free-text admin notes for this event/booking'
    );
    console.log(`Created! Field ID: ${result.id}`);
    console.log('\n========================================');
    console.log('Update EVENTS_FIELD_IDS in src/lib/types/airtable.ts:');
    console.log('========================================\n');
    console.log(`  admin_notes: '${result.id}',`);
  } catch (error) {
    if (error.message.includes('FIELD_NAME_ALREADY_EXISTS')) {
      console.log('Field already exists. Look up the ID in Airtable.');
    } else {
      console.error('Error:', error.message);
    }
  }
}

main();
