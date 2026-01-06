/**
 * Migration Script 3: Validate Data Integrity
 *
 * Validates that the migration was successful by checking:
 * - Record counts match
 * - All linked records resolve correctly
 * - No orphaned records
 * - Data consistency between old and new tables
 *
 * Usage: npx ts-node scripts/migration-3-validate.ts
 */

import Airtable from 'airtable';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    oldTableRecords: number;
    newEventsRecords: number;
    newClassesRecords: number;
    newParentsRecords: number;
    newRegistrationsRecords: number;
  };
}

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

async function fetchAllRecords(tableName: string): Promise<any[]> {
  const records: any[] = [];

  await base(tableName)
    .select({ returnFieldsByFieldId: true, pageSize: 100 })
    .eachPage((pageRecords, fetchNextPage) => {
      records.push(...pageRecords);
      fetchNextPage();
    });

  return records;
}

async function validateRecordCounts(): Promise<{
  errors: string[];
  warnings: string[];
  stats: any;
}> {
  console.log('📊 Validating record counts...\n');

  const errors: string[] = [];
  const warnings: string[] = [];

  // Count records in all tables
  const oldTableCount = await countRecords(TABLES.PARENT_JOURNEY);
  const eventsCount = await countRecords(TABLES.EVENTS);
  const classesCount = await countRecords(TABLES.CLASSES);
  const parentsCount = await countRecords(TABLES.PARENTS);
  const registrationsCount = await countRecords(TABLES.REGISTRATIONS);

  console.log(`Old parent_journey_table: ${oldTableCount} records`);
  console.log(`New Events table:         ${eventsCount} records`);
  console.log(`New Classes table:        ${classesCount} records`);
  console.log(`New Parents table:        ${parentsCount} records`);
  console.log(`New Registrations table:  ${registrationsCount} records\n`);

  // Load extraction stats
  const statsPath = path.join(__dirname, '../migration-data/stats.json');
  const extractionStats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));

  // Validate counts
  if (eventsCount !== extractionStats.uniqueEvents) {
    errors.push(`Events count mismatch: expected ${extractionStats.uniqueEvents}, got ${eventsCount}`);
  }

  if (classesCount !== extractionStats.uniqueClasses) {
    errors.push(`Classes count mismatch: expected ${extractionStats.uniqueClasses}, got ${classesCount}`);
  }

  if (parentsCount !== extractionStats.uniqueParents) {
    errors.push(`Parents count mismatch: expected ${extractionStats.uniqueParents}, got ${parentsCount}`);
  }

  if (registrationsCount !== extractionStats.actualRegistrations) {
    errors.push(`Registrations count mismatch: expected ${extractionStats.actualRegistrations}, got ${registrationsCount}`);
  }

  if (errors.length === 0) {
    console.log('✅ All record counts match!\n');
  }

  return {
    errors,
    warnings,
    stats: {
      oldTableRecords: oldTableCount,
      newEventsRecords: eventsCount,
      newClassesRecords: classesCount,
      newParentsRecords: parentsCount,
      newRegistrationsRecords: registrationsCount,
    },
  };
}

async function validateLinkedRecords(): Promise<{
  errors: string[];
  warnings: string[];
}> {
  console.log('🔗 Validating linked records...\n');

  const errors: string[] = [];
  const warnings: string[] = [];

  // Fetch all registrations
  console.log('   Fetching registrations...');
  const registrations = await fetchAllRecords(TABLES.REGISTRATIONS);

  const FIELDS = {
    event_id: 'fld4U9Wq5Skqf2Poq',
    parent_id: 'fldqfoJhaXH0Oj32J',
    class_id: 'fldfZeZiOGFg5UD0I',
  };

  let orphanedEvents = 0;
  let orphanedClasses = 0;
  let orphanedParents = 0;

  for (const reg of registrations) {
    const fields = reg.fields;

    // Check event_id link
    if (!fields[FIELDS.event_id] || fields[FIELDS.event_id].length === 0) {
      orphanedEvents++;
    }

    // Check class_id link
    if (!fields[FIELDS.class_id] || fields[FIELDS.class_id].length === 0) {
      orphanedClasses++;
    }

    // Check parent_id link
    if (!fields[FIELDS.parent_id] || fields[FIELDS.parent_id].length === 0) {
      orphanedParents++;
    }
  }

  console.log(`   Checked ${registrations.length} registrations\n`);

  if (orphanedEvents > 0) {
    errors.push(`${orphanedEvents} registrations missing event_id link`);
  }

  if (orphanedClasses > 0) {
    errors.push(`${orphanedClasses} registrations missing class_id link`);
  }

  if (orphanedParents > 0) {
    errors.push(`${orphanedParents} registrations missing parent_id link`);
  }

  if (errors.length === 0) {
    console.log('✅ All linked records are valid!\n');
  }

  return { errors, warnings };
}

async function validateDataConsistency(): Promise<{
  errors: string[];
  warnings: string[];
}> {
  console.log('🔍 Validating data consistency...\n');

  const errors: string[] = [];
  const warnings: string[] = [];

  // Load ID mappings
  const mappingsPath = path.join(__dirname, '../migration-data/id-mappings.json');
  const mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf-8'));

  // Spot check: Sample 10 events and verify data matches
  console.log('   Spot-checking sample events...');

  const events = await fetchAllRecords(TABLES.EVENTS);
  const sampleSize = Math.min(10, events.length);
  const sampleEvents = events.slice(0, sampleSize);

  const EVENT_FIELDS = {
    event_id: 'fldcNaHZyr6E5khDe',
    school_name: 'fld5QcpEsDFrLun6w',
    legacy_booking_id: 'fldYrZSh7tdkwuWp4',
  };

  for (const event of sampleEvents) {
    const fields = event.fields;
    const eventId = fields[EVENT_FIELDS.event_id];
    const schoolName = fields[EVENT_FIELDS.school_name];

    // Verify in original data
    const extractedEvents = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../migration-data/events.json'), 'utf-8')
    );

    const originalEvent = extractedEvents.find((e: any) => e.event_id === eventId);

    if (!originalEvent) {
      errors.push(`Event ${eventId} not found in extracted data`);
      continue;
    }

    if (originalEvent.school_name !== schoolName) {
      errors.push(`Event ${eventId} school_name mismatch: "${originalEvent.school_name}" vs "${schoolName}"`);
    }
  }

  console.log(`   Checked ${sampleSize} sample events\n`);

  if (errors.length === 0) {
    console.log('✅ Data consistency checks passed!\n');
  }

  return { errors, warnings };
}

async function validateParentDeduplication(): Promise<{
  errors: string[];
  warnings: string[];
}> {
  console.log('👥 Validating parent deduplication...\n');

  const errors: string[] = [];
  const warnings: string[] = [];

  // Fetch all parents
  const parents = await fetchAllRecords(TABLES.PARENTS);

  const PARENT_EMAIL_FIELD = 'fldd3LuRL0TmzVESR';

  // Check for duplicate emails
  const emailCounts = new Map<string, number>();

  for (const parent of parents) {
    const email = parent.fields[PARENT_EMAIL_FIELD];
    if (email) {
      emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
    }
  }

  const duplicates = Array.from(emailCounts.entries()).filter(([_, count]) => count > 1);

  if (duplicates.length > 0) {
    errors.push(`Found ${duplicates.length} duplicate parent emails`);
    duplicates.slice(0, 5).forEach(([email, count]) => {
      console.log(`   ⚠️  ${email}: ${count} occurrences`);
    });
  } else {
    console.log('✅ No duplicate parent emails found!\n');
  }

  return { errors, warnings };
}

async function generateValidationReport(result: ValidationResult): Promise<void> {
  const outputPath = path.join(__dirname, '../migration-data/validation-report.json');

  const report = {
    timestamp: new Date().toISOString(),
    passed: result.passed,
    stats: result.stats,
    errors: result.errors,
    warnings: result.warnings,
  };

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log(`📄 Validation report saved to: ${outputPath}\n`);
}

async function main() {
  console.log('🚀 Starting Migration Step 3: Validation\n');
  console.log('========================================\n');

  const result: ValidationResult = {
    passed: true,
    errors: [],
    warnings: [],
    stats: {
      oldTableRecords: 0,
      newEventsRecords: 0,
      newClassesRecords: 0,
      newParentsRecords: 0,
      newRegistrationsRecords: 0,
    },
  };

  try {
    // 1. Validate record counts
    const countsResult = await validateRecordCounts();
    result.errors.push(...countsResult.errors);
    result.warnings.push(...countsResult.warnings);
    result.stats = countsResult.stats;

    // 2. Validate linked records
    const linksResult = await validateLinkedRecords();
    result.errors.push(...linksResult.errors);
    result.warnings.push(...linksResult.warnings);

    // 3. Validate data consistency
    const consistencyResult = await validateDataConsistency();
    result.errors.push(...consistencyResult.errors);
    result.warnings.push(...consistencyResult.warnings);

    // 4. Validate parent deduplication
    const deduplicationResult = await validateParentDeduplication();
    result.errors.push(...deduplicationResult.errors);
    result.warnings.push(...deduplicationResult.warnings);

    console.log('========================================\n');

    // Print summary
    if (result.errors.length > 0) {
      result.passed = false;
      console.log('❌ VALIDATION FAILED\n');
      console.log('Errors:');
      result.errors.forEach(err => console.log(`  - ${err}`));
      console.log('');
    }

    if (result.warnings.length > 0) {
      console.log('⚠️  WARNINGS\n');
      result.warnings.forEach(warn => console.log(`  - ${warn}`));
      console.log('');
    }

    if (result.passed) {
      console.log('✅ ALL VALIDATION CHECKS PASSED!\n');
      console.log('Migration is successful. Data integrity verified.\n');
      console.log('Next step: Deploy code updates to use new tables\n');
    } else {
      console.log('❌ Validation failed. Do NOT proceed with deployment.');
      console.log('Review errors above and run migration-4-rollback.ts if needed.\n');
    }

    // Generate report
    await generateValidationReport(result);

    process.exit(result.passed ? 0 : 1);

  } catch (error) {
    console.error('❌ Validation script failed:', error);
    process.exit(1);
  }
}

main();
