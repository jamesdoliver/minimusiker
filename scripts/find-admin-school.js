/**
 * Find school name for admin@minimusiker.de
 */

import { config } from 'dotenv';
import Airtable from 'airtable';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });

// Field IDs from earlier
const PARENTS_FIELD_IDS = {
  parent_email: 'fldd3LuRL0TmzVESR',
  parent_first_name: 'fldtaXHWE5RP0nrw5',
};

const REGISTRATIONS_FIELD_IDS = {
  parent_id: 'fldqfoJhaXH0Oj32J',
  event_id: 'fld4U9Wq5Skqf2Poq',
  class_id: 'fldfZeZiOGFg5UD0I',
};

const EVENTS_FIELD_IDS = {
  event_id: 'fldcNaHZyr6E5khDe',
  school_name: 'fld5QcpEsDFrLun6w',
  event_date: 'fld7pswBblm9jlOsS',
};

// Initialize Airtable
Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

const parentsTable = base(process.env.PARENTS_TABLE_ID);
const registrationsTable = base(process.env.REGISTRATIONS_TABLE_ID);
const eventsTable = base(process.env.EVENTS_TABLE_ID);

async function findSchool() {
  console.log('\n🔍 Finding school for admin@minimusiker.de...\n');

  // Step 1: Find parent record
  console.log('Step 1: Looking up parent...');
  const parentRecords = await parentsTable.select({
    filterByFormula: `LOWER({parent_email}) = 'admin@minimusiker.de'`,
    maxRecords: 1,
  }).firstPage();

  if (parentRecords.length === 0) {
    console.log('❌ No parent found with email admin@minimusiker.de');
    return;
  }

  const parent = parentRecords[0];
  console.log(`✅ Found parent: ${parent.fields.parent_first_name || 'N/A'}`);
  console.log(`   Parent Record ID: ${parent.id}`);

  // Step 2: Find registrations for this parent
  // Note: Airtable formulas don't work on linked record fields, so we fetch all and filter
  console.log('\nStep 2: Looking up registrations...');
  const allRegistrations = await registrationsTable.select().all();

  const registrations = allRegistrations.filter(reg => {
    // Without returnFieldsByFieldId, use field NAME not field ID
    const parentIds = reg.fields.parent_id;
    return parentIds && parentIds.includes(parent.id);
  });

  console.log(`✅ Found ${registrations.length} registration(s)`);

  if (registrations.length === 0) {
    console.log('❌ No registrations found for this parent');
    return;
  }

  // Step 3: Get unique event IDs from registrations
  console.log('\nStep 3: Looking up events...');
  const eventLinks = registrations
    .map(r => r.fields.event_id) // field name
    .filter(Boolean)
    .flat();

  console.log(`   Found ${eventLinks.length} event link(s)`);

  // Step 4: Get event details
  const events = [];
  for (const eventRecordId of eventLinks) {
    try {
      const eventRecord = await eventsTable.find(eventRecordId);
      events.push({
        school: eventRecord.fields.school_name,
        date: eventRecord.fields.event_date,
        eventId: eventRecord.fields.event_id,
      });
    } catch (error) {
      console.error(`   Error fetching event ${eventRecordId}:`, error.message);
    }
  }

  // Display results
  console.log('\n' + '='.repeat(60));
  console.log('\n📋 RESULTS\n');
  console.log(`Parent: ${parent.fields.parent_first_name || 'N/A'} (${parent.fields.parent_email})`);
  console.log(`Total Registrations: ${registrations.length}`);
  console.log(`\nSchool(s):\n`);

  events.forEach((event, i) => {
    console.log(`${i + 1}. ${event.school}`);
    console.log(`   Event Date: ${event.date}`);
    console.log(`   Event ID: ${event.eventId}`);
  });

  console.log('\n' + '='.repeat(60) + '\n');

  // Return the first school name for user
  if (events.length > 0) {
    console.log(`✅ ANSWER: Search for "${events[0].school}"\n`);
  }
}

findSchool().catch(error => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});
