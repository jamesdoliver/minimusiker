/**
 * Verify that activity records link correctly to events
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

// Field IDs for creating
const FIELD_IDS = {
  event_id: 'fldHXdy9XckysZkN5',
  activity_type: 'fldkq8kGUpN1EGMEm',
  description: 'flduPDeYq7N5JAhGm',
  actor_email: 'fld8BkhP9HrERtKdD',
  actor_type: 'flduzSRoFPcJZrjM8',
  metadata: 'fldkpYFQYLiv281jX',
};

async function verifyActivityLink() {
  console.log('🔍 Verifying activity link to events...\n');

  // 1. Get a test event
  const events = await base(EVENTS_TABLE_ID)
    .select({ maxRecords: 1 })
    .firstPage();

  const eventRecordId = events[0].id;
  const eventName = events[0].fields.school_name;

  console.log(`Test Event: ${eventName} (${eventRecordId})\n`);

  // 2. Create a test activity with event link
  console.log('Creating test activity with event link...');
  const fields = {
    [FIELD_IDS.event_id]: [eventRecordId],
    [FIELD_IDS.activity_type]: 'date_changed',
    [FIELD_IDS.description]: 'Test activity - verifying event link',
    [FIELD_IDS.actor_email]: 'test@minimusiker.de',
    [FIELD_IDS.actor_type]: 'system',
    [FIELD_IDS.metadata]: JSON.stringify({ test: true }),
  };

  const created = await base(EVENT_ACTIVITY_TABLE_ID).create([{ fields }]);
  const activityRecordId = created[0].id;
  console.log(`Created: ${activityRecordId}\n`);

  // 3. Read the record back and inspect the event_id field
  console.log('Reading record back...');
  const record = await base(EVENT_ACTIVITY_TABLE_ID).find(activityRecordId);
  console.log('Fields:', JSON.stringify(record.fields, null, 2));

  const linkedEventId = record.get('event_id');
  console.log(`\nevent_id field value: ${JSON.stringify(linkedEventId)}`);
  console.log(`Type: ${typeof linkedEventId}, isArray: ${Array.isArray(linkedEventId)}`);

  // 4. Test different filter formulas
  console.log('\n--- Testing filter formulas ---\n');

  // Formula 1: FIND with ARRAYJOIN
  console.log('Formula 1: FIND(eventRecordId, ARRAYJOIN(event_id))');
  const formula1 = `FIND('${eventRecordId}', ARRAYJOIN({event_id}))`;
  console.log(`  ${formula1}`);
  const r1 = await base(EVENT_ACTIVITY_TABLE_ID).select({
    filterByFormula: formula1,
    maxRecords: 5
  }).all();
  console.log(`  Result: ${r1.length} records`);

  // Formula 2: Check if linked record contains the ID
  console.log('\nFormula 2: FIND(eventRecordId, event_id & "")');
  const formula2 = `FIND('${eventRecordId}', {event_id} & "")`;
  console.log(`  ${formula2}`);
  const r2 = await base(EVENT_ACTIVITY_TABLE_ID).select({
    filterByFormula: formula2,
    maxRecords: 5
  }).all();
  console.log(`  Result: ${r2.length} records`);

  // Formula 3: Simple equality
  console.log('\nFormula 3: event_id = eventRecordId');
  const formula3 = `{event_id} = '${eventRecordId}'`;
  console.log(`  ${formula3}`);
  try {
    const r3 = await base(EVENT_ACTIVITY_TABLE_ID).select({
      filterByFormula: formula3,
      maxRecords: 5
    }).all();
    console.log(`  Result: ${r3.length} records`);
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }

  // 5. Cleanup
  console.log('\nCleaning up test record...');
  await base(EVENT_ACTIVITY_TABLE_ID).destroy([activityRecordId]);
  console.log('Done.');
}

verifyActivityLink().catch(console.error);
