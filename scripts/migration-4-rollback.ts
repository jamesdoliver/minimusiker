/**
 * Migration Script 4: Rollback Procedure
 *
 * Emergency rollback script to restore data in case of migration failure.
 * Deletes all records from new tables and verifies parent_journey_table integrity.
 *
 * ⚠️ USE WITH CAUTION - This will DELETE all data from new tables
 *
 * Usage: npx ts-node scripts/migration-4-rollback.ts
 */

import Airtable from 'airtable';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// Environment configuration
const AIRTABLE_PAT = process.env.AIRTABLE_PAT || process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
  console.error('❌ Missing environment variables: AIRTABLE_PAT (or AIRTABLE_API_KEY) or AIRTABLE_BASE_ID');
  process.exit(1);
}

// Initialize Airtable
const base = new Airtable({ apiKey: AIRTABLE_PAT }).base(AIRTABLE_BASE_ID);

// Table IDs
const TABLES = {
  PARENT_JOURNEY: 'tblocVr4DF001I1Ar',
  EVENTS: process.env.EVENTS_TABLE_ID || 'tblVWx1RrsGRjsNn5',
  CLASSES: process.env.CLASSES_TABLE_ID || 'tbl17SVI5gacwOP0n',
  PARENTS: process.env.PARENTS_TABLE_ID || 'tblaMYOUj93yp7jHE',
  REGISTRATIONS: process.env.REGISTRATIONS_TABLE_ID || 'tblXsmPuZcePcre5u',
};

// Rate limiting helper
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Confirm user wants to proceed
async function confirmRollback(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log('\n⚠️  WARNING: ROLLBACK PROCEDURE ⚠️\n');
    console.log('This will DELETE ALL DATA from the following tables:');
    console.log('  - Events');
    console.log('  - Classes');
    console.log('  - Parents');
    console.log('  - Registrations\n');
    console.log('Your original parent_journey_table will remain untouched.\n');

    rl.question('Are you sure you want to proceed? Type "ROLLBACK" to confirm: ', (answer) => {
      rl.close();
      resolve(answer === 'ROLLBACK');
    });
  });
}

// Count records in a table
async function countRecords(tableName: string): Promise<number> {
  let count = 0;

  await base(tableName)
    .select({ pageSize: 100 })
    .eachPage((records, fetchNextPage) => {
      count += records.length;
      fetchNextPage();
    });

  return count;
}

// Delete all records from a table
async function deleteAllRecords(tableName: string): Promise<number> {
  console.log(`🗑️  Deleting all records from ${tableName}...`);

  const recordIds: string[] = [];

  // Fetch all record IDs
  await base(tableName)
    .select({ fields: [] })
    .eachPage((records, fetchNextPage) => {
      recordIds.push(...records.map(r => r.id));
      fetchNextPage();
    });

  console.log(`   Found ${recordIds.length} records to delete`);

  if (recordIds.length === 0) {
    console.log(`   ✓ Table is already empty\n`);
    return 0;
  }

  // Delete in batches of 10
  const batchSize = 10;
  const batches: string[][] = [];

  for (let i = 0; i < recordIds.length; i += batchSize) {
    batches.push(recordIds.slice(i, i + batchSize));
  }

  let deletedCount = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    try {
      await base(tableName).destroy(batch);
      deletedCount += batch.length;
      console.log(`   ✓ Deleted ${deletedCount}/${recordIds.length} records`);

      // Rate limiting: 5 requests per second
      if (i < batches.length - 1) {
        await delay(200);
      }
    } catch (error: any) {
      console.error(`   ❌ Error deleting batch ${i + 1}:`, error.message);

      // If rate limited (429), wait and retry
      if (error.statusCode === 429) {
        console.log('   ⏳ Rate limited, waiting 30s before retry...');
        await delay(30000);
        i--; // Retry this batch
        continue;
      }

      throw error;
    }
  }

  console.log(`✅ Deleted ${deletedCount} records from ${tableName}\n`);
  return deletedCount;
}

// Verify parent_journey_table integrity
async function verifyParentJourneyTable(): Promise<{
  success: boolean;
  recordCount: number;
  errors: string[];
}> {
  console.log('🔍 Verifying parent_journey_table integrity...\n');

  const errors: string[] = [];

  // Count records
  const recordCount = await countRecords(TABLES.PARENT_JOURNEY);
  console.log(`   Found ${recordCount} records in parent_journey_table`);

  // Load extraction stats if available
  const statsPath = path.join(__dirname, '../migration-data/stats.json');
  if (fs.existsSync(statsPath)) {
    const stats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));

    if (recordCount !== stats.totalRecords) {
      errors.push(
        `Record count mismatch: expected ${stats.totalRecords}, got ${recordCount}`
      );
    } else {
      console.log(`   ✓ Record count matches pre-migration total`);
    }
  } else {
    console.log(`   ⚠️  No stats.json found - cannot verify record count`);
  }

  // Sample check: Verify 10 random records have data
  console.log('   Checking sample records...');

  const sampleRecords: any[] = [];
  await base(TABLES.PARENT_JOURNEY)
    .select({ pageSize: 10, returnFieldsByFieldId: true })
    .eachPage((records, fetchNextPage) => {
      sampleRecords.push(...records);
      fetchNextPage();
    });

  let validSamples = 0;
  for (const record of sampleRecords) {
    const fields = record.fields;
    // Check if record has at least booking_id and class_id
    if (fields['fldUB8dAiQd61VncB'] && fields['fldtiPDposZlSD2lm']) {
      validSamples++;
    }
  }

  if (validSamples < sampleRecords.length * 0.9) {
    errors.push(
      `Sample validation failed: only ${validSamples}/${sampleRecords.length} records valid`
    );
  } else {
    console.log(`   ✓ Sample records valid (${validSamples}/${sampleRecords.length})`);
  }

  console.log('');

  return {
    success: errors.length === 0,
    recordCount,
    errors,
  };
}

// Generate rollback report
function generateRollbackReport(result: {
  deletedCounts: {
    events: number;
    classes: number;
    parents: number;
    registrations: number;
  };
  verificationResult: {
    success: boolean;
    recordCount: number;
    errors: string[];
  };
}): void {
  const outputPath = path.join(__dirname, '../migration-data/rollback-report.json');

  const report = {
    timestamp: new Date().toISOString(),
    deletedRecords: result.deletedCounts,
    parentJourneyTableVerification: result.verificationResult,
    success: result.verificationResult.success,
  };

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log(`📄 Rollback report saved to: ${outputPath}\n`);
}

async function main() {
  console.log('🚀 Starting Migration Rollback Procedure\n');
  console.log('========================================\n');

  try {
    // Confirm with user
    const confirmed = await confirmRollback();

    if (!confirmed) {
      console.log('❌ Rollback cancelled by user\n');
      process.exit(0);
    }

    console.log('\n✅ User confirmed. Proceeding with rollback...\n');
    console.log('========================================\n');

    // Delete records from new tables (in reverse order of creation)
    const deletedCounts = {
      registrations: await deleteAllRecords(TABLES.REGISTRATIONS),
      parents: await deleteAllRecords(TABLES.PARENTS),
      classes: await deleteAllRecords(TABLES.CLASSES),
      events: await deleteAllRecords(TABLES.EVENTS),
    };

    console.log('========================================\n');

    // Verify parent_journey_table is intact
    const verificationResult = await verifyParentJourneyTable();

    console.log('========================================\n');

    // Print summary
    if (verificationResult.success) {
      console.log('✅ ROLLBACK SUCCESSFUL\n');
      console.log('Summary:');
      console.log(`  - Deleted ${deletedCounts.events} Events`);
      console.log(`  - Deleted ${deletedCounts.classes} Classes`);
      console.log(`  - Deleted ${deletedCounts.parents} Parents`);
      console.log(`  - Deleted ${deletedCounts.registrations} Registrations`);
      console.log(`  - Verified ${verificationResult.recordCount} records in parent_journey_table\n`);
      console.log('Your original data is intact. You can retry the migration.\n');
    } else {
      console.log('⚠️  ROLLBACK COMPLETED WITH WARNINGS\n');
      console.log('Deleted records:');
      console.log(`  - ${deletedCounts.events} Events`);
      console.log(`  - ${deletedCounts.classes} Classes`);
      console.log(`  - ${deletedCounts.parents} Parents`);
      console.log(`  - ${deletedCounts.registrations} Registrations\n`);
      console.log('❌ Verification errors:');
      verificationResult.errors.forEach(err => console.log(`  - ${err}`));
      console.log('\n⚠️  Check your parent_journey_table manually\n');
    }

    // Generate report
    generateRollbackReport({
      deletedCounts,
      verificationResult,
    });

    process.exit(verificationResult.success ? 0 : 1);

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  }
}

main();
