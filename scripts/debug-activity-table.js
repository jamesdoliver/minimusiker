/**
 * Debug script to inspect the EventActivity table structure
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

async function debugTable() {
  console.log('🔍 Inspecting EventActivity table...\n');

  // Get all records
  const records = await base(EVENT_ACTIVITY_TABLE_ID)
    .select({ maxRecords: 10 })
    .all();

  console.log(`Found ${records.length} records\n`);

  for (const record of records) {
    console.log(`\nRecord: ${record.id}`);
    console.log('Fields:', JSON.stringify(record.fields, null, 2));

    // Check the event_id field specifically
    const eventId = record.get('event_id');
    console.log('event_id raw:', eventId, 'type:', typeof eventId, 'isArray:', Array.isArray(eventId));
  }

  // Test the filter formula
  console.log('\n\n🔍 Testing filter formula...');
  const testEventId = 'rec0wSBHFh25FaPXY'; // Österfeldschule event

  // Try different filter approaches
  console.log('\nTrying FIND with ARRAYJOIN:');
  try {
    const r1 = await base(EVENT_ACTIVITY_TABLE_ID)
      .select({
        filterByFormula: `FIND('${testEventId}', ARRAYJOIN({event_id}))`,
        maxRecords: 5
      })
      .all();
    console.log(`  Found: ${r1.length} records`);
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }

  console.log('\nTrying RECORD_ID match:');
  try {
    const r2 = await base(EVENT_ACTIVITY_TABLE_ID)
      .select({
        filterByFormula: `RECORD_ID() = '${testEventId}'`,
        maxRecords: 5
      })
      .all();
    console.log(`  Found: ${r2.length} records`);
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }
}

debugTable().catch(console.error);
