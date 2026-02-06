/**
 * Create schulsong_released_at field on Events table
 * Run once: node scripts/create-schulsong-released-field.js
 *
 * After running, copy the field ID from the output and add it to
 * EVENTS_FIELD_IDS in src/lib/types/airtable.ts
 */

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';

async function createField() {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID environment variables');
    process.exit(1);
  }

  const response = await fetch(
    `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${EVENTS_TABLE_ID}/fields`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'schulsong_released_at',
        type: 'dateTime',
        options: {
          timeZone: 'Europe/Berlin',
          dateFormat: { name: 'iso' },
          timeFormat: { name: '24hour' },
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    console.error('Failed to create field:', JSON.stringify(error, null, 2));
    process.exit(1);
  }

  const field = await response.json();
  console.log('Field created successfully!');
  console.log('Field ID:', field.id);
  console.log('Field Name:', field.name);
  console.log('\nAdd this to EVENTS_FIELD_IDS in src/lib/types/airtable.ts:');
  console.log(`  schulsong_released_at: '${field.id}',`);
}

createField();
