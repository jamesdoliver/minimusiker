/**
 * Script to add album_order and display_order fields to Airtable
 * Run with: node scripts/add-album-order-fields.js
 */

require('dotenv').config({ path: '.env.local' });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

// Table IDs from the codebase
const SONGS_TABLE_ID = 'tblPjGWQlHuG8jp5X';
const CLASSES_TABLE_ID = 'tbl17SVI5gacwOP0n';

async function createField(tableId, fieldName, fieldType, description, options = {}) {
  const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${tableId}/fields`;

  const body = {
    name: fieldName,
    type: fieldType,
    description: description,
  };

  // Add options if provided (required for number fields)
  if (Object.keys(options).length > 0) {
    body.options = options;
  }

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

  console.log('Creating Airtable fields for Album Layout feature...\n');

  try {
    // Create album_order field in Songs table
    console.log('1. Creating "album_order" field in Songs table...');
    const albumOrderResult = await createField(
      SONGS_TABLE_ID,
      'album_order',
      'number',
      'Global track position for printed album (1, 2, 3...)',
      { precision: 0 }  // Integer precision
    );
    console.log(`   ✓ Created! Field ID: ${albumOrderResult.id}`);

    // Create display_order field in Classes table
    console.log('2. Creating "display_order" field in Classes table...');
    const displayOrderResult = await createField(
      CLASSES_TABLE_ID,
      'display_order',
      'number',
      'Order in which class appears in teacher portal',
      { precision: 0 }  // Integer precision
    );
    console.log(`   ✓ Created! Field ID: ${displayOrderResult.id}`);

    console.log('\n========================================');
    console.log('SUCCESS! Fields created. Now update the code:');
    console.log('========================================\n');

    console.log('1. In src/lib/types/teacher.ts, replace:');
    console.log(`   album_order: 'fldAlbumOrder'`);
    console.log(`   with:`);
    console.log(`   album_order: '${albumOrderResult.id}'`);

    console.log('\n2. In src/lib/types/airtable.ts, replace:');
    console.log(`   display_order: 'fldDisplayOrder'`);
    console.log(`   with:`);
    console.log(`   display_order: '${displayOrderResult.id}'`);

  } catch (error) {
    console.error('\nError:', error.message);

    if (error.message.includes('FIELD_NAME_ALREADY_EXISTS')) {
      console.log('\nThe field already exists. You may need to look up the existing field ID in Airtable.');
    }

    process.exit(1);
  }
}

main();
