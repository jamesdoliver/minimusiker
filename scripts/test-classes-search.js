/**
 * Test if SEARCH formula works on Classes table
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

const EVENTS_TABLE_ID = process.env.EVENTS_TABLE_ID;
const CLASSES_TABLE_ID = process.env.CLASSES_TABLE_ID;
const CLASSES_EVENT_ID_FIELD = 'fldSSaeBuQDkOhOIT'; // From types/airtable.ts

async function testClassesSearch() {
  console.log('🔍 Testing SEARCH formula on Classes table...\n');

  // Get an event with linked classes
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
  console.log(`Event: ${event.fields.school_name}`);
  console.log(`Event Record ID: ${eventRecordId}`);
  console.log(`Linked Classes (from Events table): ${JSON.stringify(event.fields.Classes)}\n`);

  // Try to find classes using SEARCH (like airtableService does)
  console.log('Searching for classes with SEARCH formula...');
  const formula = `SEARCH('${eventRecordId}', {${CLASSES_EVENT_ID_FIELD}})`;
  console.log(`Formula: ${formula}\n`);

  const classes = await base(CLASSES_TABLE_ID)
    .select({
      filterByFormula: formula,
      maxRecords: 10
    })
    .all();

  console.log(`Found: ${classes.length} classes`);

  if (classes.length > 0) {
    for (const cls of classes) {
      console.log(`  - ${cls.id}: ${cls.fields.class_name} | event_id: ${JSON.stringify(cls.fields.event_id)}`);
    }
  } else {
    // List all classes to see what event_id looks like
    console.log('\nListing all classes to inspect event_id field...');
    const allClasses = await base(CLASSES_TABLE_ID)
      .select({ maxRecords: 5 })
      .all();

    for (const cls of allClasses) {
      console.log(`  - ${cls.id}: ${cls.fields.class_name}`);
      console.log(`    event_id: ${JSON.stringify(cls.fields.event_id)}`);
      console.log(`    (type: ${typeof cls.fields.event_id}, isArray: ${Array.isArray(cls.fields.event_id)})`);
    }
  }
}

testClassesSearch().catch(console.error);
