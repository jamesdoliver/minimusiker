/**
 * Debug script to see actual table structure and data
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

async function debugTables() {
  console.log('\n🔍 Debugging Table Structure\n');
  console.log('='.repeat(60));

  // Check Parents table
  console.log('\n📋 PARENTS TABLE');
  console.log('-'.repeat(60));
  try {
    const parentsTable = base(process.env.PARENTS_TABLE_ID);
    const parents = await parentsTable.select({ maxRecords: 1 }).firstPage();

    if (parents.length > 0) {
      const parent = parents[0];
      console.log('Sample parent record:');
      console.log('  Record ID:', parent.id);
      console.log('  Fields:', JSON.stringify(parent.fields, null, 2));
    } else {
      console.log('  No parents found');
    }
  } catch (error) {
    console.log('  ❌ Error:', error.message);
  }

  // Check Events table
  console.log('\n📋 EVENTS TABLE');
  console.log('-'.repeat(60));
  try {
    const eventsTable = base(process.env.EVENTS_TABLE_ID);
    const events = await eventsTable.select({ maxRecords: 1 }).firstPage();

    if (events.length > 0) {
      const event = events[0];
      console.log('Sample event record:');
      console.log('  Record ID:', event.id);
      console.log('  Fields:', JSON.stringify(event.fields, null, 2));
    } else {
      console.log('  No events found');
    }
  } catch (error) {
    console.log('  ❌ Error:', error.message);
  }

  // Check Classes table
  console.log('\n📋 CLASSES TABLE');
  console.log('-'.repeat(60));
  try {
    const classesTable = base(process.env.CLASSES_TABLE_ID);
    const classes = await classesTable.select({ maxRecords: 1 }).firstPage();

    if (classes.length > 0) {
      const classRec = classes[0];
      console.log('Sample class record:');
      console.log('  Record ID:', classRec.id);
      console.log('  Fields:', JSON.stringify(classRec.fields, null, 2));
    } else {
      console.log('  No classes found');
    }
  } catch (error) {
    console.log('  ❌ Error:', error.message);
  }

  // Check Registrations table
  console.log('\n📋 REGISTRATIONS TABLE');
  console.log('-'.repeat(60));
  try {
    const registrationsTable = base(process.env.REGISTRATIONS_TABLE_ID);
    const registrations = await registrationsTable.select({ maxRecords: 1 }).firstPage();

    if (registrations.length > 0) {
      const registration = registrations[0];
      console.log('Sample registration record:');
      console.log('  Record ID:', registration.id);
      console.log('  Fields:', JSON.stringify(registration.fields, null, 2));
    } else {
      console.log('  No registrations found');
    }
  } catch (error) {
    console.log('  ❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

debugTables().catch(error => {
  console.error('\n❌ Debug script failed:', error);
  process.exit(1);
});
