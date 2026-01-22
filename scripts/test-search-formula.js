/**
 * Test different Airtable filter formulas for linked records
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

async function testFormulas() {
  console.log('🔍 Testing Airtable filter formulas for linked records...\n');

  // 1. Get a test event
  const events = await base(EVENTS_TABLE_ID)
    .select({ maxRecords: 1 })
    .firstPage();
  const eventRecordId = events[0].id;
  console.log(`Test Event Record ID: ${eventRecordId}\n`);

  // 2. Create a test activity with event link
  console.log('Creating test activity...');
  const created = await base(EVENT_ACTIVITY_TABLE_ID).create([{
    fields: {
      'fldHXdy9XckysZkN5': [eventRecordId],  // event_id field ID
      'fldkq8kGUpN1EGMEm': 'date_changed',   // activity_type field ID
      'flduPDeYq7N5JAhGm': 'Formula test',   // description field ID
      'fld8BkhP9HrERtKdD': 'test@test.com',  // actor_email field ID
      'flduzSRoFPcJZrjM8': 'system',         // actor_type field ID
    }
  }]);
  const activityId = created[0].id;
  console.log(`Created: ${activityId}`);

  // Wait a moment for Airtable to index
  console.log('Waiting 2 seconds for Airtable indexing...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Read it back
  const record = await base(EVENT_ACTIVITY_TABLE_ID).find(activityId);
  console.log(`\nRecord fields: ${JSON.stringify(record.fields, null, 2)}\n`);

  // Test various formulas
  const eventIdFieldId = 'fldHXdy9XckysZkN5';

  const formulas = [
    { name: 'SEARCH with field NAME', formula: `SEARCH('${eventRecordId}', {event_id})` },
    { name: 'SEARCH with field ID', formula: `SEARCH('${eventRecordId}', {${eventIdFieldId}})` },
    { name: 'FIND with ARRAYJOIN (name)', formula: `FIND('${eventRecordId}', ARRAYJOIN({event_id}))` },
    { name: 'FIND with ARRAYJOIN (ID)', formula: `FIND('${eventRecordId}', ARRAYJOIN({${eventIdFieldId}}))` },
    { name: 'RECORD_ID equals', formula: `RECORD_ID() = '${activityId}'` },
    { name: 'All records', formula: '' },
  ];

  console.log('Testing filter formulas:\n');

  for (const { name, formula } of formulas) {
    try {
      const selectOptions = {
        maxRecords: 10,
      };
      if (formula) {
        selectOptions.filterByFormula = formula;
      }

      const results = await base(EVENT_ACTIVITY_TABLE_ID)
        .select(selectOptions)
        .all();

      console.log(`${name}:`);
      console.log(`  Formula: ${formula || '(none)'}`);
      console.log(`  Results: ${results.length} records`);

      if (results.length > 0) {
        for (const r of results) {
          console.log(`    - ${r.id}: ${r.fields.description || 'no description'} | event_id: ${JSON.stringify(r.fields.event_id)}`);
        }
      }
      console.log('');
    } catch (e) {
      console.log(`${name}:`);
      console.log(`  Formula: ${formula}`);
      console.log(`  Error: ${e.message}\n`);
    }
  }

  // Check if the event_id field is actually a text or record link
  console.log('\n--- Field analysis ---');
  const allRecords = await base(EVENT_ACTIVITY_TABLE_ID)
    .select({ maxRecords: 5 })
    .all();

  for (const r of allRecords) {
    const eventIdValue = r.fields.event_id;
    console.log(`Record ${r.id}:`);
    console.log(`  event_id value: ${JSON.stringify(eventIdValue)}`);
    console.log(`  event_id type: ${typeof eventIdValue}`);
    console.log(`  event_id isArray: ${Array.isArray(eventIdValue)}`);
    if (Array.isArray(eventIdValue) && eventIdValue.length > 0) {
      console.log(`  First element: ${eventIdValue[0]} (${typeof eventIdValue[0]})`);
    }
  }

  // Cleanup
  console.log('\nCleaning up...');
  await base(EVENT_ACTIVITY_TABLE_ID).destroy([activityId]);
  console.log('Done.');
}

testFormulas().catch(console.error);
