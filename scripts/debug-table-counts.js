#!/usr/bin/env node
/**
 * Check the state of normalized tables vs legacy table
 */

require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const PARENTS_TABLE_ID = process.env.PARENTS_TABLE_ID;
const REGISTRATIONS_TABLE_ID = process.env.REGISTRATIONS_TABLE_ID;
const EVENTS_TABLE_ID = process.env.EVENTS_TABLE_ID;
const CLASSES_TABLE_ID = process.env.CLASSES_TABLE_ID;
const LEGACY_TABLE_NAME = 'parent_journey_table';

const REGISTRATIONS_FIELD_IDS = {
  parent_id: 'fldqfoJhaXH0Oj32J',
};

async function checkTables() {
  console.log('\n========================================');
  console.log('DATABASE STATE CHECK');
  console.log('========================================');
  console.log(`USE_NORMALIZED_TABLES = ${process.env.USE_NORMALIZED_TABLES}\n`);

  // Count records in each table
  console.log('Record counts:');

  try {
    const legacyRecords = await base(LEGACY_TABLE_NAME).select().all();
    console.log(`  Legacy parent_journey_table: ${legacyRecords.length} records`);
  } catch (e) {
    console.log(`  Legacy table: ERROR - ${e.message}`);
  }

  try {
    const parentRecords = await base(PARENTS_TABLE_ID).select().all();
    console.log(`  Normalized Parents table:    ${parentRecords.length} records`);
  } catch (e) {
    console.log(`  Parents table: ERROR - ${e.message}`);
  }

  try {
    const regRecords = await base(REGISTRATIONS_TABLE_ID).select({ returnFieldsByFieldId: true }).all();
    console.log(`  Normalized Registrations:    ${regRecords.length} records`);

    // Check how many registrations have proper parent links
    const linkedRegs = regRecords.filter(r => {
      const parentIds = r.fields[REGISTRATIONS_FIELD_IDS.parent_id];
      return parentIds && parentIds.length > 0;
    });
    const unlinkedRegs = regRecords.length - linkedRegs.length;

    console.log(`    - With parent link:        ${linkedRegs.length}`);
    console.log(`    - WITHOUT parent link:     ${unlinkedRegs} ⚠️`);
  } catch (e) {
    console.log(`  Registrations table: ERROR - ${e.message}`);
  }

  try {
    const eventRecords = await base(EVENTS_TABLE_ID).select().all();
    console.log(`  Normalized Events table:     ${eventRecords.length} records`);
  } catch (e) {
    console.log(`  Events table: ERROR - ${e.message}`);
  }

  try {
    const classRecords = await base(CLASSES_TABLE_ID).select().all();
    console.log(`  Normalized Classes table:    ${classRecords.length} records`);
  } catch (e) {
    console.log(`  Classes table: ERROR - ${e.message}`);
  }

  // Sample some parent emails
  console.log('\n----------------------------------------');
  console.log('Sample parent emails from Parents table:');
  try {
    const parents = await base(PARENTS_TABLE_ID).select({
      maxRecords: 5,
      returnFieldsByFieldId: true,
    }).firstPage();

    parents.forEach((p, i) => {
      console.log(`  [${i + 1}] ${p.fields['fldd3LuRL0TmzVESR']} (ID: ${p.id})`);
    });
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
  }

  console.log('\n----------------------------------------');
  console.log('Sample parent emails from legacy table:');
  try {
    const legacy = await base(LEGACY_TABLE_NAME).select({
      maxRecords: 5,
      returnFieldsByFieldId: true,
    }).firstPage();

    legacy.forEach((p, i) => {
      console.log(`  [${i + 1}] ${p.fields['fldwiX1CSfJZS0AIz']} - ${p.fields['fld2Rd4S9aWGOjkJI']}`);
    });
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
  }

  console.log('\n========================================\n');
}

checkTables().catch(console.error);
