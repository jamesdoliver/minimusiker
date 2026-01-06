/**
 * Migration script to backfill new teacher fields
 *
 * This script:
 * 1. Sets default region ("Default") for all existing teachers without a region
 * 2. Copies teacher phone → school_phone (if not already set)
 * 3. Leaves school_address empty (teachers will fill in on first login)
 *
 * Run with: npx dotenv-cli -e .env.local -- npx tsx scripts/migrate-teacher-data.ts
 */

import Airtable from 'airtable';
import { TEACHERS_TABLE_ID, TEACHERS_FIELD_IDS } from '../src/lib/types/teacher';

// Configure Airtable
Airtable.configure({
  apiKey: process.env.AIRTABLE_API_KEY!,
});

const base = Airtable.base(process.env.AIRTABLE_BASE_ID!);

interface TeacherMigrationData {
  id: string;
  email?: string;
  name?: string;
  phone?: string;
  region?: string;
  school_phone?: string;
  school_address?: string;
}

async function migrateTeacherData() {
  console.log('🚀 Starting Teacher Data Migration...\n');
  console.log(`Table ID: ${TEACHERS_TABLE_ID}\n`);

  try {
    // Fetch all teacher records
    const records = await base(TEACHERS_TABLE_ID)
      .select({
        pageSize: 100,
      })
      .all();

    console.log(`✅ Found ${records.length} teacher records\n`);

    if (records.length === 0) {
      console.log('⚠️  No teachers found. Nothing to migrate.');
      return;
    }

    // Analyze records
    const teachers: TeacherMigrationData[] = records.map((record) => ({
      id: record.id,
      email: record.fields[TEACHERS_FIELD_IDS.email] as string | undefined,
      name: record.fields[TEACHERS_FIELD_IDS.name] as string | undefined,
      phone: record.fields[TEACHERS_FIELD_IDS.phone] as string | undefined,
      region: record.fields[TEACHERS_FIELD_IDS.region] as string | undefined,
      school_phone: record.fields[TEACHERS_FIELD_IDS.school_phone] as string | undefined,
      school_address: record.fields[TEACHERS_FIELD_IDS.school_address] as string | undefined,
    }));

    // Find teachers needing migration
    const needsRegion = teachers.filter(t => !t.region);
    const needsSchoolPhone = teachers.filter(t => !t.school_phone && t.phone);

    console.log('📊 MIGRATION ANALYSIS:\n');
    console.log(`Teachers needing region: ${needsRegion.length}/${teachers.length}`);
    console.log(`Teachers needing school_phone: ${needsSchoolPhone.length}/${teachers.length}\n`);

    if (needsRegion.length === 0 && needsSchoolPhone.length === 0) {
      console.log('✅ All teachers already have required data. No migration needed!');
      return;
    }

    // Confirm migration
    console.log('🔄 MIGRATION PLAN:\n');
    console.log(`1. Set region = "Default" for ${needsRegion.length} teachers`);
    console.log(`2. Copy phone → school_phone for ${needsSchoolPhone.length} teachers`);
    console.log(`3. Leave school_address empty (teachers will fill in later)\n`);

    console.log('Starting migration in 2 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Perform migration
    let updateCount = 0;
    const errors: { id: string; error: string }[] = [];

    for (const teacher of teachers) {
      const updates: Record<string, string> = {};

      // Set default region if missing
      if (!teacher.region) {
        updates[TEACHERS_FIELD_IDS.region] = 'Default';
      }

      // Copy phone to school_phone if missing
      if (!teacher.school_phone && teacher.phone) {
        updates[TEACHERS_FIELD_IDS.school_phone] = teacher.phone;
      }

      // Skip if no updates needed
      if (Object.keys(updates).length === 0) {
        continue;
      }

      // Update record
      try {
        await base(TEACHERS_TABLE_ID).update(teacher.id, updates);
        updateCount++;
        console.log(`✓ Updated: ${teacher.name || teacher.email || teacher.id}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ id: teacher.id, error: errorMessage });
        console.error(`✗ Failed to update ${teacher.id}: ${errorMessage}`);
      }
    }

    // Summary
    console.log(`\n📊 MIGRATION SUMMARY:\n`);
    console.log(`✅ Successfully updated: ${updateCount} teachers`);
    if (errors.length > 0) {
      console.log(`❌ Failed updates: ${errors.length}`);
      console.log('\nErrors:');
      errors.forEach(({ id, error }) => {
        console.log(`  - ${id}: ${error}`);
      });
    }

    console.log('\n✅ Migration complete!\n');
    console.log('📝 NEXT STEPS:\n');
    console.log('1. Verify data in Airtable');
    console.log('2. Manually add bio and profile_photo fields to Personen table');
    console.log('3. Create PreparationTips table in Airtable');
    console.log('4. Run audit script to verify: npx dotenv-cli -e .env.local -- npx tsx scripts/audit-teachers.ts\n');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    process.exit(1);
  }
}

// Run the migration
migrateTeacherData();
