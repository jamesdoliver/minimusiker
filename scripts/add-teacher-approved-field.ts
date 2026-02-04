/**
 * Script to add teacher_approved_at field to Audio Files table in Airtable
 * Run with: npx tsx scripts/add-teacher-approved-field.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AUDIO_FILES_TABLE_ID = 'tbloCM4tmH7mYoyXR';

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in environment');
  process.exit(1);
}

async function addTeacherApprovedField() {
  const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${AUDIO_FILES_TABLE_ID}/fields`;

  const fieldDefinition = {
    name: 'teacher_approved_at',
    type: 'dateTime',
    description: 'Timestamp when teacher approved the schulsong for release to parents',
    options: {
      timeZone: 'Europe/Berlin',
      dateFormat: {
        name: 'iso',
      },
      timeFormat: {
        name: '24hour',
      },
    },
  };

  console.log('Adding teacher_approved_at field to Audio Files table...');
  console.log('Field definition:', JSON.stringify(fieldDefinition, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fieldDefinition),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Error creating field:', data);
      process.exit(1);
    }

    console.log('\n✅ Field created successfully!');
    console.log('\nField ID:', data.id);
    console.log('Field Name:', data.name);
    console.log('Field Type:', data.type);

    console.log('\n📋 Update src/lib/types/teacher.ts with this field ID:\n');
    console.log(`  teacher_approved_at: '${data.id}', // Date/time - when teacher approved schulsong`);

  } catch (error) {
    console.error('Failed to create field:', error);
    process.exit(1);
  }
}

addTeacherApprovedField();
