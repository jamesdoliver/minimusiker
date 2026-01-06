#!/usr/bin/env node

/**
 * Verification Script: Teacher ↔ Booking Data Sync
 *
 * This script checks if teacher contact information (address, phone)
 * is synchronized between the Teachers table and School Bookings table.
 *
 * Usage:
 *   node verify-teacher-booking-sync.js <teacher-email>
 *   OR
 *   node verify-teacher-booking-sync.js --all (checks all teachers)
 *
 * Example:
 *   node verify-teacher-booking-sync.js teacher@school.de
 */

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

// Airtable configuration
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !BASE_ID) {
  console.error('❌ Error: AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set in .env file');
  process.exit(1);
}

// Table IDs
const TEACHERS_TABLE = 'tblLO2vXcgvNjrJ0T';
const SCHOOL_BOOKINGS_TABLE = 'tblrktl5eLJEWE4M6';

// Field IDs
const TEACHERS_FIELD_IDS = {
  email: 'fldMPRO18f6jW29aG',
  name: 'fldnNsPLqtHuZIAHa',
  school_name: 'fldpEkXKPwOlvnHQE',
  school_address: 'fldqgWvA2d5MIPEGG',
  school_phone: 'fld3j7KHxvBd7VqUO',
};

const SCHOOL_BOOKINGS_FIELD_IDS = {
  school_contact_email: 'fldv4f6768hTNZYWT',
  school_phone: 'fldWWvCFJgrjScr8R',
  school_address: 'fld9ADLgRgjBeuLCH',
  school_contact_name: 'fldlRful9AwfzUrOc',
  simplybook_id: 'fldb5FI6ij00eICaT',
  start_date: 'fldbCBy0CxsivACiZ',
};

// Initialize Airtable
Airtable.configure({ apiKey: AIRTABLE_API_KEY });
const base = Airtable.base(BASE_ID);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Get teacher by email
 */
async function getTeacher(email) {
  try {
    const records = await base(TEACHERS_TABLE)
      .select({
        filterByFormula: `LOWER({${TEACHERS_FIELD_IDS.email}}) = LOWER('${email.replace(/'/g, "\\'")}')`,
        maxRecords: 1,
      })
      .all();

    if (records.length === 0) {
      return null;
    }

    const record = records[0];
    return {
      id: record.id,
      email: record.fields[TEACHERS_FIELD_IDS.email],
      name: record.fields[TEACHERS_FIELD_IDS.name],
      schoolName: record.fields[TEACHERS_FIELD_IDS.school_name],
      schoolAddress: record.fields[TEACHERS_FIELD_IDS.school_address],
      schoolPhone: record.fields[TEACHERS_FIELD_IDS.school_phone],
    };
  } catch (error) {
    console.error(`Error fetching teacher:`, error.message);
    throw error;
  }
}

/**
 * Get all bookings for a teacher's email
 */
async function getBookingsForTeacher(email) {
  try {
    const records = await base(SCHOOL_BOOKINGS_TABLE)
      .select({
        filterByFormula: `LOWER({${SCHOOL_BOOKINGS_FIELD_IDS.school_contact_email}}) = LOWER('${email.replace(/'/g, "\\'")}')`,
      })
      .all();

    return records.map(record => ({
      id: record.id,
      simplybookId: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.simplybook_id],
      contactEmail: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_contact_email],
      contactName: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_contact_name],
      address: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_address],
      phone: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_phone],
      startDate: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.start_date],
    }));
  } catch (error) {
    console.error(`Error fetching bookings:`, error.message);
    throw error;
  }
}

/**
 * Compare teacher data with booking data
 */
function compareData(teacher, bookings) {
  const results = {
    teacherEmail: teacher.email,
    teacherName: teacher.name,
    teacherData: {
      address: teacher.schoolAddress || '(not set)',
      phone: teacher.schoolPhone || '(not set)',
    },
    bookingsCount: bookings.length,
    syncIssues: [],
    inSync: true,
  };

  if (bookings.length === 0) {
    results.inSync = true; // No bookings = nothing to sync
    results.note = 'No bookings found for this teacher';
    return results;
  }

  // Check each booking
  bookings.forEach((booking, index) => {
    const addressMatch = (teacher.schoolAddress || '') === (booking.address || '');
    const phoneMatch = (teacher.schoolPhone || '') === (booking.phone || '');

    if (!addressMatch || !phoneMatch) {
      results.inSync = false;
      results.syncIssues.push({
        bookingId: booking.simplybookId || booking.id,
        startDate: booking.startDate,
        addressMatch,
        phoneMatch,
        bookingData: {
          address: booking.address || '(not set)',
          phone: booking.phone || '(not set)',
        },
      });
    }
  });

  return results;
}

/**
 * Print results in a nice format
 */
function printResults(results) {
  console.log('\n' + '='.repeat(80));
  console.log(`${colors.bright}Teacher:${colors.reset} ${results.teacherName} (${results.teacherEmail})`);
  console.log('='.repeat(80));

  console.log(`\n${colors.cyan}Teachers Table:${colors.reset}`);
  console.log(`  Address: ${results.teacherData.address}`);
  console.log(`  Phone:   ${results.teacherData.phone}`);

  console.log(`\n${colors.cyan}Bookings Found:${colors.reset} ${results.bookingsCount}`);

  if (results.note) {
    console.log(`\n${colors.yellow}ℹ ${results.note}${colors.reset}`);
  }

  if (results.inSync) {
    console.log(`\n${colors.green}✅ ALL DATA IN SYNC!${colors.reset}`);
    console.log(`   Teacher data matches all ${results.bookingsCount} booking(s)`);
  } else {
    console.log(`\n${colors.red}❌ SYNC ISSUES FOUND!${colors.reset}`);
    console.log(`   ${results.syncIssues.length} of ${results.bookingsCount} booking(s) have mismatched data\n`);

    results.syncIssues.forEach((issue, index) => {
      console.log(`${colors.yellow}Issue ${index + 1}:${colors.reset} Booking ${issue.bookingId} (${issue.startDate || 'no date'})`);

      if (!issue.addressMatch) {
        console.log(`  ${colors.red}✗ Address mismatch:${colors.reset}`);
        console.log(`    Teacher:  ${results.teacherData.address}`);
        console.log(`    Booking:  ${issue.bookingData.address}`);
      }

      if (!issue.phoneMatch) {
        console.log(`  ${colors.red}✗ Phone mismatch:${colors.reset}`);
        console.log(`    Teacher:  ${results.teacherData.phone}`);
        console.log(`    Booking:  ${issue.bookingData.phone}`);
      }

      console.log('');
    });
  }

  console.log('='.repeat(80) + '\n');
}

/**
 * Get all teachers with bookings
 */
async function getAllTeachersWithBookings() {
  try {
    console.log(`${colors.cyan}Fetching all bookings...${colors.reset}`);
    const allBookings = await base(SCHOOL_BOOKINGS_TABLE)
      .select({
        fields: [SCHOOL_BOOKINGS_FIELD_IDS.school_contact_email],
      })
      .all();

    // Get unique emails
    const emails = new Set();
    allBookings.forEach(record => {
      const email = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_contact_email];
      if (email) {
        emails.add(email.toLowerCase());
      }
    });

    console.log(`${colors.cyan}Found ${emails.size} unique teacher email(s) in bookings${colors.reset}\n`);
    return Array.from(emails);
  } catch (error) {
    console.error('Error fetching all teachers:', error.message);
    throw error;
  }
}

/**
 * Main verification function
 */
async function verifySync(teacherEmail) {
  console.log(`${colors.bright}Checking sync for: ${teacherEmail}${colors.reset}`);

  // Get teacher data
  const teacher = await getTeacher(teacherEmail);
  if (!teacher) {
    console.log(`${colors.red}❌ Teacher not found in Teachers table: ${teacherEmail}${colors.reset}\n`);
    return { inSync: false, teacherEmail };
  }

  // Get bookings
  const bookings = await getBookingsForTeacher(teacherEmail);

  // Compare
  const results = compareData(teacher, bookings);
  printResults(results);

  return results;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`${colors.red}Error: Missing teacher email${colors.reset}\n`);
    console.log('Usage:');
    console.log('  node verify-teacher-booking-sync.js <teacher-email>');
    console.log('  node verify-teacher-booking-sync.js --all\n');
    console.log('Examples:');
    console.log('  node verify-teacher-booking-sync.js teacher@school.de');
    console.log('  node verify-teacher-booking-sync.js --all');
    process.exit(1);
  }

  try {
    if (args[0] === '--all') {
      // Check all teachers
      console.log(`${colors.bright}${colors.blue}Verifying ALL teachers with bookings...${colors.reset}\n`);

      const emails = await getAllTeachersWithBookings();
      const allResults = [];

      for (const email of emails) {
        const result = await verifySync(email);
        allResults.push(result);
      }

      // Summary
      const inSyncCount = allResults.filter(r => r.inSync).length;
      const outOfSyncCount = allResults.length - inSyncCount;

      console.log('\n' + '='.repeat(80));
      console.log(`${colors.bright}SUMMARY${colors.reset}`);
      console.log('='.repeat(80));
      console.log(`Total teachers checked: ${allResults.length}`);
      console.log(`${colors.green}✅ In sync: ${inSyncCount}${colors.reset}`);
      console.log(`${colors.red}❌ Out of sync: ${outOfSyncCount}${colors.reset}`);
      console.log('='.repeat(80) + '\n');

      if (outOfSyncCount > 0) {
        process.exit(1);
      }
    } else {
      // Check single teacher
      const teacherEmail = args[0];
      const result = await verifySync(teacherEmail);

      if (!result.inSync) {
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(`\n${colors.red}Fatal error:${colors.reset}`, error.message);
    process.exit(1);
  }
}

// Run the script
main();
