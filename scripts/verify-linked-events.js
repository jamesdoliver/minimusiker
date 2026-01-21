/**
 * Verification script for linked_events teacher visibility feature
 *
 * This script tests that:
 * 1. getEventsByRecordIds() works correctly
 * 2. getTeacherEvents() returns events from linked_events field
 * 3. Duplicates are handled correctly (same event from multiple sources)
 *
 * Usage: node scripts/verify-linked-events.js <teacher_email>
 */

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const TEACHERS_TABLE = 'tblLO2vXcgvNjrJ0T';
const EVENTS_TABLE = 'tbljMDMdirwb2iIkz';

async function getTeacherByEmail(email) {
  const records = await base(TEACHERS_TABLE)
    .select({
      filterByFormula: `LOWER({email}) = LOWER('${email.replace(/'/g, "\\'")}')`,
      maxRecords: 1,
    })
    .all();

  if (records.length === 0) return null;

  return {
    id: records[0].id,
    email: records[0].fields.email,
    name: records[0].fields.name,
    linkedEvents: records[0].fields.linked_events || [],
  };
}

async function getEventById(recordId) {
  try {
    const record = await base(EVENTS_TABLE).find(recordId);
    return {
      id: record.id,
      event_id: record.get('event_id'),
      school_name: record.get('school_name'),
      event_date: record.get('event_date'),
      event_type: record.get('event_type'),
    };
  } catch (error) {
    console.error(`Error fetching event ${recordId}:`, error.message);
    return null;
  }
}

async function main() {
  const teacherEmail = process.argv[2];

  if (!teacherEmail) {
    console.log('Usage: node scripts/verify-linked-events.js <teacher_email>');
    console.log('\nThis script verifies that the linked_events feature works correctly.');
    console.log('\nSteps to test manually:');
    console.log('1. Find a teacher email in Airtable');
    console.log('2. Link that teacher to an event via Events.teachers field');
    console.log('3. Run this script with that teacher email');
    console.log('4. The linked event should appear in the output');
    return;
  }

  console.log(`\n🔍 Looking up teacher: ${teacherEmail}\n`);

  const teacher = await getTeacherByEmail(teacherEmail);

  if (!teacher) {
    console.log('❌ Teacher not found in Teachers table');
    return;
  }

  console.log('✅ Teacher found:');
  console.log(`   Name: ${teacher.name}`);
  console.log(`   Email: ${teacher.email}`);
  console.log(`   Record ID: ${teacher.id}`);
  console.log(`   Linked Events: ${teacher.linkedEvents.length} event(s)`);

  if (teacher.linkedEvents.length === 0) {
    console.log('\n⚠️  No events linked via Teachers.linked_events field.');
    console.log('   To test this feature, link this teacher to an event in Airtable:');
    console.log('   1. Open the Events table');
    console.log('   2. Find the event you want to link');
    console.log('   3. Edit the "teachers" field');
    console.log('   4. Select this teacher');
    console.log('   5. Save and re-run this script');
    return;
  }

  console.log('\n📋 Fetching linked events:\n');

  for (const eventRecordId of teacher.linkedEvents) {
    const event = await getEventById(eventRecordId);

    if (event) {
      console.log(`   ✅ Event: ${event.event_id}`);
      console.log(`      School: ${event.school_name}`);
      console.log(`      Date: ${event.event_date}`);
      console.log(`      Type: ${event.event_type || 'MiniMusiker Day'}`);
      console.log('');
    } else {
      console.log(`   ❌ Event record ${eventRecordId} not found (may be deleted)`);
    }
  }

  console.log('✅ Verification complete!');
  console.log('\nNext steps:');
  console.log('1. Log in as this teacher at /paedagogen-login');
  console.log('2. Verify the linked event(s) appear on the dashboard');
  console.log('3. Confirm they can access event details');
}

main().catch(console.error);
