// investigate-bookings.js
// Find all relevant bookings to understand the data

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const TEACHER_EMAIL = 'katrin.bolten@gsunterharmersbach.de';

const TABLES = {
  SCHOOL_BOOKINGS: 'tblrktl5eLJEWE4M6',
};

async function investigate() {
  console.log('=== INVESTIGATE BOOKINGS ===\n');

  // 1. Find all bookings for this teacher
  console.log('--- Bookings by Teacher Email ---');
  const teacherBookings = await base(TABLES.SCHOOL_BOOKINGS)
    .select({
      filterByFormula: `LOWER({school_contact_email}) = LOWER('${TEACHER_EMAIL}')`,
    })
    .all();

  console.log(`Found ${teacherBookings.length} booking(s) for ${TEACHER_EMAIL}:\n`);
  for (const b of teacherBookings) {
    console.log(`Record ID: ${b.id}`);
    console.log(`  school_name: ${b.fields.school_name}`);
    console.log(`  school_contact_email: ${b.fields.school_contact_email}`);
    console.log(`  start_date: ${b.fields.start_date}`);
    console.log(`  simplybook_status: ${b.fields.simplybook_status}`);
    console.log('');
  }

  // 2. Find bookings for Grundschule Unterharmersbach
  console.log('--- Bookings by School Name ---');
  const schoolBookings = await base(TABLES.SCHOOL_BOOKINGS)
    .select({
      filterByFormula: `SEARCH('Unterharmersbach', {school_name}) > 0`,
    })
    .all();

  console.log(`Found ${schoolBookings.length} booking(s) for Unterharmersbach:\n`);
  for (const b of schoolBookings) {
    console.log(`Record ID: ${b.id}`);
    console.log(`  school_name: ${b.fields.school_name}`);
    console.log(`  school_contact_email: ${b.fields.school_contact_email}`);
    console.log(`  start_date: ${b.fields.start_date}`);
    console.log(`  simplybook_status: ${b.fields.simplybook_status}`);
    console.log('');
  }

  console.log('=== END INVESTIGATION ===');
}

investigate().catch(console.error);
