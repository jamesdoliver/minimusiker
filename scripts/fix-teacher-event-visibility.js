// fix-teacher-event-visibility.js
// Links the SchoolBooking to the Event record

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const EVENT_ID = 'evt_grundschule_unterharmersbach_minimusiker_20260306_583f43';
const BOOKING_RECORD_ID = 'rec8wISalF0vhtiAW'; // Grundschule Unterharmersbach, 2026-03-06

const TABLES = {
  EVENTS: 'tblVWx1RrsGRjsNn5',
  SCHOOL_BOOKINGS: 'tblrktl5eLJEWE4M6',
};

const FIELDS = {
  EVENTS: {
    event_id: 'fldcNaHZyr6E5khDe',
    simplybook_booking: 'fldK7vyxLd9MxgmES',
  },
};

async function fix() {
  console.log('=== FIX: LINK SCHOOLBOOKING TO EVENT ===\n');

  // 1. Find the Event record
  console.log('--- Step 1: Find Event ---');
  const events = await base(TABLES.EVENTS)
    .select({
      filterByFormula: `{event_id} = '${EVENT_ID}'`,
      maxRecords: 1,
    })
    .all();

  if (events.length === 0) {
    console.log('❌ Event not found. Aborting.');
    return;
  }

  const eventRecord = events[0];
  console.log(`✅ Event found: ${eventRecord.id}`);

  // 2. Verify the SchoolBooking exists
  console.log('\n--- Step 2: Verify SchoolBooking ---');
  const bookingRecord = await base(TABLES.SCHOOL_BOOKINGS).find(BOOKING_RECORD_ID);
  console.log(`✅ SchoolBooking found: ${bookingRecord.id}`);
  console.log(`   School: ${bookingRecord.fields.school_name}`);
  console.log(`   Date: ${bookingRecord.fields.start_date}`);
  console.log(`   Contact: ${bookingRecord.fields.school_contact_email}`);

  // 3. Update the Event to link to the SchoolBooking
  console.log('\n--- Step 3: Link Event to SchoolBooking ---');
  await base(TABLES.EVENTS).update(eventRecord.id, {
    [FIELDS.EVENTS.simplybook_booking]: [BOOKING_RECORD_ID],
  });

  console.log(`✅ Event ${eventRecord.id} now linked to SchoolBooking ${BOOKING_RECORD_ID}`);

  // 4. Verify the link
  console.log('\n--- Step 4: Verify ---');
  const updatedEvent = await base(TABLES.EVENTS).find(eventRecord.id);
  const linkedBookings = updatedEvent.fields[FIELDS.EVENTS.simplybook_booking] || [];

  if (linkedBookings.includes(BOOKING_RECORD_ID)) {
    console.log('✅ Verification successful! Event is now linked to SchoolBooking.');
    console.log('\n🎉 Teacher katrin.bolten@gsunterharmersbach.de should now see the event in their portal.');
  } else {
    console.log('❌ Verification failed. Please check manually.');
  }

  console.log('\n=== END FIX ===');
}

fix().catch(console.error);
