/**
 * Script to verify the class creation/retrieval fix
 *
 * This script checks that classes can be created and retrieved
 * using the event_id format (evt_...) consistently.
 */

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Table IDs
const CLASSES_TABLE_ID = 'tbl17SVI5gacwOP0n';
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const SCHOOL_BOOKINGS_TABLE_ID = 'tblrktl5eLJEWE4M6';

// Field IDs
const CLASSES_FIELD_IDS = {
  class_id: 'fld1dXGae9I7xldun',
  event_id: 'fldSSaeBuQDkOhOIT',
  class_name: 'fld1kaSb8my7q5mHt',
  legacy_booking_id: 'fldXGF3yXrHeI4vWn',
};

async function main() {
  const testEventId = process.argv[2] || 'evt_gs_buchhaltung_minimusiker_20260330_d563af';

  console.log('='.repeat(60));
  console.log('Verifying class fix for eventId:', testEventId);
  console.log('='.repeat(60));

  // 1. Look up Event by event_id
  console.log('\n1. Looking up Event by event_id...');
  const eventRecords = await base(EVENTS_TABLE_ID).select({
    filterByFormula: `{event_id} = "${testEventId}"`,
    maxRecords: 1,
  }).firstPage();

  if (eventRecords.length > 0) {
    const event = eventRecords[0];
    console.log('   Found Event:', event.id);
    console.log('   - event_id:', event.get('event_id'));
    console.log('   - school_name:', event.get('school_name'));
    console.log('   - event_date:', event.get('event_date'));
    console.log('   - simplybook_booking:', event.get('simplybook_booking'));

    // 2. If Event has linked SchoolBooking, look it up
    const linkedBookings = event.get('simplybook_booking');
    if (linkedBookings && linkedBookings.length > 0) {
      console.log('\n2. Looking up linked SchoolBooking...');
      const bookingRecords = await base(SCHOOL_BOOKINGS_TABLE_ID).select({
        filterByFormula: `RECORD_ID() = '${linkedBookings[0]}'`,
        maxRecords: 1,
        returnFieldsByFieldId: true,
      }).firstPage();

      if (bookingRecords.length > 0) {
        const booking = bookingRecords[0];
        console.log('   Found SchoolBooking:', booking.id);
        console.log('   - simplybook_id:', booking.fields['fldb5FI6ij00eICaT']); // simplybook_id field
        console.log('   - school_name:', booking.fields['fldlRful9AwfzUrOc']); // school_contact_name
      }
    }
  } else {
    console.log('   Event NOT found');
  }

  // 3. Query Classes with event_id format
  console.log('\n3. Querying Classes by legacy_booking_id =', testEventId);
  const classRecords = await base(CLASSES_TABLE_ID).select({
    filterByFormula: `{${CLASSES_FIELD_IDS.legacy_booking_id}} = '${testEventId}'`,
    returnFieldsByFieldId: true,
  }).all();

  console.log('   Found', classRecords.length, 'class(es)');
  for (const cls of classRecords) {
    console.log('   - class_id:', cls.fields[CLASSES_FIELD_IDS.class_id]);
    console.log('     class_name:', cls.fields[CLASSES_FIELD_IDS.class_name]);
    console.log('     legacy_booking_id:', cls.fields[CLASSES_FIELD_IDS.legacy_booking_id]);
  }

  // 4. Check if there's a numeric simplybook_id that might have been used
  if (eventRecords.length > 0) {
    const linkedBookings = eventRecords[0].get('simplybook_booking');
    if (linkedBookings && linkedBookings.length > 0) {
      const bookingRecords = await base(SCHOOL_BOOKINGS_TABLE_ID).select({
        filterByFormula: `RECORD_ID() = '${linkedBookings[0]}'`,
        maxRecords: 1,
        returnFieldsByFieldId: true,
      }).firstPage();

      if (bookingRecords.length > 0) {
        const simplybookId = bookingRecords[0].fields['fldb5FI6ij00eICaT'];
        if (simplybookId && simplybookId !== testEventId) {
          console.log('\n4. Also checking for classes with simplybookId:', simplybookId);
          const altClassRecords = await base(CLASSES_TABLE_ID).select({
            filterByFormula: `{${CLASSES_FIELD_IDS.legacy_booking_id}} = '${simplybookId}'`,
            returnFieldsByFieldId: true,
          }).all();

          console.log('   Found', altClassRecords.length, 'class(es) with simplybookId format');
          for (const cls of altClassRecords) {
            console.log('   - class_id:', cls.fields[CLASSES_FIELD_IDS.class_id]);
            console.log('     class_name:', cls.fields[CLASSES_FIELD_IDS.class_name]);
          }
        }
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Verification complete');
  console.log('='.repeat(60));
}

main().catch(console.error);
