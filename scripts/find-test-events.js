/**
 * Find test events for QR/numeric link verification
 * Looks for:
 * - Scenario A: Event with only 1 class (default "Alle Kinder")
 * - Scenario B: Event with multiple classes
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

async function findTestEvents() {
  console.log('🔍 Searching for test events...\n');

  // Get all events with access_code
  const events = await base(EVENTS_TABLE_ID)
    .select({
      filterByFormula: `{access_code} != ''`,
      maxRecords: 100
    })
    .all();

  console.log(`Found ${events.length} events with access codes\n`);

  // Get all classes and index by record ID
  const classes = await base(CLASSES_TABLE_ID)
    .select({ maxRecords: 500 })
    .all();

  const classesById = {};
  for (const cls of classes) {
    classesById[cls.id] = {
      id: cls.id,
      name: cls.fields.class_name,
      isDefault: cls.fields.is_default
    };
  }

  console.log(`Found ${classes.length} classes\n`);

  // Categorize events
  const singleClassEvents = [];
  const multiClassEvents = [];
  const noClassEvents = [];

  for (const event of events) {
    const fields = event.fields;
    const eventId = fields.event_id;
    const accessCode = fields.access_code;
    const schoolName = fields.school_name;
    const eventDate = fields.event_date;

    if (!eventId || !accessCode) continue;

    // Get linked class IDs from the Classes field
    const linkedClassIds = fields.Classes || [];
    const eventClasses = linkedClassIds
      .map(id => classesById[id])
      .filter(Boolean);

    const eventInfo = {
      recordId: event.id,
      eventId,
      accessCode,
      schoolName,
      eventDate,
      classCount: eventClasses.length,
      classes: eventClasses
    };

    if (eventClasses.length === 0) {
      noClassEvents.push(eventInfo);
    } else if (eventClasses.length === 1) {
      singleClassEvents.push(eventInfo);
    } else {
      multiClassEvents.push(eventInfo);
    }
  }

  console.log('='.repeat(60));
  console.log('SCENARIO A: Events with SINGLE class (for auto-placement test)');
  console.log('='.repeat(60));

  if (singleClassEvents.length === 0) {
    console.log('❌ No events found with exactly 1 class\n');
  } else {
    // Show first 5
    for (const event of singleClassEvents.slice(0, 5)) {
      console.log(`\n📍 Access Code: ${event.accessCode}`);
      console.log(`   URL: https://minimusiker.app/e/${event.accessCode}`);
      console.log(`   School: ${event.schoolName}`);
      console.log(`   Date: ${event.eventDate}`);
      console.log(`   Event ID: ${event.eventId}`);
      console.log(`   Class: ${event.classes[0]?.name || 'Unknown'} (isDefault: ${event.classes[0]?.isDefault})`);
    }
    console.log(`\n   Total: ${singleClassEvents.length} single-class events`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('SCENARIO B: Events with MULTIPLE classes (for picker test)');
  console.log('='.repeat(60));

  if (multiClassEvents.length === 0) {
    console.log('❌ No events found with multiple classes\n');
  } else {
    // Show first 5
    for (const event of multiClassEvents.slice(0, 5)) {
      console.log(`\n📍 Access Code: ${event.accessCode}`);
      console.log(`   URL: https://minimusiker.app/e/${event.accessCode}`);
      console.log(`   School: ${event.schoolName}`);
      console.log(`   Date: ${event.eventDate}`);
      console.log(`   Event ID: ${event.eventId}`);
      console.log(`   Classes (${event.classCount}):`);
      for (const cls of event.classes) {
        console.log(`     - ${cls.name} ${cls.isDefault ? '(DEFAULT)' : ''}`);
      }
    }
    console.log(`\n   Total: ${multiClassEvents.length} multi-class events`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Events with NO classes (would show error):');
  console.log('='.repeat(60));
  console.log(`   ${noClassEvents.length} events with no linked classes`);

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`No-class events: ${noClassEvents.length}`);
  console.log(`Single-class events: ${singleClassEvents.length}`);
  console.log(`Multi-class events: ${multiClassEvents.length}`);

  // Return the first usable ones for testing
  return {
    scenarioA: singleClassEvents[0] || null,
    scenarioB: multiClassEvents[0] || null
  };
}

findTestEvents()
  .then(result => {
    console.log('\n' + '='.repeat(60));
    console.log('RECOMMENDED TEST EVENTS');
    console.log('='.repeat(60));
    if (result.scenarioA) {
      console.log(`\n✅ Scenario A (single class): https://minimusiker.app/e/${result.scenarioA.accessCode}`);
      console.log(`   School: ${result.scenarioA.schoolName}`);
      console.log(`   Class: ${result.scenarioA.classes[0]?.name}`);
    } else {
      console.log('\n❌ No suitable event for Scenario A');
    }
    if (result.scenarioB) {
      console.log(`\n✅ Scenario B (multi class): https://minimusiker.app/e/${result.scenarioB.accessCode}`);
      console.log(`   School: ${result.scenarioB.schoolName}`);
      console.log(`   Classes: ${result.scenarioB.classes.map(c => c.name).join(', ')}`);
    } else {
      console.log('\n❌ No suitable event for Scenario B');
    }
  })
  .catch(error => {
    console.error('\n❌ Error:', error);
  });
