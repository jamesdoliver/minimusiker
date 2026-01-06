/**
 * Migration Script 1: Extract & Deduplicate Data
 *
 * Extracts unique events, classes, and parents from parent_journey_table
 * for migration to normalized table structure.
 *
 * Usage: npx ts-node scripts/migration-1-extract-data.ts
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
const PARENT_JOURNEY_TABLE_ID = 'tblocVr4DF001I1Ar';

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
  console.error('❌ Missing environment variables: AIRTABLE_PAT (or AIRTABLE_API_KEY) or AIRTABLE_BASE_ID');
  process.exit(1);
}

// Initialize Airtable
const base = new Airtable({ apiKey: AIRTABLE_PAT }).base(AIRTABLE_BASE_ID);

// Field IDs from parent_journey_table
const FIELDS = {
  booking_id: 'fldUB8dAiQd61VncB',
  school_name: 'fld2Rd4S9aWGOjkJI',
  main_teacher: 'fldPscsXvYRwfvZwY',
  other_teachers: 'fldZob7MwrY1QPobP',
  class: 'fldJMcFElbkkPGhSe',
  class_id: 'fldtiPDposZlSD2lm',
  registered_child: 'flddZJuHdOqeighMf',
  parent_first_name: 'fldTeWfHG1TQJbzgr',
  parent_email: 'fldwiX1CSfJZS0AIz',
  parent_telephone: 'fldYljDGY0MPzgzDx',
  email_campaigns: 'fldSTM8ogsqM357h1',
  order_number: 'fldeYzYUhAWIZxFX3',
  event_type: 'fldOZ20fduUR0mboV',
  parent_id: 'fld4mmx0n71PSr1JM',
  booking_date: 'fldZx9CQHCvoqjJ71',
  child_id: 'fldGSeyNR9R1OzifJ',
  registered_complete: 'fldVRM60HDfNzO12o',
  total_children: 'fldonCg4373zaXQfM',
  assigned_staff: 'fldf0OQES4ZPn6HAv',
  assigned_engineer: 'fldrpMpQXkeJcGkg5',
};

interface ExtractedEvent {
  event_id: string;
  school_name: string;
  event_date: string;
  event_type: string;
  assigned_staff?: string[];
  assigned_engineer?: string[];
  legacy_booking_id: string;
}

interface ExtractedClass {
  class_id: string;
  event_id: string;
  class_name: string;
  main_teacher?: string;
  other_teachers?: string;
  total_children: number;
  legacy_booking_id: string;
}

interface ExtractedParent {
  parent_id: string;
  parent_email: string;
  parent_first_name: string;
  parent_telephone: string;
  email_campaigns?: string;
}

interface ExtractedRegistration {
  event_id: string;
  class_id: string;
  parent_id: string;
  parent_email: string;
  registered_child: string;
  child_id?: string;
  order_number?: string;
  registered_complete: boolean;
  legacy_record_id: string;
}

interface ExtractionResult {
  events: ExtractedEvent[];
  classes: ExtractedClass[];
  parents: ExtractedParent[];
  registrations: ExtractedRegistration[];
  stats: {
    totalRecords: number;
    placeholderRecords: number;
    uniqueEvents: number;
    uniqueClasses: number;
    uniqueParents: number;
    actualRegistrations: number;
  };
}

async function fetchAllRecords(): Promise<any[]> {
  console.log('📥 Fetching all records from parent_journey_table...');

  const records: any[] = [];

  await base(PARENT_JOURNEY_TABLE_ID)
    .select({
      returnFieldsByFieldId: true,
      pageSize: 100,
    })
    .eachPage((pageRecords, fetchNextPage) => {
      records.push(...pageRecords);
      console.log(`   Fetched ${records.length} records...`);
      fetchNextPage();
    });

  console.log(`✅ Fetched ${records.length} total records\n`);
  return records;
}

function isPlaceholderRecord(record: any): boolean {
  const fields = record.fields;

  // Placeholder if no registered_child and no parent_email
  return !fields[FIELDS.registered_child] && !fields[FIELDS.parent_email];
}

function extractEvents(records: any[]): ExtractedEvent[] {
  console.log('🔍 Extracting unique events...');

  const eventsMap = new Map<string, ExtractedEvent>();

  for (const record of records) {
    const fields = record.fields;
    const bookingId = fields[FIELDS.booking_id];

    if (!bookingId) continue;

    // Use booking_id as event_id
    if (!eventsMap.has(bookingId)) {
      eventsMap.set(bookingId, {
        event_id: bookingId,
        school_name: fields[FIELDS.school_name] || '',
        event_date: fields[FIELDS.booking_date] || '',
        event_type: fields[FIELDS.event_type] || 'concert',
        assigned_staff: fields[FIELDS.assigned_staff],
        assigned_engineer: fields[FIELDS.assigned_engineer],
        legacy_booking_id: bookingId,
      });
    }
  }

  const events = Array.from(eventsMap.values());
  console.log(`✅ Extracted ${events.length} unique events\n`);
  return events;
}

function extractClasses(records: any[]): ExtractedClass[] {
  console.log('🔍 Extracting unique classes...');

  const classesMap = new Map<string, ExtractedClass>();

  for (const record of records) {
    const fields = record.fields;
    const classId = fields[FIELDS.class_id];
    const bookingId = fields[FIELDS.booking_id];

    if (!classId || !bookingId) continue;

    if (!classesMap.has(classId)) {
      classesMap.set(classId, {
        class_id: classId,
        event_id: bookingId,  // Link to event via booking_id
        class_name: fields[FIELDS.class] || '',
        main_teacher: fields[FIELDS.main_teacher],
        other_teachers: fields[FIELDS.other_teachers],
        total_children: fields[FIELDS.total_children] || 0,
        legacy_booking_id: bookingId,
      });
    }
  }

  const classes = Array.from(classesMap.values());
  console.log(`✅ Extracted ${classes.length} unique classes\n`);
  return classes;
}

function extractParents(records: any[]): ExtractedParent[] {
  console.log('🔍 Extracting unique parents (deduplicated by email)...');

  const parentsMap = new Map<string, ExtractedParent>();

  for (const record of records) {
    const fields = record.fields;
    const parentEmail = fields[FIELDS.parent_email];

    if (!parentEmail || isPlaceholderRecord(record)) continue;

    // Deduplicate by email - take first occurrence
    if (!parentsMap.has(parentEmail)) {
      parentsMap.set(parentEmail, {
        parent_id: fields[FIELDS.parent_id] || '',
        parent_email: parentEmail,
        parent_first_name: fields[FIELDS.parent_first_name] || '',
        parent_telephone: fields[FIELDS.parent_telephone] || '',
        email_campaigns: fields[FIELDS.email_campaigns],
      });
    }
  }

  const parents = Array.from(parentsMap.values());
  console.log(`✅ Extracted ${parents.length} unique parents\n`);
  return parents;
}

function extractRegistrations(records: any[]): ExtractedRegistration[] {
  console.log('🔍 Extracting registrations (excluding placeholders)...');

  const registrations: ExtractedRegistration[] = [];
  let placeholderCount = 0;

  for (const record of records) {
    const fields = record.fields;

    if (isPlaceholderRecord(record)) {
      placeholderCount++;
      continue;
    }

    const bookingId = fields[FIELDS.booking_id];
    const classId = fields[FIELDS.class_id];
    const parentEmail = fields[FIELDS.parent_email];

    if (!bookingId || !classId || !parentEmail) {
      console.warn(`⚠️  Skipping incomplete record ${record.id}`);
      continue;
    }

    registrations.push({
      event_id: bookingId,
      class_id: classId,
      parent_id: fields[FIELDS.parent_id] || '',
      parent_email: parentEmail,
      registered_child: fields[FIELDS.registered_child] || '',
      child_id: fields[FIELDS.child_id],
      order_number: fields[FIELDS.order_number],
      registered_complete: fields[FIELDS.registered_complete] || false,
      legacy_record_id: record.id,
    });
  }

  console.log(`✅ Extracted ${registrations.length} registrations (${placeholderCount} placeholders excluded)\n`);
  return registrations;
}

function validateData(result: ExtractionResult): void {
  console.log('🔍 Validating extracted data...\n');

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for missing class_ids in registrations
  const classIds = new Set(result.classes.map(c => c.class_id));
  const missingClasses = result.registrations.filter(r => !classIds.has(r.class_id));
  if (missingClasses.length > 0) {
    errors.push(`${missingClasses.length} registrations reference missing class_ids`);
  }

  // Check for missing event_ids in registrations
  const eventIds = new Set(result.events.map(e => e.event_id));
  const missingEvents = result.registrations.filter(r => !eventIds.has(r.event_id));
  if (missingEvents.length > 0) {
    errors.push(`${missingEvents.length} registrations reference missing event_ids`);
  }

  // Check for parents without email
  const parentsWithoutEmail = result.parents.filter(p => !p.parent_email);
  if (parentsWithoutEmail.length > 0) {
    errors.push(`${parentsWithoutEmail.length} parents missing email addresses`);
  }

  // Check for duplicate parent emails (shouldn't happen after deduplication)
  const emailCounts = new Map<string, number>();
  for (const parent of result.parents) {
    emailCounts.set(parent.parent_email, (emailCounts.get(parent.parent_email) || 0) + 1);
  }
  const duplicates = Array.from(emailCounts.entries()).filter(([_, count]) => count > 1);
  if (duplicates.length > 0) {
    errors.push(`${duplicates.length} duplicate parent emails found`);
  }

  // Check for registrations with missing parent email
  const parentEmails = new Set(result.parents.map(p => p.parent_email));
  const orphanedRegistrations = result.registrations.filter(r => !parentEmails.has(r.parent_email));
  if (orphanedRegistrations.length > 0) {
    warnings.push(`${orphanedRegistrations.length} registrations have parents not in parents list (will create during migration)`);
  }

  // Print validation results
  if (errors.length > 0) {
    console.log('❌ VALIDATION ERRORS:');
    errors.forEach(err => console.log(`   - ${err}`));
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️  VALIDATION WARNINGS:');
    warnings.forEach(warn => console.log(`   - ${warn}`));
    console.log('');
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All validation checks passed!\n');
  }
}

function saveResults(result: ExtractionResult): void {
  const outputDir = path.join(__dirname, '../migration-data');

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save each dataset
  fs.writeFileSync(
    path.join(outputDir, 'events.json'),
    JSON.stringify(result.events, null, 2)
  );

  fs.writeFileSync(
    path.join(outputDir, 'classes.json'),
    JSON.stringify(result.classes, null, 2)
  );

  fs.writeFileSync(
    path.join(outputDir, 'parents.json'),
    JSON.stringify(result.parents, null, 2)
  );

  fs.writeFileSync(
    path.join(outputDir, 'registrations.json'),
    JSON.stringify(result.registrations, null, 2)
  );

  fs.writeFileSync(
    path.join(outputDir, 'stats.json'),
    JSON.stringify(result.stats, null, 2)
  );

  console.log(`💾 Saved extraction results to: ${outputDir}`);
  console.log(`   - events.json (${result.events.length} records)`);
  console.log(`   - classes.json (${result.classes.length} records)`);
  console.log(`   - parents.json (${result.parents.length} records)`);
  console.log(`   - registrations.json (${result.registrations.length} records)`);
  console.log(`   - stats.json\n`);
}

async function main() {
  console.log('🚀 Starting Migration Step 1: Data Extraction\n');
  console.log('========================================\n');

  try {
    // Fetch all records
    const allRecords = await fetchAllRecords();

    // Extract unique events, classes, parents
    const events = extractEvents(allRecords);
    const classes = extractClasses(allRecords);
    const parents = extractParents(allRecords);
    const registrations = extractRegistrations(allRecords);

    const placeholderCount = allRecords.filter(isPlaceholderRecord).length;

    const result: ExtractionResult = {
      events,
      classes,
      parents,
      registrations,
      stats: {
        totalRecords: allRecords.length,
        placeholderRecords: placeholderCount,
        uniqueEvents: events.length,
        uniqueClasses: classes.length,
        uniqueParents: parents.length,
        actualRegistrations: registrations.length,
      },
    };

    // Validate data
    validateData(result);

    // Print summary
    console.log('📊 EXTRACTION SUMMARY');
    console.log('========================================');
    console.log(`Total records in parent_journey_table: ${result.stats.totalRecords}`);
    console.log(`Placeholder records (excluded):        ${result.stats.placeholderRecords}`);
    console.log(`Unique events:                         ${result.stats.uniqueEvents}`);
    console.log(`Unique classes:                        ${result.stats.uniqueClasses}`);
    console.log(`Unique parents:                        ${result.stats.uniqueParents}`);
    console.log(`Actual registrations:                  ${result.stats.actualRegistrations}`);
    console.log('========================================\n');

    // Save results
    saveResults(result);

    console.log('✅ Migration Step 1 Complete!\n');
    console.log('Next step: Run migration-2-populate-tables.ts to populate new Airtable tables\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
