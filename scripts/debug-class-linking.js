/**
 * Debug how classes are linked to events
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

async function debug() {
  console.log('🔍 Debugging class-to-event linking...\n');

  // Get first 3 events
  const events = await base(EVENTS_TABLE_ID)
    .select({ maxRecords: 3 })
    .all();

  console.log('=== SAMPLE EVENTS ===\n');
  for (const event of events) {
    console.log('Event Record ID:', event.id);
    console.log('Event Fields:', JSON.stringify(event.fields, null, 2));
    console.log('---');
  }

  // Get first 5 classes
  const classes = await base(CLASSES_TABLE_ID)
    .select({ maxRecords: 5 })
    .all();

  console.log('\n=== SAMPLE CLASSES ===\n');
  for (const cls of classes) {
    console.log('Class Record ID:', cls.id);
    console.log('Class Fields:', JSON.stringify(cls.fields, null, 2));
    console.log('---');
  }
}

debug().catch(console.error);
