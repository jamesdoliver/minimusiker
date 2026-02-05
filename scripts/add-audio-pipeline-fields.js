/**
 * Script to add audio_pipeline_stage field to Events table in Airtable
 * Run with: node scripts/add-audio-pipeline-fields.js
 *
 * Also creates all_tracks_approved and admin_approval_status fields
 * if they don't already exist (replacing TODO placeholders).
 */

require('dotenv').config({ path: '.env.local' });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';

async function createField(tableId, fieldName, fieldType, description, options = {}) {
  const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${tableId}/fields`;

  const body = {
    name: fieldName,
    type: fieldType,
    description: description,
  };

  if (Object.keys(options).length > 0) {
    body.options = options;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create field ${fieldName}: ${JSON.stringify(error)}`);
  }

  return response.json();
}

async function main() {
  if (!AIRTABLE_API_KEY) {
    console.error('Error: AIRTABLE_API_KEY not found in environment');
    process.exit(1);
  }

  if (!AIRTABLE_BASE_ID) {
    console.error('Error: AIRTABLE_BASE_ID not found in environment');
    process.exit(1);
  }

  console.log('Creating Airtable fields for Audio Pipeline feature...\n');

  const results = {};

  // 1. Create audio_pipeline_stage field
  try {
    console.log('1. Creating "audio_pipeline_stage" field in Events table...');
    const result = await createField(
      EVENTS_TABLE_ID,
      'audio_pipeline_stage',
      'singleSelect',
      'Audio pipeline stage for admin bookings view',
      {
        choices: [
          { name: 'not_started', color: 'grayLight2' },
          { name: 'in_progress', color: 'yellowLight2' },
          { name: 'ready_for_review', color: 'orangeLight2' },
          { name: 'approved', color: 'greenLight2' },
        ],
      }
    );
    console.log(`   Created! Field ID: ${result.id}`);
    results.audio_pipeline_stage = result.id;
  } catch (error) {
    if (error.message.includes('FIELD_NAME_ALREADY_EXISTS')) {
      console.log('   Field already exists. Look up the ID in Airtable.');
    } else {
      console.error('   Error:', error.message);
    }
  }

  // 2. Create all_tracks_approved field
  try {
    console.log('2. Creating "all_tracks_approved" field in Events table...');
    const result = await createField(
      EVENTS_TABLE_ID,
      'all_tracks_approved',
      'checkbox',
      'True when admin has approved ALL final audio tracks',
      { icon: 'check', color: 'greenBright' }
    );
    console.log(`   Created! Field ID: ${result.id}`);
    results.all_tracks_approved = result.id;
  } catch (error) {
    if (error.message.includes('FIELD_NAME_ALREADY_EXISTS')) {
      console.log('   Field already exists. Look up the ID in Airtable.');
    } else {
      console.error('   Error:', error.message);
    }
  }

  // 3. Create admin_approval_status field
  try {
    console.log('3. Creating "admin_approval_status" field in Events table...');
    const result = await createField(
      EVENTS_TABLE_ID,
      'admin_approval_status',
      'singleSelect',
      'Admin approval workflow status',
      {
        choices: [
          { name: 'pending', color: 'grayLight2' },
          { name: 'ready_for_approval', color: 'yellowLight2' },
          { name: 'approved', color: 'greenLight2' },
        ],
      }
    );
    console.log(`   Created! Field ID: ${result.id}`);
    results.admin_approval_status = result.id;
  } catch (error) {
    if (error.message.includes('FIELD_NAME_ALREADY_EXISTS')) {
      console.log('   Field already exists. Look up the ID in Airtable.');
    } else {
      console.error('   Error:', error.message);
    }
  }

  console.log('\n========================================');
  console.log('RESULTS - Update EVENTS_FIELD_IDS in src/lib/types/airtable.ts:');
  console.log('========================================\n');

  if (results.audio_pipeline_stage) {
    console.log(`  audio_pipeline_stage: '${results.audio_pipeline_stage}',`);
  }
  if (results.all_tracks_approved) {
    console.log(`  all_tracks_approved: '${results.all_tracks_approved}',  // Replace fldTODO_ALL_TRACKS_APPROVED`);
  }
  if (results.admin_approval_status) {
    console.log(`  admin_approval_status: '${results.admin_approval_status}',  // Replace fldTODO_ADMIN_APPROVAL_STATUS`);
  }
}

main();
