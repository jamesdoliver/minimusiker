/**
 * Script to create the TeacherInvites table in Airtable
 * Run with: npx tsx scripts/create-teacher-invites-table.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in environment');
  process.exit(1);
}

async function createTeacherInvitesTable() {
  const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`;

  const tableDefinition = {
    name: 'TeacherInvites',
    description: 'Stores teacher-to-teacher invite links for event sharing',
    fields: [
      {
        name: 'invite_token',
        type: 'singleLineText',
        description: '64-char hex token for invite URL',
      },
      {
        name: 'event_id',
        type: 'multipleRecordLinks',
        description: 'Link to the Events table - the event being shared',
        options: {
          linkedTableId: 'tblVWx1RrsGRjsNn5', // Events table ID
        },
      },
      {
        name: 'invited_by',
        type: 'multipleRecordLinks',
        description: 'Link to Teachers table - who created the invite',
        options: {
          linkedTableId: 'tblLO2vXcgvNjrJ0T', // Teachers table ID
        },
      },
      {
        name: 'expires_at',
        type: 'dateTime',
        description: 'When the invite expires (7 days from creation)',
        options: {
          timeZone: 'Europe/Berlin',
          dateFormat: {
            name: 'iso',
          },
          timeFormat: {
            name: '24hour',
          },
        },
      },
      {
        name: 'used_at',
        type: 'dateTime',
        description: 'When the invite was accepted (null if pending)',
        options: {
          timeZone: 'Europe/Berlin',
          dateFormat: {
            name: 'iso',
          },
          timeFormat: {
            name: '24hour',
          },
        },
      },
      {
        name: 'used_by',
        type: 'multipleRecordLinks',
        description: 'Link to Teachers table - who accepted the invite',
        options: {
          linkedTableId: 'tblLO2vXcgvNjrJ0T', // Teachers table ID
        },
      },
      {
        name: 'status',
        type: 'singleSelect',
        description: 'Current status of the invite',
        options: {
          choices: [
            { name: 'pending', color: 'yellowBright' },
            { name: 'accepted', color: 'greenBright' },
            { name: 'expired', color: 'grayBright' },
          ],
        },
      },
    ],
  };

  console.log('Creating TeacherInvites table...');
  console.log('Table definition:', JSON.stringify(tableDefinition, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tableDefinition),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Error creating table:', data);
      process.exit(1);
    }

    console.log('\n✅ Table created successfully!');
    console.log('\nTable ID:', data.id);
    console.log('\nField IDs:');

    const fieldIds: Record<string, string> = {};
    for (const field of data.fields) {
      console.log(`  ${field.name}: '${field.id}'`);
      fieldIds[field.name] = field.id;
    }

    console.log('\n📋 Copy this to src/lib/types/teacher.ts:\n');
    console.log(`export const TEACHER_INVITES_TABLE_ID = '${data.id}';`);
    console.log('');
    console.log('export const TEACHER_INVITES_FIELD_IDS = {');
    console.log(`  invite_token: '${fieldIds['invite_token']}',`);
    console.log(`  event_id: '${fieldIds['event_id']}',`);
    console.log(`  invited_by: '${fieldIds['invited_by']}',`);
    console.log(`  expires_at: '${fieldIds['expires_at']}',`);
    console.log(`  used_at: '${fieldIds['used_at']}',`);
    console.log(`  used_by: '${fieldIds['used_by']}',`);
    console.log(`  status: '${fieldIds['status']}',`);
    console.log('} as const;');

  } catch (error) {
    console.error('Failed to create table:', error);
    process.exit(1);
  }
}

createTeacherInvitesTable();
