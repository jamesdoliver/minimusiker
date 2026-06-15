/**
 * Creates the `audio_free_without_purchase` checkbox field on the Events Airtable
 * table, then auto-patches the placeholder field ID in src/lib/types/airtable.ts.
 *
 * Run with: npx tsx scripts/create-audio-free-without-purchase-field.ts
 *
 * WHY: the parent audio download gate (src/app/api/parent/audio-access/route.ts) used
 * to treat an unconfigured event as "free audio for all" (because Airtable omits an
 * unchecked checkbox, so minicard_order_enabled read undefined). The gate now reads a
 * dedicated, positively-framed flag whose default (unchecked) is the SAFE state
 * (purchase required). This script creates that flag.
 *
 * SAFETY:
 *   - Additive only: creates ONE new checkbox field. Touches no existing data/fields.
 *   - Touches the PRODUCTION base — run intentionally, once. Do NOT add to build/deploy.
 *   - The code already ships fail-closed: until this field exists the gate reads
 *     undefined => purchase required, so there is no window where audio leaks. The field
 *     is only needed so admins can OPT IN to free-for-all on specific events.
 */

import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

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
  tableId: string;
  tableName: string;
  placeholder: string;
  patchFile: string; // relative to project root
  options?: Record<string, unknown>;
}

const FIELD_TO_CREATE: FieldDef = {
  name: 'audio_free_without_purchase',
  type: 'checkbox',
  description: 'When CHECKED, parents can download audio after release without buying a Minicard. Default (unchecked) = purchase required. Drives the parent audio-access gate; independent of minicard_order_enabled (bulk-order tracking).',
  tableId: EVENTS_TABLE_ID,
  tableName: 'Events',
  // MUST match the placeholder in src/lib/types/airtable.ts EVENTS_FIELD_IDS exactly.
  placeholder: 'fldAUDIOFREEWITHOUT0',
  patchFile: 'src/lib/types/airtable.ts',
  options: { color: 'greenBright', icon: 'check' },
};

interface AirtableFieldResponse {
  id: string;
  name: string;
  type: string;
}

async function createField(fieldDef: FieldDef): Promise<AirtableFieldResponse> {
  const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${fieldDef.tableId}/fields`;

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

async function lookupExistingFieldId(tableId: string, fieldName: string): Promise<string | null> {
  const metaUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;
  const metaResponse = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });
  const meta = await metaResponse.json();
  const table = meta.tables.find((t: { id: string }) => t.id === tableId);
  if (table) {
    const existingField = table.fields.find((f: { name: string }) => f.name === fieldName);
    if (existingField) {
      return existingField.id;
    }
  }
  return null;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Creating audio_free_without_purchase field');
  console.log('='.repeat(60));
  console.log();

  let fieldId: string;
  try {
    console.log(`Creating field: ${FIELD_TO_CREATE.name} (${FIELD_TO_CREATE.type}) on ${FIELD_TO_CREATE.tableName}...`);
    const result = await createField(FIELD_TO_CREATE);
    fieldId = result.id;
    console.log(`  -> Created with ID: ${fieldId}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('DUPLICATE_FIELD_NAME')) {
      console.log(`  -> Field "${FIELD_TO_CREATE.name}" already exists. Fetching ID...`);
      const existingId = await lookupExistingFieldId(FIELD_TO_CREATE.tableId, FIELD_TO_CREATE.name);
      if (!existingId) {
        console.error(`  -> Could not find existing field ID for "${FIELD_TO_CREATE.name}"`);
        process.exit(1);
      }
      fieldId = existingId;
      console.log(`  -> Found existing ID: ${fieldId}`);
    } else {
      console.error(`  -> Error: ${error}`);
      process.exit(1);
    }
  }

  console.log();
  console.log(`Field ID: ${FIELD_TO_CREATE.tableName}.${FIELD_TO_CREATE.name}: '${fieldId}'`);

  // Auto-patch the placeholder in the source file
  console.log();
  console.log('Patching source file...');
  const absPath = resolve(__dirname, '..', FIELD_TO_CREATE.patchFile);
  const content = readFileSync(absPath, 'utf-8');
  const escapedPlaceholder = FIELD_TO_CREATE.placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escapedPlaceholder, 'g');
  const matches = content.match(regex);

  if (matches && matches.length > 0) {
    const patched = content.replace(regex, fieldId);
    writeFileSync(absPath, patched, 'utf-8');
    console.log(`  ${FIELD_TO_CREATE.patchFile}: ${FIELD_TO_CREATE.placeholder} -> ${fieldId} (${matches.length} occurrence(s))`);
  } else {
    console.log(`  No placeholder "${FIELD_TO_CREATE.placeholder}" found in ${FIELD_TO_CREATE.patchFile} (already patched?). Set EVENTS_FIELD_IDS.audio_free_without_purchase to '${fieldId}' manually if needed.`);
  }

  console.log();
  console.log('Done. Commit the patched airtable.ts so the admin write path uses the real field ID.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
