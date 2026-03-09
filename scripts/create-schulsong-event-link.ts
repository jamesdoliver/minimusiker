/**
 * Script to create a linked record field 'event' on the Schulsong table
 * pointing to the Events table, and update the field ID placeholder in the codebase.
 *
 * Run with: npx tsx scripts/create-schulsong-event-link.ts
 */

import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

config({ path: '.env.local' });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const SCHULSONG_TABLE_ID = 'tbl87zlzyGXrs1qSu';
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in .env.local');
  process.exit(1);
}

const FIELD_DEF = {
  name: 'event',
  type: 'multipleRecordLinks' as const,
  description: 'Linked Event record (Schulsong ↔ Event)',
  options: {
    linkedTableId: EVENTS_TABLE_ID,
  },
  placeholder: 'fldTODO_schulsong_event',
};

interface AirtableFieldResponse {
  id: string;
  name: string;
  type: string;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Creating event linked record field in Schulsong table');
  console.log(`Table: ${SCHULSONG_TABLE_ID} → Events: ${EVENTS_TABLE_ID}`);
  console.log('='.repeat(60));
  console.log();

  let fieldId: string | undefined;

  try {
    const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${SCHULSONG_TABLE_ID}/fields`;
    console.log(`Creating field: ${FIELD_DEF.name} (${FIELD_DEF.type})...`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: FIELD_DEF.name,
        type: FIELD_DEF.type,
        description: FIELD_DEF.description,
        options: FIELD_DEF.options,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (errorText.includes('DUPLICATE_FIELD_NAME')) {
        console.log(`  -> Field "${FIELD_DEF.name}" already exists. Fetching ID...`);
        const metaUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;
        const metaResponse = await fetch(metaUrl, {
          headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
        });
        const meta = await metaResponse.json();
        const table = meta.tables.find((t: { id: string }) => t.id === SCHULSONG_TABLE_ID);
        if (table) {
          const existingField = table.fields.find(
            (f: { name: string }) => f.name === FIELD_DEF.name
          );
          if (existingField) {
            fieldId = existingField.id;
            console.log(`  -> Found existing ID: ${fieldId}`);
          }
        }
      } else {
        throw new Error(`Failed to create field: ${response.status} ${errorText}`);
      }
    } else {
      const result = (await response.json()) as AirtableFieldResponse;
      fieldId = result.id;
      console.log(`  -> Created with ID: ${fieldId}`);
    }
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }

  if (!fieldId) {
    console.error('Could not determine field ID');
    process.exit(1);
  }

  // Auto-patch the types file
  console.log();
  console.log('Patching placeholder in airtable.ts...');
  const typesFilePath = resolve(__dirname, '../src/lib/types/airtable.ts');
  let typesContent = readFileSync(typesFilePath, 'utf-8');

  if (typesContent.includes(FIELD_DEF.placeholder)) {
    typesContent = typesContent.replace(
      new RegExp(FIELD_DEF.placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      fieldId
    );
    writeFileSync(typesFilePath, typesContent, 'utf-8');
    console.log(`  Patched ${FIELD_DEF.placeholder} -> ${fieldId}`);
  } else {
    console.log('  No placeholder to patch (already up to date or placeholder not found)');
  }

  console.log();
  console.log('Done!');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
