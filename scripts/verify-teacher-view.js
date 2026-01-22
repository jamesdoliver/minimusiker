/**
 * Verify what the teacher portal would show for the test event
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
const REGISTRATIONS_TABLE_ID = process.env.REGISTRATIONS_TABLE_ID;

const eventRecordId = 'rec0wSBHFh25FaPXY';
const classRecordId = 'recdilmMlBh3PU3IB';

async function verifyTeacherView() {
  console.log('🔍 Verifying what Teacher Portal would show\n');

  // Get event details
  const event = await base(EVENTS_TABLE_ID).find(eventRecordId);
  console.log('='.repeat(60));
  console.log('EVENT DETAILS');
  console.log('='.repeat(60));
  console.log('School:', event.fields.school_name);
  console.log('Event ID:', event.fields.event_id);
  console.log('Event Date:', event.fields.event_date);
  console.log('Linked Classes:', event.fields.Classes);
  console.log('Linked Registrations:', event.fields.Registrations);

  // Get class details
  const cls = await base(CLASSES_TABLE_ID).find(classRecordId);
  console.log('\n' + '='.repeat(60));
  console.log('CLASS DETAILS');
  console.log('='.repeat(60));
  console.log('Class Name:', cls.fields.class_name);
  console.log('Is Default:', cls.fields.is_default);
  console.log('Total Children Expected:', cls.fields.total_children || 'Not set');
  console.log('Linked Registrations:', cls.fields.Registrations);

  // Count registrations for this class
  console.log('\n' + '='.repeat(60));
  console.log('REGISTRATIONS FOR THIS CLASS');
  console.log('='.repeat(60));

  const registrations = await base(REGISTRATIONS_TABLE_ID)
    .select({
      filterByFormula: `FIND('${classRecordId}', ARRAYJOIN({class_id}))`
    })
    .all();

  console.log(`\nTotal registrations: ${registrations.length}`);
  console.log('\nRegistered children:');
  for (const reg of registrations) {
    console.log(`  - ${reg.fields.registered_child}`);
  }

  // Summary - what teacher portal would show
  console.log('\n' + '='.repeat(60));
  console.log('TEACHER PORTAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`\n📊 ${event.fields.school_name} - ${event.fields.event_date}`);
  console.log(`   Class: ${cls.fields.class_name}`);
  console.log(`   Registrations: ${registrations.length} child(ren)`);

  // Check if our test child is there
  const testChild = registrations.find(r => r.fields.registered_child === 'Test Child ScenarioA');
  if (testChild) {
    console.log(`\n✅ Test registration "Test Child ScenarioA" IS visible in teacher portal data`);
  } else {
    console.log(`\n❌ Test registration "Test Child ScenarioA" NOT found`);
  }
}

verifyTeacherView().catch(console.error);
