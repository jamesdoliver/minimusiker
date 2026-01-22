/**
 * Fix Single Teacher: Update teacher fields from a specific SchoolBooking
 *
 * Usage:
 *   node scripts/fix-single-teacher-from-booking.js <booking_hash>
 *   node scripts/fix-single-teacher-from-booking.js <booking_hash> --write
 */
require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');

// Table IDs
const TEACHERS_TABLE_ID = 'tblLO2vXcgvNjrJ0T';
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const SCHOOL_BOOKINGS_TABLE_ID = 'tblrktl5eLJEWE4M6';

// Field IDs for Teachers table (from src/lib/types/teacher.ts)
const TEACHERS_FIELD_IDS = {
  name: 'fld3GL8fRPSPhMw4J',
  email: 'fldkVlTMgLrLUrwlo',
  phone: 'fld68dyMBRoE2rMX4',
  school_name: 'fldPWSqdRUVxzCOly',
  simplybook_booking_id: 'fldoaHHkcyTgwaLO0',
  linked_events: 'fldJeROezAUX6zfA7',
  region: 'fldVHy77JMhWpfxKy',
  school_address: 'fldY8gUK35GlE7IAz',
  school_phone: 'fld9bssBb8WJWxQYV',
};

// Field IDs for SchoolBookings table
const SCHOOL_BOOKINGS_FIELD_IDS = {
  simplybook_hash: 'fldYVh1oa0a4Kj7gD',
  simplybook_id: 'fldHyLgKPaRQfBYVx',
  school_contact_email: 'fldv4f6768hTNZYWT',
  school_contact_name: 'fldBJeMSrVJFN3Aw1',
  school_name: 'fldOeZLFNuqHU9BAS',
  school_address: 'fld9ADLgRgjBeuLCH',
  school_phone: 'fldWWvCFJgrjScr8R',
  region: 'fldWhJSIkeC3V5Dmz',
};

// Field IDs for Events table
const EVENTS_FIELD_IDS = {
  simplybook_booking: 'fldK7vyxLd9MxgmES',
};

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const base = airtable.base(process.env.AIRTABLE_BASE_ID);

// Parse command line args
const bookingHash = process.argv[2];
const DRY_RUN = !process.argv.includes('--write');

async function main() {
  if (!bookingHash) {
    console.error('Usage: node scripts/fix-single-teacher-from-booking.js <booking_hash> [--write]');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log(`FIX TEACHER FROM BOOKING: ${bookingHash}`);
  console.log('='.repeat(60));

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be written');
    console.log('   Run with --write flag to actually update records\n');
  } else {
    console.log('\n🔥 WRITE MODE - Changes will be written to Airtable\n');
  }

  // 1. Find the SchoolBooking by hash
  console.log(`\n1. Looking up SchoolBooking with hash: ${bookingHash}`);
  const bookings = await base(SCHOOL_BOOKINGS_TABLE_ID)
    .select({
      filterByFormula: `{simplybook_hash} = "${bookingHash}"`,
      maxRecords: 1,
    })
    .firstPage();

  if (bookings.length === 0) {
    console.error(`   ❌ No booking found with hash: ${bookingHash}`);
    process.exit(1);
  }

  const booking = bookings[0];
  console.log(`   ✓ Found booking: ${booking.id}`);

  // Extract data from booking
  const bookingData = {
    email: booking.get('school_contact_email'),
    contactName: booking.get('school_contact_name'),
    schoolName: booking.get('school_name'),
    schoolAddress: booking.get('school_address'),
    schoolPhone: booking.get('school_phone'),
    region: booking.get('region'), // This is already an array of record IDs
    simplybookId: booking.get('simplybook_id'),
  };

  console.log('\n   Booking data:');
  console.log(`   - Email: ${bookingData.email}`);
  console.log(`   - Contact: ${bookingData.contactName}`);
  console.log(`   - School: ${bookingData.schoolName}`);
  console.log(`   - Address: ${bookingData.schoolAddress}`);
  console.log(`   - Phone: ${bookingData.schoolPhone}`);
  console.log(`   - Region: ${JSON.stringify(bookingData.region)}`);
  console.log(`   - SimplyBook ID: ${bookingData.simplybookId}`);

  if (!bookingData.email) {
    console.error('\n   ❌ Booking has no contact email - cannot find teacher');
    process.exit(1);
  }

  // 2. Find the Teacher by email
  console.log(`\n2. Looking up Teacher with email: ${bookingData.email}`);
  const teachers = await base(TEACHERS_TABLE_ID)
    .select({
      filterByFormula: `LOWER({email}) = LOWER("${bookingData.email.replace(/"/g, '\\"')}")`,
      maxRecords: 1,
    })
    .firstPage();

  if (teachers.length === 0) {
    console.error(`   ❌ No teacher found with email: ${bookingData.email}`);
    process.exit(1);
  }

  const teacher = teachers[0];
  console.log(`   ✓ Found teacher: ${teacher.id}`);

  // Current teacher data
  const currentData = {
    phone: teacher.get('phone'),
    schoolAddress: teacher.get('school_address'),
    schoolPhone: teacher.get('school_phone'),
    region: teacher.get('region'),
    linkedEvents: teacher.get('linked_events') || [],
    simplybookBookingId: teacher.get('simplybook_booking_id'),
  };

  console.log('\n   Current teacher data:');
  console.log(`   - Phone: ${currentData.phone || '(empty)'}`);
  console.log(`   - School Address: ${currentData.schoolAddress || '(empty)'}`);
  console.log(`   - School Phone: ${currentData.schoolPhone || '(empty)'}`);
  console.log(`   - Region: ${JSON.stringify(currentData.region) || '(empty)'}`);
  console.log(`   - Linked Events: ${currentData.linkedEvents.length} events`);
  console.log(`   - SimplyBook Booking ID: ${currentData.simplybookBookingId || '(empty)'}`);

  // 3. Find any Event linked to this booking
  console.log(`\n3. Looking up Event linked to this booking...`);
  const events = await base(EVENTS_TABLE_ID)
    .select({
      filterByFormula: `FIND("${booking.id}", ARRAYJOIN({simplybook_booking}))`,
      maxRecords: 1,
    })
    .firstPage();

  let eventRecordId = null;
  if (events.length > 0) {
    eventRecordId = events[0].id;
    console.log(`   ✓ Found linked event: ${eventRecordId}`);
  } else {
    console.log(`   ⚠️  No event linked to this booking`);
  }

  // 4. Build update object (only update empty/missing fields)
  console.log(`\n4. Building update...`);
  const updates = {};

  if (!currentData.phone && bookingData.schoolPhone) {
    updates[TEACHERS_FIELD_IDS.phone] = bookingData.schoolPhone;
    console.log(`   + phone: "${bookingData.schoolPhone}"`);
  }

  if (!currentData.schoolAddress && bookingData.schoolAddress) {
    updates[TEACHERS_FIELD_IDS.school_address] = bookingData.schoolAddress;
    console.log(`   + school_address: "${bookingData.schoolAddress}"`);
  }

  if (!currentData.schoolPhone && bookingData.schoolPhone) {
    updates[TEACHERS_FIELD_IDS.school_phone] = bookingData.schoolPhone;
    console.log(`   + school_phone: "${bookingData.schoolPhone}"`);
  }

  if ((!currentData.region || currentData.region.length === 0) && bookingData.region && bookingData.region.length > 0) {
    updates[TEACHERS_FIELD_IDS.region] = bookingData.region;
    console.log(`   + region: ${JSON.stringify(bookingData.region)}`);
  }

  if (!currentData.simplybookBookingId && bookingData.simplybookId) {
    updates[TEACHERS_FIELD_IDS.simplybook_booking_id] = bookingData.simplybookId;
    console.log(`   + simplybook_booking_id: "${bookingData.simplybookId}"`);
  }

  // Add event to linked_events if not already linked
  if (eventRecordId && !currentData.linkedEvents.includes(eventRecordId)) {
    updates[TEACHERS_FIELD_IDS.linked_events] = [...currentData.linkedEvents, eventRecordId];
    console.log(`   + linked_events: adding ${eventRecordId}`);
  }

  if (Object.keys(updates).length === 0) {
    console.log('\n   ✓ Teacher already has all data - no updates needed');
    return;
  }

  // 5. Apply update
  console.log(`\n5. Applying ${Object.keys(updates).length} field updates...`);

  if (DRY_RUN) {
    console.log('   [DRY RUN - would update teacher record]');
    console.log('\n   Run with --write flag to apply these changes');
  } else {
    try {
      await base(TEACHERS_TABLE_ID).update(teacher.id, updates);
      console.log('   ✅ Teacher updated successfully!');
    } catch (error) {
      console.error(`   ❌ Error updating teacher: ${error.message}`);
      process.exit(1);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('COMPLETE');
  console.log('='.repeat(60));
}

main().catch(console.error);
