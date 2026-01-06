/**
 * Script to audit existing teachers in Airtable
 *
 * This script:
 * 1. Fetches all teachers from Airtable
 * 2. Analyzes what data they have
 * 3. Identifies missing data that needs to be backfilled for the portal revamp
 *
 * Run with: npx tsx scripts/audit-teachers.ts
 */

import Airtable from 'airtable';
import { TEACHERS_TABLE_ID, TEACHERS_FIELD_IDS } from '../src/lib/types/teacher';

// Configure Airtable
Airtable.configure({
  apiKey: process.env.AIRTABLE_API_KEY!,
});

const base = Airtable.base(process.env.AIRTABLE_BASE_ID!);

interface TeacherAuditData {
  id: string;
  email?: string;
  name?: string;
  school_name?: string;
  phone?: string;
  simplybook_booking_id?: string;
  // New fields we're checking for
  region?: string;
  school_address?: string;
  school_email?: string;
  school_phone?: string;
}

async function auditTeachers() {
  console.log('🔍 Auditing Teachers table...\n');
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
      console.log('⚠️  No teachers found in the table.');
      return;
    }

    // Analyze the data
    const teachers: TeacherAuditData[] = records.map((record) => ({
      id: record.id,
      email: record.fields.email || record.fields[TEACHERS_FIELD_IDS.email],
      name: record.fields.name || record.fields[TEACHERS_FIELD_IDS.name],
      school_name: record.fields.school_name || record.fields[TEACHERS_FIELD_IDS.school_name],
      phone: record.fields.phone || record.fields[TEACHERS_FIELD_IDS.phone],
      simplybook_booking_id: record.fields.simplybook_booking_id || record.fields[TEACHERS_FIELD_IDS.simplybook_booking_id],
      // New fields (will be undefined if not present)
      region: record.fields.region,
      school_address: record.fields.school_address,
      school_email: record.fields.school_email,
      school_phone: record.fields.school_phone,
    }));

    // Statistics
    const stats = {
      total: teachers.length,
      withEmail: teachers.filter(t => t.email).length,
      withName: teachers.filter(t => t.name).length,
      withSchoolName: teachers.filter(t => t.school_name).length,
      withPhone: teachers.filter(t => t.phone).length,
      withRegion: teachers.filter(t => t.region).length,
      withSchoolAddress: teachers.filter(t => t.school_address).length,
      withSchoolEmail: teachers.filter(t => t.school_email).length,
      withSchoolPhone: teachers.filter(t => t.school_phone).length,
    };

    // Print statistics
    console.log('📊 DATA COMPLETENESS:\n');
    console.log(`Total Teachers: ${stats.total}`);
    console.log(`\nExisting Fields:`);
    console.log(`  ✓ Email:        ${stats.withEmail}/${stats.total} (${Math.round((stats.withEmail / stats.total) * 100)}%)`);
    console.log(`  ✓ Name:         ${stats.withName}/${stats.total} (${Math.round((stats.withName / stats.total) * 100)}%)`);
    console.log(`  ✓ School Name:  ${stats.withSchoolName}/${stats.total} (${Math.round((stats.withSchoolName / stats.total) * 100)}%)`);
    console.log(`  ✓ Phone:        ${stats.withPhone}/${stats.total} (${Math.round((stats.withPhone / stats.total) * 100)}%)`);

    console.log(`\n📍 NEW FIELDS (needed for portal revamp):`);
    console.log(`  ${stats.withRegion > 0 ? '✓' : '✗'} Region:          ${stats.withRegion}/${stats.total} ${stats.withRegion === 0 ? '⚠️  MISSING - needs backfill' : ''}`);
    console.log(`  ${stats.withSchoolAddress > 0 ? '✓' : '✗'} School Address:  ${stats.withSchoolAddress}/${stats.total} ${stats.withSchoolAddress === 0 ? '⚠️  MISSING - needs backfill' : ''}`);
    console.log(`  ${stats.withSchoolEmail > 0 ? '✓' : '✗'} School Email:    ${stats.withSchoolEmail}/${stats.total} ${stats.withSchoolEmail === 0 ? '⚠️  MISSING - can default to teacher email' : ''}`);
    console.log(`  ${stats.withSchoolPhone > 0 ? '✓' : '✗'} School Phone:    ${stats.withSchoolPhone}/${stats.total} ${stats.withSchoolPhone === 0 ? '⚠️  MISSING - can default to teacher phone' : ''}`);

    // Sample teachers
    console.log(`\n📋 SAMPLE TEACHERS (first 5):\n`);
    teachers.slice(0, 5).forEach((teacher, index) => {
      console.log(`${index + 1}. ${teacher.name || 'Unnamed'} (${teacher.email || 'No email'})`);
      console.log(`   School: ${teacher.school_name || 'Unknown'}`);
      console.log(`   Phone: ${teacher.phone || 'Not set'}`);
      console.log(`   Region: ${teacher.region || '❌ NOT SET'}`);
      console.log(`   School Address: ${teacher.school_address || '❌ NOT SET'}`);
      console.log(``);
    });

    // Recommendations
    console.log(`\n💡 RECOMMENDATIONS:\n`);

    if (stats.withRegion === 0) {
      console.log(`1. ⚠️  CRITICAL: Add 'region' field to Teachers table`);
      console.log(`   - Backfill region data for all ${stats.total} teachers`);
      console.log(`   - Can extract from school address/postal code if available`);
      console.log(`   - Or set default "Default" region for now`);
    }

    if (stats.withSchoolAddress === 0) {
      console.log(`\n2. ⚠️  Add 'school_address' field to Teachers table`);
      console.log(`   - Can query SchoolBookings or Einrichtungen tables for address`);
      console.log(`   - Or leave empty and prompt teachers to fill in on first login`);
    }

    if (stats.withSchoolEmail === 0) {
      console.log(`\n3. Add 'school_email' field to Teachers table`);
      console.log(`   - Can default to teacher's personal email initially`);
      console.log(`   - Teachers can update later`);
    }

    if (stats.withSchoolPhone === 0) {
      console.log(`\n4. Add 'school_phone' field to Teachers table`);
      console.log(`   - Can default to teacher's personal phone initially`);
      console.log(`   - Teachers can update later`);
    }

    console.log(`\n✅ Audit complete!\n`);

  } catch (error) {
    console.error('❌ Error auditing teachers:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
  }
}

// Run the audit
auditTeachers();
