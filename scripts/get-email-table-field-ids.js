#!/usr/bin/env node

/**
 * Script to fetch field IDs from EMAIL_TEMPLATES and EMAIL_LOGS Airtable tables
 *
 * Usage: node scripts/get-email-table-field-ids.js
 *
 * Requires AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables
 */

require('dotenv').config({ path: '.env.local' });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const EMAIL_TEMPLATES_TABLE_ID = 'tbl9M6cOhR6OpYJRe';
const EMAIL_LOGS_TABLE_ID = 'tblxLemlKY8p8cIwS';

async function getTableSchema(tableId, tableName) {
  const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch schema: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const table = data.tables.find(t => t.id === tableId);

  if (!table) {
    throw new Error(`Table ${tableId} not found`);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`${tableName} (${tableId})`);
  console.log(`${'='.repeat(60)}\n`);

  console.log('Field IDs for TypeScript constants:\n');

  const fieldIds = {};
  for (const field of table.fields) {
    const fieldKey = field.name.toLowerCase().replace(/\s+/g, '_');
    fieldIds[fieldKey] = field.id;
    console.log(`  ${fieldKey}: '${field.id}',  // ${field.type} - "${field.name}"`);
  }

  return fieldIds;
}

async function main() {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
    console.error('Error: AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set in .env.local');
    process.exit(1);
  }

  console.log('Fetching field IDs from Airtable...\n');

  try {
    const templatesFields = await getTableSchema(EMAIL_TEMPLATES_TABLE_ID, 'EMAIL_TEMPLATES');
    const logsFields = await getTableSchema(EMAIL_LOGS_TABLE_ID, 'EMAIL_LOGS');

    console.log(`\n${'='.repeat(60)}`);
    console.log('COPY THIS TO src/lib/types/email-automation.ts');
    console.log(`${'='.repeat(60)}\n`);

    console.log('export const EMAIL_TEMPLATES_FIELD_IDS = {');
    for (const [key, value] of Object.entries(templatesFields)) {
      console.log(`  ${key}: '${value}',`);
    }
    console.log('} as const;\n');

    console.log('export const EMAIL_LOGS_FIELD_IDS = {');
    for (const [key, value] of Object.entries(logsFields)) {
      console.log(`  ${key}: '${value}',`);
    }
    console.log('} as const;');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
