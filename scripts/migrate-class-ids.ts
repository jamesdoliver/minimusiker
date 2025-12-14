/**
 * Migration Script: Generate class_ids for existing Airtable records
 *
 * This script:
 * 1. Fetches all records from parent_journey_table
 * 2. Groups them by school_name + booking_date + class
 * 3. Generates a unique class_id for each group
 * 4. Updates all records in each group with the generated class_id
 *
 * Usage:
 *   npx ts-node scripts/migrate-class-ids.ts
 *
 * Options:
 *   --dry-run  : Show what would be updated without making changes
 *   --verbose  : Show detailed progress information
 */

import airtableService from '../src/lib/services/airtableService';
import { generateClassId } from '../src/lib/utils/eventIdentifiers';

interface MigrationStats {
  totalRecords: number;
  recordsWithClassId: number;
  recordsWithoutClassId: number;
  uniqueClasses: number;
  recordsUpdated: number;
  errors: number;
}

interface ClassGroup {
  schoolName: string;
  bookingDate: string;
  className: string;
  classId: string;
  recordIds: string[];
}

async function migrateClassIds(dryRun: boolean = false, verbose: boolean = false) {
  const stats: MigrationStats = {
    totalRecords: 0,
    recordsWithClassId: 0,
    recordsWithoutClassId: 0,
    uniqueClasses: 0,
    recordsUpdated: 0,
    errors: 0,
  };

  console.log('\n=== MiniMusiker Class ID Migration ===\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE UPDATE'}`);
  console.log(`Verbose: ${verbose ? 'ON' : 'OFF'}\n`);

  try {
    // Step 1: Fetch all records
    console.log('Step 1: Fetching all records from Airtable...');
    const allRecords = await airtableService.query({
      sort: [{ field: 'school_name', direction: 'asc' }],
    });

    stats.totalRecords = allRecords.length;
    console.log(`✓ Found ${stats.totalRecords} total records\n`);

    // Step 2: Analyze existing class_ids
    console.log('Step 2: Analyzing existing class_id data...');
    const recordsWithClassId = allRecords.filter((r) => r.class_id);
    const recordsWithoutClassId = allRecords.filter((r) => !r.class_id);

    stats.recordsWithClassId = recordsWithClassId.length;
    stats.recordsWithoutClassId = recordsWithoutClassId.length;

    console.log(`  - Records with class_id: ${stats.recordsWithClassId}`);
    console.log(`  - Records without class_id: ${stats.recordsWithoutClassId}\n`);

    if (stats.recordsWithoutClassId === 0) {
      console.log('✓ All records already have class_ids. Nothing to migrate.');
      return stats;
    }

    // Step 3: Group records by school + date + class
    console.log('Step 3: Grouping records by school + date + class...');
    const classGroups = new Map<string, ClassGroup>();

    for (const record of recordsWithoutClassId) {
      if (!record.school_name || !record.booking_date || !record.class) {
        if (verbose) {
          console.log(
            `  ⚠ Skipping record ${record.id}: Missing school_name, booking_date, or class`
          );
        }
        continue;
      }

      // Create unique key for grouping
      const key = `${record.school_name}|${record.booking_date}|${record.class}`;

      if (!classGroups.has(key)) {
        // Generate class_id for this group
        const classId = generateClassId(
          record.school_name,
          record.booking_date,
          record.class
        );

        classGroups.set(key, {
          schoolName: record.school_name,
          bookingDate: record.booking_date,
          className: record.class,
          classId: classId,
          recordIds: [],
        });

        if (verbose) {
          console.log(
            `  + Created group: ${record.school_name} / ${record.class} / ${record.booking_date}`
          );
          console.log(`    Class ID: ${classId}`);
        }
      }

      classGroups.get(key)!.recordIds.push(record.id);
    }

    stats.uniqueClasses = classGroups.size;
    console.log(`✓ Identified ${stats.uniqueClasses} unique classes\n`);

    // Step 4: Update records with class_ids
    console.log(
      `Step 4: ${dryRun ? 'Simulating updates' : 'Updating records with class_ids'}...`
    );

    let groupIndex = 0;
    for (const [key, group] of classGroups) {
      groupIndex++;
      console.log(
        `  [${groupIndex}/${stats.uniqueClasses}] ${group.schoolName} / ${group.className} / ${group.bookingDate}`
      );
      console.log(`    Class ID: ${group.classId}`);
      console.log(`    Records to update: ${group.recordIds.length}`);

      if (!dryRun) {
        try {
          await airtableService.updateClassIdForRecords(
            group.recordIds,
            group.classId
          );
          stats.recordsUpdated += group.recordIds.length;
          console.log(`    ✓ Updated successfully`);
        } catch (error) {
          stats.errors++;
          console.error(`    ✗ Error updating: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else {
        stats.recordsUpdated += group.recordIds.length;
        console.log(`    ✓ Would update (dry run)`);
      }
    }

    console.log('\n=== Migration Summary ===\n');
    console.log(`Total records processed: ${stats.totalRecords}`);
    console.log(`Records already with class_id: ${stats.recordsWithClassId}`);
    console.log(`Records needing class_id: ${stats.recordsWithoutClassId}`);
    console.log(`Unique classes identified: ${stats.uniqueClasses}`);
    console.log(
      `Records ${dryRun ? 'that would be' : ''} updated: ${stats.recordsUpdated}`
    );
    if (stats.errors > 0) {
      console.log(`Errors encountered: ${stats.errors}`);
    }
    console.log('\n✓ Migration complete!\n');

    return stats;
  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');

// Run migration
migrateClassIds(dryRun, verbose)
  .then((stats) => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
