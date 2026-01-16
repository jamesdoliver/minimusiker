/**
 * Migration: Convert SchoolBookings.region from text to linked record
 *
 * This script helps migrate existing SchoolBookings records after the region
 * field is converted from a text field to a linked record field (Teams/Regionen).
 *
 * Prerequisites:
 * 1. Export current region text values from SchoolBookings (backup) BEFORE changing field type
 * 2. Change field type in Airtable UI from text to linked record
 * 3. Run this script to populate the linked records
 *
 * Usage:
 *   node scripts/migrate-region-to-linked.js --dry-run    # Preview changes
 *   node scripts/migrate-region-to-linked.js              # Execute migration
 *
 * Environment variables required:
 *   AIRTABLE_API_KEY
 *   AIRTABLE_BASE_ID
 */

require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');

const SCHOOL_BOOKINGS_TABLE_ID = 'tblrktl5eLJEWE4M6';
const TEAMS_REGIONEN_TABLE_ID = 'tblQm2nyPKU7k2N2N';

// Field ID for region in SchoolBookings
const REGION_FIELD_ID = 'fldWhJSIkeC3V5Dmz';

const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

async function buildRegionMap() {
  console.log('Building Teams/Regionen name -> ID map...');
  const regionMap = new Map();

  const records = await airtable
    .table(TEAMS_REGIONEN_TABLE_ID)
    .select({
      fields: ['Name'],
    })
    .all();

  for (const record of records) {
    const name = record.get('Name');
    if (name) {
      // Store both exact and lowercase for flexible matching
      regionMap.set(name, record.id);
      regionMap.set(name.toLowerCase(), record.id);
    }
  }

  console.log(`Found ${records.length} regions in Teams/Regionen table`);
  return regionMap;
}

async function getBookingsNeedingMigration() {
  console.log('Fetching SchoolBookings with empty region linked field...');

  // Fetch all bookings - we'll check which ones need migration
  const records = await airtable
    .table(SCHOOL_BOOKINGS_TABLE_ID)
    .select({
      fields: [REGION_FIELD_ID, 'School Name'],
    })
    .all();

  // Filter to records where region is empty (no linked records)
  const needsMigration = records.filter((record) => {
    const region = record.get(REGION_FIELD_ID);
    // If it's an array with records, it's already migrated
    // If it's empty array, undefined, or text string, it needs migration
    return !region || (Array.isArray(region) && region.length === 0);
  });

  console.log(
    `Found ${needsMigration.length} bookings needing region migration (out of ${records.length} total)`
  );
  return needsMigration;
}

async function migrateBookings(dryRun = false) {
  const regionMap = await buildRegionMap();
  const bookings = await getBookingsNeedingMigration();

  if (bookings.length === 0) {
    console.log('No bookings need migration.');
    return;
  }

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Processing ${bookings.length} bookings...\n`);

  const results = {
    updated: 0,
    skipped: 0,
    noMatch: [],
  };

  for (const booking of bookings) {
    const schoolName = booking.get('School Name') || 'Unknown';

    // NOTE: Since we can't read the old text value after field type change,
    // this migration would need to be done BEFORE changing the field type,
    // or you'd need to have exported the region text values to a separate field.
    //
    // For now, this script serves as a template. You may need to:
    // 1. Create a backup text field with the region names before conversion
    // 2. Or manually update bookings based on school location/Einrichtung data

    console.log(`  ${schoolName}: No source region data available (field was converted)`);
    results.skipped++;
  }

  console.log('\n--- Migration Summary ---');
  console.log(`Updated: ${results.updated}`);
  console.log(`Skipped (no source data): ${results.skipped}`);

  if (results.noMatch.length > 0) {
    console.log(`\nRegions not found in Teams/Regionen table:`);
    for (const region of [...new Set(results.noMatch)]) {
      console.log(`  - "${region}"`);
    }
  }
}

// Alternative: Migrate based on linked Einrichtung's team_region
async function migrateFromEinrichtung(dryRun = false) {
  console.log('\n=== Migration via Einrichtung (School) Data ===\n');

  const regionMap = await buildRegionMap();

  // Fetch bookings with their linked Einrichtung
  const bookings = await airtable
    .table(SCHOOL_BOOKINGS_TABLE_ID)
    .select({
      fields: [REGION_FIELD_ID, 'School Name', 'fldtGjQmGQPQbISgy'], // einrichtung field
    })
    .all();

  const needsMigration = bookings.filter((record) => {
    const region = record.get(REGION_FIELD_ID);
    return !region || (Array.isArray(region) && region.length === 0);
  });

  console.log(`Found ${needsMigration.length} bookings to process`);

  const results = {
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const booking of needsMigration) {
    const schoolName = booking.get('School Name') || 'Unknown';
    const einrichtungIds = booking.get('fldtGjQmGQPQbISgy'); // Linked Einrichtung

    if (!einrichtungIds || einrichtungIds.length === 0) {
      console.log(`  ${schoolName}: No linked Einrichtung, skipping`);
      results.skipped++;
      continue;
    }

    try {
      // Fetch the Einrichtung to get its team_region
      const einrichtung = await airtable
        .table('tblLPUjLnHZ0Y4mdB')
        .find(einrichtungIds[0]);

      const teamRegion = einrichtung.get('fldcWyWhkriPVjKBy'); // team_region field

      if (!teamRegion || teamRegion.length === 0) {
        console.log(`  ${schoolName}: Einrichtung has no team_region, skipping`);
        results.skipped++;
        continue;
      }

      // The team_region is already a linked record, so we can copy it
      if (!dryRun) {
        await airtable.table(SCHOOL_BOOKINGS_TABLE_ID).update(booking.id, {
          [REGION_FIELD_ID]: teamRegion, // Copy the linked record IDs
        });
      }

      console.log(`  ${schoolName}: ${dryRun ? 'Would update' : 'Updated'} with region from Einrichtung`);
      results.updated++;
    } catch (error) {
      console.error(`  ${schoolName}: Error - ${error.message}`);
      results.errors.push({ schoolName, error: error.message });
    }
  }

  console.log('\n--- Migration Summary ---');
  console.log(`Updated: ${results.updated}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Errors: ${results.errors.length}`);
}

// Main
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const useEinrichtung = args.includes('--from-einrichtung');

console.log('=== SchoolBookings Region Migration ===\n');
console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
console.log(`Strategy: ${useEinrichtung ? 'Copy from Einrichtung team_region' : 'Direct text-to-linked'}\n`);

if (useEinrichtung) {
  migrateFromEinrichtung(dryRun).catch(console.error);
} else {
  migrateBookings(dryRun).catch(console.error);
}
