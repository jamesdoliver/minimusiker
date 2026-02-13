/**
 * Script to create the is_under_100, estimated_children, and only_under_100 fields
 * on the Events and Email Templates Airtable tables, then auto-patch the codebase
 * with the real field IDs.
 *
 * Run with: npx tsx scripts/create-under100-fields.ts
 *
 * Creates 3 fields:
 *   1. is_under_100       (Checkbox)  on Events table
 *   2. estimated_children (Number)    on Events table
 *   3. only_under_100     (Checkbox)  on Email Templates table
 *
 * After creation, prints field IDs and patches airtable.ts / email-automation.ts.
 */

import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

config({ path: '.env.local' });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const EMAIL_TEMPLATES_TABLE_ID = 'tbl9M6cOhR6OpYJRe';

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

const FIELDS_TO_CREATE: FieldDef[] = [
  {
    name: 'is_under_100',
    type: 'checkbox',
    description: 'Auto-calculated flag: true when estimated children < 100',
    tableId: EVENTS_TABLE_ID,
    tableName: 'Events',
    placeholder: 'fldXXXXXXXXXXXXXX',
    patchFile: 'src/lib/types/airtable.ts',
    options: { color: 'greenBright', icon: 'check' },
  },
  {
    name: 'estimated_children',
    type: 'number',
    description: 'Estimated number of children attending (copied from SchoolBooking on event creation)',
    tableId: EVENTS_TABLE_ID,
    tableName: 'Events',
    placeholder: 'fldZZZZZZZZZZZZZZ',
    patchFile: 'src/lib/types/airtable.ts',
    options: { precision: 0 },
  },
  {
    name: 'only_under_100',
    type: 'checkbox',
    description: 'When checked, this email template only sends to events with fewer than 100 children',
    tableId: EMAIL_TEMPLATES_TABLE_ID,
    tableName: 'Email Templates',
    placeholder: 'fldYYYYYYYYYYYYYY',
    patchFile: 'src/lib/types/email-automation.ts',
    options: { color: 'yellowBright', icon: 'check' },
  },
];

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
  console.log('Creating under-100-kids fields');
  console.log('='.repeat(60));
  console.log();

  const createdFields: Array<{ name: string; id: string; placeholder: string; patchFile: string; tableName: string }> = [];

  for (const fieldDef of FIELDS_TO_CREATE) {
    try {
      console.log(`Creating field: ${fieldDef.name} (${fieldDef.type}) on ${fieldDef.tableName}...`);
      const result = await createField(fieldDef);
      console.log(`  -> Created with ID: ${result.id}`);
      createdFields.push({
        name: fieldDef.name,
        id: result.id,
        placeholder: fieldDef.placeholder,
        patchFile: fieldDef.patchFile,
        tableName: fieldDef.tableName,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('DUPLICATE_FIELD_NAME')) {
        console.log(`  -> Field "${fieldDef.name}" already exists on ${fieldDef.tableName}. Fetching ID...`);
        const existingId = await lookupExistingFieldId(fieldDef.tableId, fieldDef.name);
        if (existingId) {
          console.log(`  -> Found existing ID: ${existingId}`);
          createdFields.push({
            name: fieldDef.name,
            id: existingId,
            placeholder: fieldDef.placeholder,
            patchFile: fieldDef.patchFile,
            tableName: fieldDef.tableName,
          });
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

  console.log();
  console.log('='.repeat(60));
  console.log('Field IDs:');
  console.log('='.repeat(60));
  for (const field of createdFields) {
    console.log(`  ${field.tableName}.${field.name}: '${field.id}'`);
  }

  // Auto-patch source files
  console.log();
  console.log('Patching source files...');

  // Group by patchFile to avoid reading/writing the same file multiple times
  const filePatches = new Map<string, typeof createdFields>();
  for (const field of createdFields) {
    const existing = filePatches.get(field.patchFile) || [];
    existing.push(field);
    filePatches.set(field.patchFile, existing);
  }

  let totalPatched = 0;
  for (const [relPath, fields] of filePatches) {
    const absPath = resolve(__dirname, '..', relPath);
    let content = readFileSync(absPath, 'utf-8');
    let filePatched = 0;

    for (const field of fields) {
      // Only replace the exact placeholder string (not substrings in other files)
      const escapedPlaceholder = field.placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedPlaceholder, 'g');
      const matches = content.match(regex);
      if (matches && matches.length > 0) {
        content = content.replace(regex, field.id);
        filePatched += matches.length;
        console.log(`  ${relPath}: ${field.placeholder} -> ${field.id} (${matches.length} occurrence(s))`);
      }
    }

    if (filePatched > 0) {
      writeFileSync(absPath, content, 'utf-8');
      totalPatched += filePatched;
    }
  }

  console.log();
  if (totalPatched > 0) {
    console.log(`Patched ${totalPatched} placeholder(s) across ${filePatches.size} file(s).`);
  } else {
    console.log('No placeholders to patch (already up to date or file structure changed).');
  }

  console.log();
  console.log('Done! Fields created and source files updated.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
