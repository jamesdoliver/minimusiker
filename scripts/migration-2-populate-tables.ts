/**
 * Migration Script 2: Populate New Tables
 *
 * Populates Events, Classes, Parents, and Registrations tables
 * with extracted data from Script 1, creating linked record relationships.
 *
 * Usage: npx ts-node scripts/migration-2-populate-tables.ts
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
  EVENTS: process.env.EVENTS_TABLE_ID || 'tblVWx1RrsGRjsNn5',
  CLASSES: process.env.CLASSES_TABLE_ID || 'tbl17SVI5gacwOP0n',
  PARENTS: process.env.PARENTS_TABLE_ID || 'tblaMYOUj93yp7jHE',
  REGISTRATIONS: process.env.REGISTRATIONS_TABLE_ID || 'tblXsmPuZcePcre5u',
};

// Field IDs
const EVENTS_FIELDS = {
  event_id: 'fldcNaHZyr6E5khDe',
  school_name: 'fld5QcpEsDFrLun6w',
  event_date: 'fld7pswBblm9jlOsS',
  event_type: 'fldnWvlgaik73WwsE',
  assigned_staff: 'fldKFG7lVsO1w9Td3',
  assigned_engineer: 'fldHK6sQA3jrU6O2H',
  created_at: 'fldnOuSFihr3HrJkF',
  legacy_booking_id: 'fldYrZSh7tdkwuWp4',
  simplybook_booking: 'fldK7vyxLd9MxgmES',
};

const CLASSES_FIELDS = {
  class_id: 'fld1dXGae9I7xldun',
  event_id: 'fldSSaeBuQDkOhOIT',
  class_name: 'fld1kaSb8my7q5mHt',
  main_teacher: 'fldsODu2rjT8ZMqLl',
  other_teachers: 'fldXGPDDeLPW3Zoli',
  total_children: 'flddABwj9UilV2OtG',
  created_at: 'fld3q0jZPIAlsx8FD',
  legacy_booking_id: 'fldXGF3yXrHeI4vWn',
};

const PARENTS_FIELDS = {
  parents_id: 'fldFkUhGlISNXCOZw',
  parent_id: 'fldnnzCB0aesXJdxu',
  parent_email: 'fldd3LuRL0TmzVESR',
  parent_first_name: 'fldtaXHWE5RP0nrw5',
  parent_telephone: 'fldG9NgGysXmZcQcu',
  email_campaigns: 'flddJfUYApbFbXbjy',
  created_at: 'fld3lXrbHzVyyomC5',
};

const REGISTRATIONS_FIELDS = {
  Id: 'fldBFsyhX7BFAmNLV',
  event_id: 'fld4U9Wq5Skqf2Poq',
  parent_id: 'fldqfoJhaXH0Oj32J',
  class_id: 'fldfZeZiOGFg5UD0I',
  registered_child: 'fldkdMkuuJ21sIjOQ',
  child_id: 'fldjejm0H9GoBIg5h',
  registered_complete: 'fld9j3Y4ez5eYqFtU',
  order_number: 'fldxoKh20d5WuW4vt',
  legacy_record: 'fldphliFEPY9WlIFJ',
  registration_date: 'fldXlB5zyf1FXwxo9',
  registration_status: 'fldFx38yx2wrlvUeG',
  notes: 'fldVF6VpiV5cCxUnK',
};

// Rate limiting helper
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Batch create records with rate limiting
async function createRecordsBatch<T>(
  tableName: string,
  records: T[],
  batchSize: number = 10
): Promise<Map<string, string>> {
  console.log(`📝 Creating ${records.length} records in ${tableName} (batch size: ${batchSize})...`);

  const recordMap = new Map<string, string>(); // Maps our ID → Airtable record ID
  const batches: T[][] = [];

  // Split into batches
  for (let i = 0; i < records.length; i += batchSize) {
    batches.push(records.slice(i, i + batchSize));
  }

  let createdCount = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    try {
      const createdRecords = await base(tableName).create(batch as any);

      // Map our IDs to Airtable record IDs
      createdRecords.forEach((record: any, index: number) => {
        const ourId = (batch[index] as any).fields[Object.keys((batch[index] as any).fields)[0]];
        recordMap.set(ourId, record.id);
      });

      createdCount += batch.length;
      console.log(`   ✓ Created ${createdCount}/${records.length} records`);

      // Rate limiting: 5 requests per second
      if (i < batches.length - 1) {
        await delay(200); // 200ms = 5 req/sec
      }
    } catch (error: any) {
      console.error(`   ❌ Error creating batch ${i + 1}:`, error.message);

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

  console.log(`✅ Created ${createdCount} records in ${tableName}\n`);
  return recordMap;
}

// Load extracted data
function loadExtractedData() {
  const dataDir = path.join(__dirname, '../migration-data');

  const events = JSON.parse(fs.readFileSync(path.join(dataDir, 'events.json'), 'utf-8'));
  const classes = JSON.parse(fs.readFileSync(path.join(dataDir, 'classes.json'), 'utf-8'));
  const parents = JSON.parse(fs.readFileSync(path.join(dataDir, 'parents.json'), 'utf-8'));
  const registrations = JSON.parse(fs.readFileSync(path.join(dataDir, 'registrations.json'), 'utf-8'));

  return { events, classes, parents, registrations };
}

// Step 1: Populate Events table
async function populateEvents(events: any[]): Promise<Map<string, string>> {
  console.log('🎪 STEP 1: Populating Events table...\n');

  const records = events.map(event => ({
    fields: {
      [EVENTS_FIELDS.event_id]: event.event_id,
      [EVENTS_FIELDS.school_name]: event.school_name,
      [EVENTS_FIELDS.event_date]: event.event_date,
      [EVENTS_FIELDS.event_type]: event.event_type,
      [EVENTS_FIELDS.assigned_staff]: event.assigned_staff || [],
      [EVENTS_FIELDS.assigned_engineer]: event.assigned_engineer || [],
      [EVENTS_FIELDS.legacy_booking_id]: event.legacy_booking_id,
    },
  }));

  return await createRecordsBatch(TABLES.EVENTS, records);
}

// Step 2: Populate Classes table (with Event links)
async function populateClasses(
  classes: any[],
  eventIdMap: Map<string, string>
): Promise<Map<string, string>> {
  console.log('🏫 STEP 2: Populating Classes table with Event links...\n');

  const records = classes.map(cls => {
    const eventRecordId = eventIdMap.get(cls.event_id);

    if (!eventRecordId) {
      console.warn(`⚠️  Class ${cls.class_id} references missing event ${cls.event_id}`);
    }

    return {
      fields: {
        [CLASSES_FIELDS.class_id]: cls.class_id,
        [CLASSES_FIELDS.event_id]: eventRecordId ? [eventRecordId] : [],
        [CLASSES_FIELDS.class_name]: cls.class_name,
        [CLASSES_FIELDS.main_teacher]: cls.main_teacher || '',
        [CLASSES_FIELDS.other_teachers]: cls.other_teachers || '',
        [CLASSES_FIELDS.total_children]: cls.total_children,
        [CLASSES_FIELDS.legacy_booking_id]: cls.legacy_booking_id,
      },
    };
  });

  return await createRecordsBatch(TABLES.CLASSES, records);
}

// Step 3: Populate Parents table
async function populateParents(parents: any[]): Promise<Map<string, string>> {
  console.log('👨‍👩‍👧‍👦 STEP 3: Populating Parents table...\n');

  const records = parents.map(parent => {
    const fields: any = {
      [PARENTS_FIELDS.parent_id]: parent.parent_id,
      [PARENTS_FIELDS.parent_email]: parent.parent_email,
      [PARENTS_FIELDS.parent_first_name]: parent.parent_first_name,
      [PARENTS_FIELDS.parent_telephone]: parent.parent_telephone,
    };

    // Only include email_campaigns if it has a value
    if (parent.email_campaigns) {
      fields[PARENTS_FIELDS.email_campaigns] = parent.email_campaigns;
    }

    return { fields };
  });

  const parentIdMap = await createRecordsBatch(TABLES.PARENTS, records);

  // Create email → Airtable record ID map for registrations
  const emailMap = new Map<string, string>();
  parents.forEach(parent => {
    const recordId = parentIdMap.get(parent.parent_id);
    if (recordId) {
      emailMap.set(parent.parent_email, recordId);
    }
  });

  return emailMap;
}

// Step 4: Populate Registrations table (with all links)
async function populateRegistrations(
  registrations: any[],
  eventIdMap: Map<string, string>,
  classIdMap: Map<string, string>,
  parentEmailMap: Map<string, string>
): Promise<void> {
  console.log('📋 STEP 4: Populating Registrations table with all links...\n');

  const records = registrations.map(reg => {
    const eventRecordId = eventIdMap.get(reg.event_id);
    const classRecordId = classIdMap.get(reg.class_id);
    const parentRecordId = parentEmailMap.get(reg.parent_email);

    if (!eventRecordId) {
      console.warn(`⚠️  Registration references missing event ${reg.event_id}`);
    }
    if (!classRecordId) {
      console.warn(`⚠️  Registration references missing class ${reg.class_id}`);
    }
    if (!parentRecordId) {
      console.warn(`⚠️  Registration references missing parent ${reg.parent_email}`);
    }

    const fields: any = {
      [REGISTRATIONS_FIELDS.event_id]: eventRecordId ? [eventRecordId] : [],
      [REGISTRATIONS_FIELDS.parent_id]: parentRecordId ? [parentRecordId] : [],
      [REGISTRATIONS_FIELDS.class_id]: classRecordId ? [classRecordId] : [],
      [REGISTRATIONS_FIELDS.registered_child]: reg.registered_child,
      [REGISTRATIONS_FIELDS.child_id]: reg.child_id || '',
      [REGISTRATIONS_FIELDS.registered_complete]: reg.registered_complete,
      [REGISTRATIONS_FIELDS.order_number]: reg.order_number || '',
      [REGISTRATIONS_FIELDS.legacy_record]: reg.legacy_record_id,
      [REGISTRATIONS_FIELDS.registration_date]: new Date().toISOString(),
    };

    // Only include registration_status if it has a value in source data
    // (Skip for now as the field doesn't allow creating new options via API)
    // if (reg.registration_status) {
    //   fields[REGISTRATIONS_FIELDS.registration_status] = reg.registration_status;
    // }

    return { fields };
  });

  await createRecordsBatch(TABLES.REGISTRATIONS, records, 10);
}

// Save ID mappings for reference
function saveMappings(
  eventIdMap: Map<string, string>,
  classIdMap: Map<string, string>,
  parentEmailMap: Map<string, string>
): void {
  const outputDir = path.join(__dirname, '../migration-data');

  const mappings = {
    events: Object.fromEntries(eventIdMap),
    classes: Object.fromEntries(classIdMap),
    parents: Object.fromEntries(parentEmailMap),
  };

  fs.writeFileSync(
    path.join(outputDir, 'id-mappings.json'),
    JSON.stringify(mappings, null, 2)
  );

  console.log(`💾 Saved ID mappings to: ${outputDir}/id-mappings.json\n`);
}

async function main() {
  console.log('🚀 Starting Migration Step 2: Populate Tables\n');
  console.log('========================================\n');

  try {
    // Load extracted data
    console.log('📂 Loading extracted data...\n');
    const { events, classes, parents, registrations } = loadExtractedData();

    console.log(`Loaded:`);
    console.log(`  - ${events.length} events`);
    console.log(`  - ${classes.length} classes`);
    console.log(`  - ${parents.length} parents`);
    console.log(`  - ${registrations.length} registrations\n`);

    console.log('========================================\n');

    // Step 1: Populate Events
    const eventIdMap = await populateEvents(events);

    // Step 2: Populate Classes (with Event links)
    const classIdMap = await populateClasses(classes, eventIdMap);

    // Step 3: Populate Parents
    const parentEmailMap = await populateParents(parents);

    // Step 4: Populate Registrations (with all links)
    await populateRegistrations(registrations, eventIdMap, classIdMap, parentEmailMap);

    // Save mappings
    saveMappings(eventIdMap, classIdMap, parentEmailMap);

    console.log('========================================\n');
    console.log('✅ Migration Step 2 Complete!\n');
    console.log('📊 Summary:');
    console.log(`  - Created ${eventIdMap.size} Events`);
    console.log(`  - Created ${classIdMap.size} Classes`);
    console.log(`  - Created ${parentEmailMap.size} Parents`);
    console.log(`  - Created ${registrations.length} Registrations\n`);
    console.log('Next step: Run migration-3-validate.ts to validate data integrity\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
