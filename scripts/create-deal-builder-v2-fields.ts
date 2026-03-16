/**
 * Script to create Deal Builder V2 fields on the Events table in Airtable.
 *
 * Run with: npx tsx scripts/create-deal-builder-v2-fields.ts
 *
 * Fields created on Events table:
 *   1. scs_shirts_included      (Checkbox)  — enables SchulClothingOrder UI
 *   2. minicard_order_enabled    (Checkbox)  — enables bulk minicard order tracking
 *   3. minicard_order_quantity   (Number, precision 0) — how many minicards ordered
 *
 * These standalone Event Settings replace functionality previously embedded
 * inside the deal builder's deal_config JSON blob.
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

interface FieldDef {
  name: string;
  type: string;
  description: string;
  options?: Record<string, unknown>;
}

interface AirtableFieldResponse {
  id: string;
  name: string;
  type: string;
}

const FIELDS_TO_CREATE: FieldDef[] = [
  {
    name: 'scs_shirts_included',
    type: 'checkbox',
    description: 'When checked, enables the SchulClothingOrder UI for this event (Startchancenschule t-shirt collection)',
    options: { color: 'greenBright', icon: 'check' },
  },
  {
    name: 'minicard_order_enabled',
    type: 'checkbox',
    description: 'When checked, enables bulk minicard order tracking for this event',
    options: { color: 'blueBright', icon: 'check' },
  },
  {
    name: 'minicard_order_quantity',
    type: 'number',
    description: 'Number of minicards ordered for this event',
    options: { precision: 0 },
  },
];

async function createField(fieldDef: FieldDef): Promise<AirtableFieldResponse> {
  const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${EVENTS_TABLE_ID}/fields`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = {
    name: fieldDef.name,
    type: fieldDef.type,
    description: fieldDef.description,
  };

  if (fieldDef.options) {
    body.options = fieldDef.options;
  }

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
    throw new Error(`Failed to create field "${fieldDef.name}": ${response.status} ${errorText}`);
  }

  return response.json() as Promise<AirtableFieldResponse>;
}

async function lookupExistingFieldId(fieldName: string): Promise<string | null> {
  const metaUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;
  const metaResponse = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });
  const meta = await metaResponse.json();
  const table = meta.tables.find((t: { id: string }) => t.id === EVENTS_TABLE_ID);
  if (table) {
    const existingField = table.fields.find(
      (f: { name: string }) => f.name === fieldName
    );
    if (existingField) {
      return existingField.id;
    }
  }
  return null;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Deal Builder V2 — Airtable Event Settings Fields');
  console.log('='.repeat(60));
  console.log();
  console.log('Creating fields on Events table...');
  console.log('-'.repeat(60));

  const results: Array<{ name: string; id: string }> = [];

  for (const fieldDef of FIELDS_TO_CREATE) {
    try {
      console.log(`Creating field: ${fieldDef.name} (${fieldDef.type})...`);
      const result = await createField(fieldDef);
      console.log(`  -> Created with ID: ${result.id}`);
      results.push({ name: fieldDef.name, id: result.id });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('DUPLICATE_FIELD_NAME') ||
          error.message.includes('DUPLICATE_OR_EMPTY_FIELD_NAME'))
      ) {
        console.log(`  -> Field "${fieldDef.name}" already exists. Fetching ID...`);
        const existingId = await lookupExistingFieldId(fieldDef.name);
        if (existingId) {
          console.log(`  -> Found existing ID: ${existingId}`);
          results.push({ name: fieldDef.name, id: existingId });
        } else {
          console.error(`  -> Could not find existing field ID for "${fieldDef.name}"`);
          process.exit(1);
        }
      } else {
        console.error(`  -> Error: ${error}`);
        process.exit(1);
      }
    }
  }

  // Summary
  console.log();
  console.log('='.repeat(60));
  console.log('Summary — New Field IDs');
  console.log('='.repeat(60));
  console.log();
  for (const { name, id } of results) {
    console.log(`  ${name}: '${id}'`);
  }
  console.log();
  console.log('Done! Add these field IDs to src/lib/types/airtable.ts.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
