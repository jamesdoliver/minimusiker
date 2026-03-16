/**
 * Script to create the schulsong_merch_cutoff dateTime field on the Events table.
 *
 * Run with: npx tsx scripts/create-schulsong-merch-cutoff-field.ts
 */

import { config } from 'dotenv';

config({ path: '.env.local' });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in .env.local');
  process.exit(1);
}

async function createField(): Promise<string> {
  const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${EVENTS_TABLE_ID}/fields`;

  const body = {
    name: 'schulsong_merch_cutoff',
    type: 'dateTime',
    description:
      'Cutoff date/time for Schulsong merch orders. After this point, merch ordering is closed for the event.',
    options: {
      timeZone: 'Europe/Berlin',
      dateFormat: { name: 'european' },
      timeFormat: { name: '24hour' },
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();

    if (errorText.includes('DUPLICATE_FIELD_NAME')) {
      console.log('Field "schulsong_merch_cutoff" already exists. Fetching ID...');
      return await lookupExistingFieldId();
    }

    throw new Error(`Failed to create field: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  return result.id;
}

async function lookupExistingFieldId(): Promise<string> {
  const metaUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;
  const metaResponse = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });

  if (!metaResponse.ok) {
    throw new Error(`Failed to fetch table metadata: ${metaResponse.status}`);
  }

  const meta = await metaResponse.json();
  const table = meta.tables.find((t: { id: string }) => t.id === EVENTS_TABLE_ID);

  if (!table) {
    throw new Error(`Events table ${EVENTS_TABLE_ID} not found in metadata`);
  }

  const field = table.fields.find(
    (f: { name: string }) => f.name === 'schulsong_merch_cutoff'
  );
  if (!field) {
    throw new Error('Field "schulsong_merch_cutoff" not found in table metadata');
  }

  return field.id;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Creating schulsong_merch_cutoff field on Events table');
  console.log(`Table: ${EVENTS_TABLE_ID}`);
  console.log('='.repeat(60));
  console.log();

  const fieldId = await createField();
  console.log();
  console.log(`Field ID: ${fieldId}`);
  console.log();
  console.log('Done!');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
