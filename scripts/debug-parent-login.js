#!/usr/bin/env node
/**
 * Debug script to investigate parent login issues
 *
 * This script checks:
 * 1. If parent exists in Parents table
 * 2. If registrations exist in Registrations table
 * 3. If registrations are properly linked to parents
 * 4. Compares with legacy parent_journey_table
 */

require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Table IDs from environment
const PARENTS_TABLE_ID = process.env.PARENTS_TABLE_ID;
const REGISTRATIONS_TABLE_ID = process.env.REGISTRATIONS_TABLE_ID;
const EVENTS_TABLE_ID = process.env.EVENTS_TABLE_ID;
const LEGACY_TABLE_NAME = 'parent_journey_table';

// Field IDs (from types/airtable.ts)
const PARENTS_FIELD_IDS = {
  parent_email: 'fldd3LuRL0TmzVESR',
  parent_first_name: 'fldtaXHWE5RP0nrw5',
  parent_id: 'fldnnzCB0aesXJdxu',
};

const REGISTRATIONS_FIELD_IDS = {
  parent_id: 'fldqfoJhaXH0Oj32J',       // Linked record → Parents
  event_id: 'fld4U9Wq5Skqf2Poq',        // Linked record → Events
  registered_child: 'fldkdMkuuJ21sIjOQ',
};

const LEGACY_FIELD_IDS = {
  parent_email: 'fldwiX1CSfJZS0AIz',
  parent_first_name: 'fldTeWfHG1TQJbzgr',
  booking_id: 'fldUB8dAiQd61VncB',
  school_name: 'fld2Rd4S9aWGOjkJI',
};

async function debugParentLogin(email) {
  console.log('\n========================================');
  console.log(`Debugging login for: ${email}`);
  console.log('========================================\n');

  const normalizedEmail = email.toLowerCase().trim();

  // Step 1: Check normalized Parents table
  console.log('1. Checking normalized PARENTS table...');
  try {
    const parentRecords = await base(PARENTS_TABLE_ID).select({
      filterByFormula: `LOWER({${PARENTS_FIELD_IDS.parent_email}}) = LOWER('${normalizedEmail}')`,
      maxRecords: 10,
      returnFieldsByFieldId: true,
    }).firstPage();

    if (parentRecords.length === 0) {
      console.log('   ❌ NO parent found in Parents table');
    } else {
      console.log(`   ✅ Found ${parentRecords.length} parent record(s):`);
      parentRecords.forEach((record, i) => {
        console.log(`      [${i + 1}] Record ID: ${record.id}`);
        console.log(`          Email: ${record.fields[PARENTS_FIELD_IDS.parent_email]}`);
        console.log(`          Name: ${record.fields[PARENTS_FIELD_IDS.parent_first_name]}`);
        console.log(`          Parent ID: ${record.fields[PARENTS_FIELD_IDS.parent_id]}`);
      });

      // Step 2: Check registrations for this parent
      console.log('\n2. Checking REGISTRATIONS table for this parent...');

      const parentRecordId = parentRecords[0].id;
      console.log(`   Looking for registrations linked to parent record: ${parentRecordId}`);

      // Fetch all registrations (same as the code does)
      const allRegistrations = await base(REGISTRATIONS_TABLE_ID).select({
        returnFieldsByFieldId: true,
      }).all();

      console.log(`   Total registrations in table: ${allRegistrations.length}`);

      // Filter by parent ID (same logic as queryRegistrationsByParent)
      const linkedRegistrations = allRegistrations.filter(reg => {
        const parentIds = reg.fields[REGISTRATIONS_FIELD_IDS.parent_id];
        return parentIds && Array.isArray(parentIds) && parentIds.includes(parentRecordId);
      });

      if (linkedRegistrations.length === 0) {
        console.log('   ❌ NO registrations found linked to this parent');

        // Check if any registrations have this parent's email somehow
        console.log('\n   Checking for orphaned registrations...');

        // Look for registrations with no parent link
        const orphanedRegs = allRegistrations.filter(reg => {
          const parentIds = reg.fields[REGISTRATIONS_FIELD_IDS.parent_id];
          return !parentIds || parentIds.length === 0;
        });
        console.log(`   Found ${orphanedRegs.length} registrations with NO parent link`);

        if (orphanedRegs.length > 0 && orphanedRegs.length <= 10) {
          console.log('   Orphaned registrations:');
          orphanedRegs.forEach((reg, i) => {
            console.log(`      [${i + 1}] ID: ${reg.id}, Child: ${reg.fields[REGISTRATIONS_FIELD_IDS.registered_child]}`);
          });
        }
      } else {
        console.log(`   ✅ Found ${linkedRegistrations.length} registration(s):`);
        linkedRegistrations.forEach((reg, i) => {
          console.log(`      [${i + 1}] Record ID: ${reg.id}`);
          console.log(`          Child: ${reg.fields[REGISTRATIONS_FIELD_IDS.registered_child]}`);
          console.log(`          Event Link: ${reg.fields[REGISTRATIONS_FIELD_IDS.event_id]}`);
          console.log(`          Parent Link: ${reg.fields[REGISTRATIONS_FIELD_IDS.parent_id]}`);
        });
      }
    }
  } catch (error) {
    console.log(`   ❌ Error querying Parents table: ${error.message}`);
  }

  // Step 3: Check legacy parent_journey_table
  console.log('\n3. Checking LEGACY parent_journey_table...');
  try {
    const legacyRecords = await base(LEGACY_TABLE_NAME).select({
      filterByFormula: `LOWER({${LEGACY_FIELD_IDS.parent_email}}) = LOWER('${normalizedEmail}')`,
      maxRecords: 10,
      returnFieldsByFieldId: true,
    }).firstPage();

    if (legacyRecords.length === 0) {
      console.log('   ❌ NO records found in legacy table');
    } else {
      console.log(`   ✅ Found ${legacyRecords.length} record(s) in legacy table:`);
      legacyRecords.forEach((record, i) => {
        console.log(`      [${i + 1}] Record ID: ${record.id}`);
        console.log(`          Email: ${record.fields[LEGACY_FIELD_IDS.parent_email]}`);
        console.log(`          Name: ${record.fields[LEGACY_FIELD_IDS.parent_first_name]}`);
        console.log(`          School: ${record.fields[LEGACY_FIELD_IDS.school_name]}`);
        console.log(`          Booking ID: ${record.fields[LEGACY_FIELD_IDS.booking_id]}`);
      });
    }
  } catch (error) {
    console.log(`   ❌ Error querying legacy table: ${error.message}`);
  }

  // Step 4: Summary
  console.log('\n========================================');
  console.log('DIAGNOSIS:');
  console.log('========================================');
  console.log(`USE_NORMALIZED_TABLES = ${process.env.USE_NORMALIZED_TABLES}`);
  console.log('\nIf parent exists in Parents table but has no linked registrations,');
  console.log('the login will fail with 404 (redirect to /register).');
  console.log('\nTo fix: Registrations need to have their parent_id linked record');
  console.log('field properly set to point to the parent record.\n');
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.log('Usage: node scripts/debug-parent-login.js <email>');
  console.log('Example: node scripts/debug-parent-login.js parent@example.com');
  process.exit(1);
}

debugParentLogin(email).catch(console.error);
