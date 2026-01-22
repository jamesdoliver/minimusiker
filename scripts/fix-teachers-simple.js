require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const TEACHERS_TABLE_ID = 'tblLO2vXcgvNjrJ0T';
const SCHOOL_BOOKINGS_TABLE_ID = 'tblrktl5eLJEWE4M6';

// Only text fields - region is a linked record in Teachers table
const TEACHERS_FIELD_IDS = {
  school_address: 'fldY8gUK35GlE7IAz',
  school_phone: 'fld9bssBb8WJWxQYV',
};

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const base = airtable.base(process.env.AIRTABLE_BASE_ID);

async function fixTeachers() {
  console.log('Fixing Teacher records (address and phone only)...\n');
  console.log('Note: region is a linked record field and cannot be backfilled from text\n');

  const teachers = await base(TEACHERS_TABLE_ID).select().all();
  const bookings = await base(SCHOOL_BOOKINGS_TABLE_ID).select().all();

  // Create booking lookup by email
  const bookingsByEmail = new Map();
  for (const b of bookings) {
    const email = (b.get('school_contact_email') || '').toLowerCase();
    if (email) {
      bookingsByEmail.set(email, b);
    }
  }

  let updated = 0;
  for (const teacher of teachers) {
    const email = (teacher.get('email') || '').toLowerCase();
    const booking = bookingsByEmail.get(email);
    
    if (!booking) continue;

    const currentAddress = teacher.get('school_address');
    const currentPhone = teacher.get('school_phone');

    const updates = {};
    if (!currentAddress && booking.get('school_address')) {
      updates[TEACHERS_FIELD_IDS.school_address] = booking.get('school_address');
    }
    if (!currentPhone && booking.get('school_phone')) {
      updates[TEACHERS_FIELD_IDS.school_phone] = booking.get('school_phone');
    }

    if (Object.keys(updates).length > 0) {
      try {
        await base(TEACHERS_TABLE_ID).update(teacher.id, updates);
        console.log('✅ Updated:', email);
        if (updates[TEACHERS_FIELD_IDS.school_address]) console.log('   address:', updates[TEACHERS_FIELD_IDS.school_address]);
        if (updates[TEACHERS_FIELD_IDS.school_phone]) console.log('   phone:', updates[TEACHERS_FIELD_IDS.school_phone]);
        updated++;
      } catch (err) {
        console.log('❌ Error for', email, ':', err.message);
      }
    }
  }

  console.log('\nDone! Updated', updated, 'teachers');
}

fixTeachers();
