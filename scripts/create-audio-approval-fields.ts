/**
 * Script to create audio file approval fields in the Audio Files Airtable table
 * and update the field IDs in the codebase.
 *
 * Run with: npx tsx scripts/create-audio-approval-fields.ts
 *
 * Creates 2 fields:
 *   1. approval_status (Single Select: pending, approved, rejected)
 *   2. rejection_comment (Long text)
 *
 * After creation, prints field IDs and patches teacher.ts automatically.
 */

import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

config({ path: '.env.local' });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AUDIO_FILES_TABLE_ID = 'tbloCM4tmH7mYoyXR';

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in .env.local');
  process.exit(1);
}

const FIELDS_TO_CREATE = [
  {
    name: 'approval_status',
    type: 'singleSelect',
    description: 'Admin approval status for this audio file',
    options: {
      choices: [
        { name: 'pending', color: 'grayBright' },
        { name: 'approved', color: 'greenBright' },
        { name: 'rejected', color: 'redBright' },
      ],
    },
    placeholder: 'fldTODO_APPROVAL_STATUS',
  },
  {
    name: 'rejection_comment',
    type: 'multilineText',
    description: "Admin's reason for rejecting this audio file",
    placeholder: 'fldTODO_REJECTION_COMMENT',
  },
];

interface AirtableFieldResponse {
  id: string;
  name: string;
  type: string;
}

async function createField(
  fieldDef: (typeof FIELDS_TO_CREATE)[number]
): Promise<AirtableFieldResponse> {
  const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${AUDIO_FILES_TABLE_ID}/fields`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = {
    name: fieldDef.name,
    type: fieldDef.type,
    description: fieldDef.description,
  };
  if ('options' in fieldDef) {
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

async function main() {
  console.log('='.repeat(60));
  console.log('Creating approval fields in Audio Files table');
  console.log(`Table: ${AUDIO_FILES_TABLE_ID}`);
  console.log('='.repeat(60));
  console.log();

  const createdFields: Array<{ name: string; id: string; placeholder: string }> = [];

  for (const fieldDef of FIELDS_TO_CREATE) {
    try {
      console.log(`Creating field: ${fieldDef.name} (${fieldDef.type})...`);
      const result = await createField(fieldDef);
      console.log(`  -> Created with ID: ${result.id}`);
      createdFields.push({
        name: fieldDef.name,
        id: result.id,
        placeholder: fieldDef.placeholder,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('DUPLICATE_FIELD_NAME')) {
        console.log(`  -> Field "${fieldDef.name}" already exists. Fetching ID...`);
        const metaUrl = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;
        const metaResponse = await fetch(metaUrl, {
          headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
        });
        const meta = await metaResponse.json();
        const table = meta.tables.find((t: { id: string }) => t.id === AUDIO_FILES_TABLE_ID);
        if (table) {
          const existingField = table.fields.find(
            (f: { name: string }) => f.name === fieldDef.name
          );
          if (existingField) {
            console.log(`  -> Found existing ID: ${existingField.id}`);
            createdFields.push({
              name: fieldDef.name,
              id: existingField.id,
              placeholder: fieldDef.placeholder,
            });
          }
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
    console.log(`  ${field.name}: '${field.id}'`);
  }

  // Auto-patch the types file
  const typesFilePath = resolve(__dirname, '../src/lib/types/teacher.ts');
  let typesContent = readFileSync(typesFilePath, 'utf-8');

  let patched = 0;
  for (const field of createdFields) {
    if (typesContent.includes(field.placeholder)) {
      typesContent = typesContent.replace(
        new RegExp(field.placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        field.id
      );
      patched++;
      console.log(`  Patched ${field.placeholder} -> ${field.id}`);
    }
  }

  if (patched > 0) {
    writeFileSync(typesFilePath, typesContent, 'utf-8');
    console.log(`\nUpdated ${patched} placeholder(s) in teacher.ts`);
  } else {
    console.log('\nNo placeholders to patch (already up to date or file structure changed)');
  }

  console.log();
  console.log('Done! Fields created and types file updated.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
