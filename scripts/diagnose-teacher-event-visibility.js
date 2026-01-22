// diagnose-teacher-event-visibility.js
// Checks why teacher katrin.bolten@gsunterharmersbach.de cannot see event

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const TEACHER_EMAIL = 'katrin.bolten@gsunterharmersbach.de';
const EVENT_ID = 'evt_grundschule_unterharmersbach_minimusiker_20260306_583f43';

const TABLES = {
  TEACHERS: 'tblLO2vXcgvNjrJ0T',
  EVENTS: 'tblVWx1RrsGRjsNn5',
  SCHOOL_BOOKINGS: 'tblrktl5eLJEWE4M6',
};

const FIELDS = {
  TEACHERS: {
    email: 'fldkVlTMgLrLUrwlo',
    linked_events: 'fldJeROezAUX6zfA7',
    name: 'fld3GL8fRPSPhMw4J',
  },
  EVENTS: {
    event_id: 'fldcNaHZyr6E5khDe',
    simplybook_booking: 'fldK7vyxLd9MxgmES',
    teachers: 'fldivuUPiW6Q09vce',
  },
  SCHOOL_BOOKINGS: {
    school_contact_email: 'fldv4f6768hTNZYWT',
    simplybook_status: 'fldQNKzHPKxWgNJhK',
    start_date: 'fldbCBy0CxsivACiZ',
    school_name: 'fldlRful9AwfzUrOc',
  },
};

async function diagnose() {
  console.log('=== TEACHER EVENT VISIBILITY DIAGNOSIS ===\n');
  console.log(`Teacher Email: ${TEACHER_EMAIL}`);
  console.log(`Event ID: ${EVENT_ID}\n`);

  // 1. Check if teacher exists in Teachers table
  console.log('--- Step 1: Check Teachers Table ---');
  const teachers = await base(TABLES.TEACHERS)
    .select({
      filterByFormula: `LOWER({email}) = LOWER('${TEACHER_EMAIL}')`,
      maxRecords: 1,
    })
    .all();

  if (teachers.length === 0) {
    console.log('❌ Teacher NOT FOUND in Teachers table');
  } else {
    const t = teachers[0];
    console.log('✅ Teacher found:');
    console.log(`   Record ID: ${t.id}`);
    console.log(`   Name: ${t.fields[FIELDS.TEACHERS.name]}`);
    console.log(`   linked_events: ${JSON.stringify(t.fields[FIELDS.TEACHERS.linked_events])}`);
  }

  // 2. Find the Event record
  console.log('\n--- Step 2: Check Events Table ---');
  const events = await base(TABLES.EVENTS)
    .select({
      filterByFormula: `{event_id} = '${EVENT_ID}'`,
      maxRecords: 1,
    })
    .all();

  let eventRecordId = null;
  let linkedBookingIds = [];
  if (events.length === 0) {
    console.log('❌ Event NOT FOUND');
  } else {
    const e = events[0];
    eventRecordId = e.id;
    // Use field name instead of field ID to read linked records
    linkedBookingIds = e.fields.simplybook_booking || [];
    console.log('✅ Event found:');
    console.log(`   Record ID: ${e.id}`);
    console.log(`   simplybook_booking links: ${JSON.stringify(linkedBookingIds)}`);
    console.log(`   teachers links: ${JSON.stringify(e.fields.teachers)}`);
  }

  // 3. Check SchoolBookings linked to this event
  console.log('\n--- Step 3: Check SchoolBookings ---');
  if (linkedBookingIds.length === 0) {
    console.log('❌ No SchoolBookings linked to this event!');
  } else {
    for (const bookingId of linkedBookingIds) {
      const booking = await base(TABLES.SCHOOL_BOOKINGS).find(bookingId);
      // Use field names instead of field IDs
      const contactEmail = booking.fields.school_contact_email;
      const status = booking.fields.simplybook_status;
      const startDate = booking.fields.start_date;

      console.log(`\nSchoolBooking Record: ${bookingId}`);
      console.log(`   school_contact_email: ${contactEmail}`);
      console.log(`   simplybook_status: ${status}`);
      console.log(`   start_date: ${startDate}`);

      // Check if email matches
      const emailMatches = contactEmail?.toLowerCase() === TEACHER_EMAIL.toLowerCase();
      const statusOk = status === 'confirmed';
      const dateOk = new Date(startDate) >= new Date(new Date().toDateString());

      console.log('\n   Visibility Checks:');
      console.log(`   ${emailMatches ? '✅' : '❌'} Email matches teacher: ${emailMatches}`);
      console.log(`   ${statusOk ? '✅' : '❌'} Status is confirmed: ${statusOk}`);
      console.log(`   ${dateOk ? '✅' : '❌'} Date is future/today: ${dateOk}`);

      if (!emailMatches) {
        console.log('\n   ⚠️  ROOT CAUSE: school_contact_email does not match teacher email!');
        console.log(`      Current: ${contactEmail}`);
        console.log(`      Expected: ${TEACHER_EMAIL}`);
      }
    }
  }

  // 4. Check what bookings the teacher CAN see
  console.log('\n--- Step 4: Bookings Visible to Teacher ---');
  const visibleBookings = await base(TABLES.SCHOOL_BOOKINGS)
    .select({
      filterByFormula: `LOWER({school_contact_email}) = LOWER('${TEACHER_EMAIL}')`,
    })
    .all();

  console.log(`Teacher can see ${visibleBookings.length} booking(s):`);
  for (const b of visibleBookings) {
    console.log(`   - ${b.fields.school_name} on ${b.fields.start_date}`);
  }

  console.log('\n=== END DIAGNOSIS ===');
}

diagnose().catch(console.error);
