/**
 * Debug linked record field behavior
 */

import { config } from 'dotenv';
import Airtable from 'airtable';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });
config({ path: join(__dirname, '..', '.env') });

Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

const EVENT_ACTIVITY_TABLE_ID = 'tbljy6InuG4xMngQg';
const EVENTS_TABLE_ID = process.env.EVENTS_TABLE_ID;
const CLASSES_TABLE_ID = process.env.CLASSES_TABLE_ID;

async function debugLinkedRecords() {
  console.log('🔍 Debugging linked record behavior...\n');

  // 1. Look at how Classes table filters by event_id (a working example)
  console.log('=== Checking Classes table (known working example) ===\n');

  // Get an event with classes
  const events = await base(EVENTS_TABLE_ID)
    .select({
      filterByFormula: `{Classes} != ''`,
      maxRecords: 1
    })
    .firstPage();

  if (events.length === 0) {
    console.log('No events with classes found');
    return;
  }

  const event = events[0];
  const eventRecordId = event.id;
  const eventId = event.fields.event_id;
  console.log(`Event: ${event.fields.school_name}`);
  console.log(`Record ID: ${eventRecordId}`);
  console.log(`event_id field: ${eventId}`);
  console.log(`Linked Classes: ${JSON.stringify(event.fields.Classes)}\n`);

  // Try to find classes for this event
  console.log('Looking for classes linked to this event...');

  // Try FIND with the event's record ID
  const classFormula = `FIND('${eventRecordId}', ARRAYJOIN({event_id}))`;
  console.log(`Formula: ${classFormula}`);

  const classes = await base(CLASSES_TABLE_ID)
    .select({
      filterByFormula: classFormula,
      maxRecords: 5
    })
    .all();

  console.log(`Found: ${classes.length} classes\n`);

  if (classes.length > 0) {
    console.log('First class:');
    console.log('  event_id field:', classes[0].fields.event_id);
    console.log('  (Type:', typeof classes[0].fields.event_id, 'isArray:', Array.isArray(classes[0].fields.event_id), ')\n');
  }

  // 2. Now test with EventActivity table
  console.log('\n=== Testing EventActivity table ===\n');

  // Create test activity
  const created = await base(EVENT_ACTIVITY_TABLE_ID).create([{
    fields: {
      'fldHXdy9XckysZkN5': [eventRecordId],  // event_id field ID
      'fldkq8kGUpN1EGMEm': 'date_changed',   // activity_type field ID
      'flduPDeYq7N5JAhGm': 'Debug test',     // description field ID
      'fld8BkhP9HrERtKdD': 'test@test.com',  // actor_email field ID
      'flduzSRoFPcJZrjM8': 'system',         // actor_type field ID
    }
  }]);

  const activityId = created[0].id;
  console.log(`Created activity: ${activityId}`);
  console.log(`Fields: ${JSON.stringify(created[0].fields)}\n`);

  // Try to find with same formula
  const activityFormula = `FIND('${eventRecordId}', ARRAYJOIN({event_id}))`;
  console.log(`Filter formula: ${activityFormula}`);

  const activities = await base(EVENT_ACTIVITY_TABLE_ID)
    .select({
      filterByFormula: activityFormula,
      maxRecords: 5
    })
    .all();

  console.log(`Found: ${activities.length} activities`);

  // Read the record directly to see what's returned
  console.log('\nReading record directly...');
  const record = await base(EVENT_ACTIVITY_TABLE_ID).find(activityId);
  console.log('event_id field value:', record.fields.event_id);
  console.log('Full fields:', JSON.stringify(record.fields, null, 2));

  // Cleanup
  await base(EVENT_ACTIVITY_TABLE_ID).destroy([activityId]);
  console.log('\nCleaned up test record.');
}

debugLinkedRecords().catch(console.error);
