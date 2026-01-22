/**
 * Backfill Script: Populate new Teacher and Event fields from SchoolBookings
 *
 * This script populates:
 * - Teacher records: school_address, school_phone, region, linked_events
 * - Event records: school_address, school_phone
 *
 * Usage:
 *   node scripts/backfill-teacher-event-fields.js           # Dry run (preview only)
 *   node scripts/backfill-teacher-event-fields.js --write   # Actually write changes
 */
require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');

// Table IDs
const TEACHERS_TABLE_ID = 'tblLO2vXcgvNjrJ0T';
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const SCHOOL_BOOKINGS_TABLE_ID = 'tblrktl5eLJEWE4M6';

// Field IDs for Teachers table
const TEACHERS_FIELD_IDS = {
  email: 'fldkVlTMgLrLUrwlo',
  school_address: 'fldY8gUK35GlE7IAz',
  school_phone: 'fld9bssBb8WJWxQYV',
  region: 'fldVHy77JMhWpfxKy',
  linked_events: 'fldJeROezAUX6zfA7',
};

// Field IDs for Events table
const EVENTS_FIELD_IDS = {
  school_address: 'fldl7AAISoormK5Lr',
  school_phone: 'fldLPXOAWpGyYXoIT',
  simplybook_booking: 'fldK7vyxLd9MxgmES',
};

// Field IDs for SchoolBookings table
const SCHOOL_BOOKINGS_FIELD_IDS = {
  school_contact_email: 'fldv4f6768hTNZYWT',
  school_address: 'fld9ADLgRgjBeuLCH',
  school_phone: 'fldWWvCFJgrjScr8R',
  region: 'fldWhJSIkeC3V5Dmz',
};

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const base = airtable.base(process.env.AIRTABLE_BASE_ID);

// Check if we should actually write changes
const DRY_RUN = !process.argv.includes('--write');

async function getAllRecords(tableId) {
  const records = [];
  await base(tableId).select().eachPage((pageRecords, fetchNextPage) => {
    records.push(...pageRecords);
    fetchNextPage();
  });
  return records;
}

async function backfillTeachers() {
  console.log('\n' + '='.repeat(60));
  console.log('BACKFILLING TEACHER RECORDS');
  console.log('='.repeat(60));

  // Get all teachers
  const teachers = await getAllRecords(TEACHERS_TABLE_ID);
  console.log(`Found ${teachers.length} teachers`);

  // Get all bookings for lookup
  const bookings = await getAllRecords(SCHOOL_BOOKINGS_TABLE_ID);
  console.log(`Found ${bookings.length} bookings`);

  // Get all events for lookup
  const events = await getAllRecords(EVENTS_TABLE_ID);
  console.log(`Found ${events.length} events`);

  // Create lookup maps
  const bookingsByEmail = new Map();
  for (const booking of bookings) {
    const email = (booking.get('school_contact_email') || '').toLowerCase();
    if (email) {
      if (!bookingsByEmail.has(email)) {
        bookingsByEmail.set(email, []);
      }
      bookingsByEmail.get(email).push(booking);
    }
  }

  // Create event lookup by booking ID
  const eventsByBookingId = new Map();
  for (const event of events) {
    const bookingIds = event.get('simplybook_booking') || [];
    for (const bookingId of bookingIds) {
      eventsByBookingId.set(bookingId, event);
    }
  }

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const teacher of teachers) {
    const teacherEmail = (teacher.get('email') || '').toLowerCase();
    const teacherName = teacher.get('name') || teacher.get('school_name') || 'Unknown';

    if (!teacherEmail) {
      console.log(`  ⚠️  Skipping teacher ${teacher.id} - no email`);
      skippedCount++;
      continue;
    }

    // Find bookings for this teacher
    const teacherBookings = bookingsByEmail.get(teacherEmail) || [];

    if (teacherBookings.length === 0) {
      console.log(`  ⚠️  No bookings found for: ${teacherEmail}`);
      skippedCount++;
      continue;
    }

    // Use the most recent booking for field values
    const latestBooking = teacherBookings.sort((a, b) => {
      const dateA = new Date(a.get('created_at') || 0);
      const dateB = new Date(b.get('created_at') || 0);
      return dateB - dateA;
    })[0];

    // Check current values
    const currentAddress = teacher.get('school_address');
    const currentPhone = teacher.get('school_phone');
    const currentRegion = teacher.get('region');
    const currentLinkedEvents = teacher.get('linked_events') || [];

    // Get values from booking
    const newAddress = latestBooking.get('school_address');
    const newPhone = latestBooking.get('school_phone');
    const newRegion = latestBooking.get('region');

    // Find all events linked to this teacher's bookings
    const linkedEventIds = new Set(currentLinkedEvents);
    for (const booking of teacherBookings) {
      const event = eventsByBookingId.get(booking.id);
      if (event) {
        linkedEventIds.add(event.id);
      }
    }

    // Build update object (only update empty fields)
    const updates = {};

    if (!currentAddress && newAddress) {
      updates[TEACHERS_FIELD_IDS.school_address] = newAddress;
    }
    if (!currentPhone && newPhone) {
      updates[TEACHERS_FIELD_IDS.school_phone] = newPhone;
    }
    if (!currentRegion && newRegion) {
      updates[TEACHERS_FIELD_IDS.region] = newRegion;
    }
    if (linkedEventIds.size > currentLinkedEvents.length) {
      updates[TEACHERS_FIELD_IDS.linked_events] = Array.from(linkedEventIds);
    }

    if (Object.keys(updates).length === 0) {
      console.log(`  ✓ ${teacherEmail} - already up to date`);
      skippedCount++;
      continue;
    }

    console.log(`\n  📝 ${teacherEmail} (${teacherName})`);
    if (updates[TEACHERS_FIELD_IDS.school_address]) {
      console.log(`     school_address: "${updates[TEACHERS_FIELD_IDS.school_address]}"`);
    }
    if (updates[TEACHERS_FIELD_IDS.school_phone]) {
      console.log(`     school_phone: "${updates[TEACHERS_FIELD_IDS.school_phone]}"`);
    }
    if (updates[TEACHERS_FIELD_IDS.region]) {
      console.log(`     region: "${updates[TEACHERS_FIELD_IDS.region]}"`);
    }
    if (updates[TEACHERS_FIELD_IDS.linked_events]) {
      console.log(`     linked_events: ${updates[TEACHERS_FIELD_IDS.linked_events].length} events`);
    }

    if (!DRY_RUN) {
      try {
        await base(TEACHERS_TABLE_ID).update(teacher.id, updates);
        console.log(`     ✅ Updated`);
        updatedCount++;
      } catch (error) {
        console.log(`     ❌ Error: ${error.message}`);
        errorCount++;
      }
    } else {
      console.log(`     [DRY RUN - would update]`);
      updatedCount++;
    }
  }

  console.log(`\nTeacher Summary: ${updatedCount} updated, ${skippedCount} skipped, ${errorCount} errors`);
  return { updated: updatedCount, skipped: skippedCount, errors: errorCount };
}

async function backfillEvents() {
  console.log('\n' + '='.repeat(60));
  console.log('BACKFILLING EVENT RECORDS');
  console.log('='.repeat(60));

  // Get all events
  const events = await getAllRecords(EVENTS_TABLE_ID);
  console.log(`Found ${events.length} events`);

  // Get all bookings for lookup
  const bookings = await getAllRecords(SCHOOL_BOOKINGS_TABLE_ID);
  const bookingsById = new Map(bookings.map(b => [b.id, b]));

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const event of events) {
    const eventId = event.get('event_id') || event.id;
    const bookingIds = event.get('simplybook_booking') || [];

    // Check current values
    const currentAddress = event.get('school_address');
    const currentPhone = event.get('school_phone');

    // If already has values, skip
    if (currentAddress && currentPhone) {
      skippedCount++;
      continue;
    }

    // Find linked booking
    let linkedBooking = null;
    for (const bookingId of bookingIds) {
      if (bookingsById.has(bookingId)) {
        linkedBooking = bookingsById.get(bookingId);
        break;
      }
    }

    if (!linkedBooking) {
      console.log(`  ⚠️  No linked booking for event: ${eventId}`);
      skippedCount++;
      continue;
    }

    // Get values from booking
    const newAddress = linkedBooking.get('school_address');
    const newPhone = linkedBooking.get('school_phone');

    // Build update object (only update empty fields)
    const updates = {};

    if (!currentAddress && newAddress) {
      updates[EVENTS_FIELD_IDS.school_address] = newAddress;
    }
    if (!currentPhone && newPhone) {
      updates[EVENTS_FIELD_IDS.school_phone] = newPhone;
    }

    if (Object.keys(updates).length === 0) {
      skippedCount++;
      continue;
    }

    const schoolName = event.get('school_name') || 'Unknown';
    console.log(`\n  📝 ${eventId} (${schoolName})`);
    if (updates[EVENTS_FIELD_IDS.school_address]) {
      console.log(`     school_address: "${updates[EVENTS_FIELD_IDS.school_address]}"`);
    }
    if (updates[EVENTS_FIELD_IDS.school_phone]) {
      console.log(`     school_phone: "${updates[EVENTS_FIELD_IDS.school_phone]}"`);
    }

    if (!DRY_RUN) {
      try {
        await base(EVENTS_TABLE_ID).update(event.id, updates);
        console.log(`     ✅ Updated`);
        updatedCount++;
      } catch (error) {
        console.log(`     ❌ Error: ${error.message}`);
        errorCount++;
      }
    } else {
      console.log(`     [DRY RUN - would update]`);
      updatedCount++;
    }
  }

  console.log(`\nEvent Summary: ${updatedCount} updated, ${skippedCount} skipped, ${errorCount} errors`);
  return { updated: updatedCount, skipped: skippedCount, errors: errorCount };
}

async function main() {
  console.log('='.repeat(60));
  console.log('BACKFILL SCRIPT: Teacher and Event Fields');
  console.log('='.repeat(60));

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be written');
    console.log('   Run with --write flag to actually update records\n');
  } else {
    console.log('\n🔥 WRITE MODE - Changes will be written to Airtable\n');
  }

  const teacherResults = await backfillTeachers();
  const eventResults = await backfillEvents();

  console.log('\n' + '='.repeat(60));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`Teachers: ${teacherResults.updated} updated, ${teacherResults.skipped} skipped, ${teacherResults.errors} errors`);
  console.log(`Events: ${eventResults.updated} updated, ${eventResults.skipped} skipped, ${eventResults.errors} errors`);

  if (DRY_RUN) {
    console.log('\n⚠️  This was a DRY RUN. Run with --write to apply changes.');
  } else {
    console.log('\n✅ Backfill complete!');
  }
}

main().catch(console.error);
