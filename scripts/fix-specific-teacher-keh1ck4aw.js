/**
 * Fix Script: Repair Teacher record from booking keh1ck4aw
 *
 * This script fixes the Teacher record associated with SimplyBook booking hash keh1ck4aw
 * by copying missing fields (phone, school_address, school_phone, region) from the
 * corresponding SchoolBookings record.
 *
 * Background:
 * - Bug was found in webhook route that passed region as string instead of record ID
 * - This caused Teacher records to be created without the region linked properly
 *
 * Usage:
 *   node scripts/fix-specific-teacher-keh1ck4aw.js           # Dry run (preview only)
 *   node scripts/fix-specific-teacher-keh1ck4aw.js --write   # Actually write changes
 */
require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');

// Target booking hash
const TARGET_BOOKING_HASH = 'keh1ck4aw';

// Table IDs
const TEACHERS_TABLE_ID = 'tblLO2vXcgvNjrJ0T';
const SCHOOL_BOOKINGS_TABLE_ID = 'tblrktl5eLJEWE4M6';

// Field IDs for Teachers table
const TEACHERS_FIELD_IDS = {
  email: 'fldkVlTMgLrLUrwlo',
  name: 'fld3GL8fRPSPhMw4J',
  phone: 'fld68dyMBRoE2rMX4',
  school_name: 'fldPWSqdRUVxzCOly',
  school_address: 'fldY8gUK35GlE7IAz',
  school_phone: 'fld9bssBb8WJWxQYV',
  region: 'fldVHy77JMhWpfxKy',
  simplybook_booking_id: 'fldoaHHkcyTgwaLO0',
  linked_events: 'fldJeROezAUX6zfA7',
};

// Field IDs for SchoolBookings table
const SCHOOL_BOOKINGS_FIELD_IDS = {
  simplybook_hash: 'fld6M4H1uoUExoUBJ',
  school_contact_email: 'fldv4f6768hTNZYWT',
  school_address: 'fld9ADLgRgjBeuLCH',
  school_phone: 'fldWWvCFJgrjScr8R',
  region: 'fldWhJSIkeC3V5Dmz',
  simplybook_id: 'fldHbFmUZHSaD0tZP',
};

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const base = airtable.base(process.env.AIRTABLE_BASE_ID);

// Check if we should actually write changes
const DRY_RUN = !process.argv.includes('--write');

async function main() {
  console.log('='.repeat(60));
  console.log('FIX SCRIPT: Repair Teacher from booking ' + TARGET_BOOKING_HASH);
  console.log('='.repeat(60));

  if (DRY_RUN) {
    console.log('\n--- DRY RUN MODE - No changes will be written');
    console.log('   Run with --write flag to actually update records\n');
  } else {
    console.log('\n--- WRITE MODE - Changes will be written to Airtable\n');
  }

  // Step 1: Find the SchoolBookings record by hash
  console.log(`\n1. Finding SchoolBookings record with hash: ${TARGET_BOOKING_HASH}`);

  const bookingRecords = await base(SCHOOL_BOOKINGS_TABLE_ID)
    .select({
      filterByFormula: `{simplybook_hash} = "${TARGET_BOOKING_HASH}"`,
      maxRecords: 1,
    })
    .firstPage();

  if (bookingRecords.length === 0) {
    console.error(`   ERROR: No booking found with hash ${TARGET_BOOKING_HASH}`);
    process.exit(1);
  }

  const booking = bookingRecords[0];
  console.log(`   Found booking: ${booking.id}`);

  // Get booking details
  const bookingEmail = booking.get('school_contact_email');
  const bookingAddress = booking.get('school_address');
  const bookingPhone = booking.get('school_phone');
  const bookingRegion = booking.get('region'); // This is already an array of record IDs
  const simplybookId = booking.get('simplybook_id');

  console.log(`   - Email: ${bookingEmail}`);
  console.log(`   - Address: ${bookingAddress || '(empty)'}`);
  console.log(`   - Phone: ${bookingPhone || '(empty)'}`);
  console.log(`   - Region: ${JSON.stringify(bookingRegion) || '(empty)'}`);
  console.log(`   - SimplyBook ID: ${simplybookId}`);

  // Step 2: Find the Teacher record by email
  console.log(`\n2. Finding Teacher record with email: ${bookingEmail}`);

  if (!bookingEmail) {
    console.error('   ERROR: Booking has no contact email');
    process.exit(1);
  }

  const teacherRecords = await base(TEACHERS_TABLE_ID)
    .select({
      filterByFormula: `LOWER({email}) = LOWER("${bookingEmail}")`,
      maxRecords: 1,
    })
    .firstPage();

  if (teacherRecords.length === 0) {
    console.error(`   ERROR: No teacher found with email ${bookingEmail}`);
    process.exit(1);
  }

  const teacher = teacherRecords[0];
  console.log(`   Found teacher: ${teacher.id}`);

  // Get current teacher values
  const currentEmail = teacher.get('email');
  const currentName = teacher.get('name');
  const currentPhone = teacher.get('phone');
  const currentSchoolAddress = teacher.get('school_address');
  const currentSchoolPhone = teacher.get('school_phone');
  const currentRegion = teacher.get('region');
  const currentSimplybookId = teacher.get('simplybook_booking_id');

  console.log(`\n3. Current Teacher fields:`);
  console.log(`   - email: ${currentEmail}`);
  console.log(`   - name: ${currentName}`);
  console.log(`   - phone: ${currentPhone || '(MISSING)'}`);
  console.log(`   - school_address: ${currentSchoolAddress || '(MISSING)'}`);
  console.log(`   - school_phone: ${currentSchoolPhone || '(MISSING)'}`);
  console.log(`   - region: ${JSON.stringify(currentRegion) || '(MISSING)'}`);
  console.log(`   - simplybook_booking_id: ${currentSimplybookId || '(MISSING)'}`);

  // Step 3: Build update object for missing fields
  console.log(`\n4. Determining updates needed:`);
  const updates = {};

  if (!currentPhone && bookingPhone) {
    updates[TEACHERS_FIELD_IDS.phone] = bookingPhone;
    console.log(`   - phone: will set to "${bookingPhone}"`);
  }

  if (!currentSchoolAddress && bookingAddress) {
    updates[TEACHERS_FIELD_IDS.school_address] = bookingAddress;
    console.log(`   - school_address: will set to "${bookingAddress}"`);
  }

  if (!currentSchoolPhone && bookingPhone) {
    updates[TEACHERS_FIELD_IDS.school_phone] = bookingPhone;
    console.log(`   - school_phone: will set to "${bookingPhone}"`);
  }

  if ((!currentRegion || currentRegion.length === 0) && bookingRegion && bookingRegion.length > 0) {
    updates[TEACHERS_FIELD_IDS.region] = bookingRegion;
    console.log(`   - region: will set to ${JSON.stringify(bookingRegion)}`);
  }

  if (!currentSimplybookId && simplybookId) {
    updates[TEACHERS_FIELD_IDS.simplybook_booking_id] = simplybookId;
    console.log(`   - simplybook_booking_id: will set to "${simplybookId}"`);
  }

  if (Object.keys(updates).length === 0) {
    console.log('   No updates needed - teacher already has all fields populated!');
    console.log('\n--- Complete');
    return;
  }

  // Step 4: Apply updates
  console.log(`\n5. Applying ${Object.keys(updates).length} updates...`);

  if (!DRY_RUN) {
    try {
      await base(TEACHERS_TABLE_ID).update(teacher.id, updates);
      console.log('   SUCCESS! Teacher record updated.');
    } catch (error) {
      console.error(`   ERROR: ${error.message}`);
      process.exit(1);
    }
  } else {
    console.log('   [DRY RUN - would update teacher record]');
  }

  // Step 5: Verify the fix
  if (!DRY_RUN) {
    console.log(`\n6. Verifying fix...`);
    const updatedTeacher = await base(TEACHERS_TABLE_ID).find(teacher.id);

    console.log(`   Updated Teacher fields:`);
    console.log(`   - phone: ${updatedTeacher.get('phone') || '(empty)'}`);
    console.log(`   - school_address: ${updatedTeacher.get('school_address') || '(empty)'}`);
    console.log(`   - school_phone: ${updatedTeacher.get('school_phone') || '(empty)'}`);
    console.log(`   - region: ${JSON.stringify(updatedTeacher.get('region')) || '(empty)'}`);
    console.log(`   - simplybook_booking_id: ${updatedTeacher.get('simplybook_booking_id') || '(empty)'}`);
  }

  console.log('\n' + '='.repeat(60));
  if (DRY_RUN) {
    console.log('DRY RUN complete. Run with --write to apply changes.');
  } else {
    console.log('Fix complete!');
  }
  console.log('='.repeat(60));
}

main().catch(console.error);
