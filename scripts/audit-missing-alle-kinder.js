/**
 * Audit: Find events missing the default "Alle Kinder" class
 *
 * Queries all Events in Airtable, cross-references with Classes table,
 * and reports which events don't have an is_default=true class.
 *
 * Run with --fix flag to auto-create missing "Alle Kinder" classes.
 *
 * Usage:
 *   node scripts/audit-missing-alle-kinder.js          # Dry run (report only)
 *   node scripts/audit-missing-alle-kinder.js --fix     # Create missing classes
 */

const Airtable = require('airtable');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

const EVENTS_TABLE = 'tblVWx1RrsGRjsNn5';
const CLASSES_TABLE = 'tbl17SVI5gacwOP0n';
const SCHOOL_BOOKINGS_TABLE = 'tblrktl5eLJEWE4M6';

// Field IDs
const EF = {
  event_id: 'fldcNaHZyr6E5khDe',
  school_name: 'fld5QcpEsDFrLun6w',
  event_date: 'fld7pswBblm9jlOsS',
  status: 'fld636QqQuc5Uwyec',
  simplybook_booking: 'fldK7vyxLd9MxgmES',
  classes: 'fld08ht43r8rknIPI',
  estimated_children: 'fldjnXCnyfeA1KSeX',
  access_code: 'flduhYSy17fsa6n3x',
};

const CF = {
  class_id: 'fld1dXGae9I7xldun',
  event_id: 'fldSSaeBuQDkOhOIT',
  class_name: 'fld1kaSb8my7q5mHt',
  is_default: 'fldJouWNH4fudWQl0',
  total_children: 'flddABwj9UilV2OtG',
  legacy_booking_id: 'fldXGF3yXrHeI4vWn',
  class_type: 'fldpYd9tFi09joNPV',
};

const FIX_MODE = process.argv.includes('--fix');

function generateClassId(schoolName, bookingDate, className) {
  const schoolSlug = schoolName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 30);

  const classSlug = className
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 15);

  const dateOnly = (bookingDate || '').split('T')[0];
  const dateStr = dateOnly.replace(/-/g, '');

  const hashInput = `${schoolName}|${bookingDate}|${className}`;
  const hash = crypto.createHash('md5').update(hashInput).digest('hex').substring(0, 6);

  return `cls_${schoolSlug}_${dateStr}_${classSlug}_${hash}`;
}

async function main() {
  console.log('=== AUDIT: Events Missing "Alle Kinder" Default Class ===');
  console.log(`Mode: ${FIX_MODE ? '🔧 FIX (will create missing classes)' : '📋 DRY RUN (report only)'}\n`);

  // Step 1: Fetch all events
  console.log('Fetching all events...');
  const allEvents = await base(EVENTS_TABLE).select({
    fields: [
      EF.event_id,
      EF.school_name,
      EF.event_date,
      EF.status,
      EF.simplybook_booking,
      EF.classes,
      EF.estimated_children,
      EF.access_code,
    ],
    returnFieldsByFieldId: true,
  }).all();

  console.log(`Found ${allEvents.length} total events\n`);

  // Step 2: Fetch all classes with their is_default flag
  console.log('Fetching all classes...');
  const allClasses = await base(CLASSES_TABLE).select({
    fields: [
      CF.class_id,
      CF.event_id,
      CF.class_name,
      CF.is_default,
      CF.class_type,
    ],
    returnFieldsByFieldId: true,
  }).all();

  console.log(`Found ${allClasses.length} total classes\n`);

  // Step 3: Build a map of event record ID → classes
  const eventClassesMap = new Map(); // eventRecordId → { hasDefault, classCount, classes }

  for (const cls of allClasses) {
    const eventIds = cls.fields[CF.event_id] || [];
    const isDefault = cls.fields[CF.is_default] === true;
    const className = cls.fields[CF.class_name];
    const classType = cls.fields[CF.class_type];

    for (const eventRecordId of eventIds) {
      if (!eventClassesMap.has(eventRecordId)) {
        eventClassesMap.set(eventRecordId, { hasDefault: false, classCount: 0, classes: [] });
      }
      const entry = eventClassesMap.get(eventRecordId);
      entry.classCount++;
      entry.classes.push({ name: className, isDefault, type: classType });
      if (isDefault) {
        entry.hasDefault = true;
      }
    }
  }

  // Step 4: Categorize events
  const categories = {
    noClasses: [],        // Event has 0 classes at all
    noDefault: [],        // Event has classes but none is_default
    hasDefault: [],       // Event has the default "Alle Kinder" class
    deletedOrCancelled: [], // Deleted/Cancelled events (less urgent)
  };

  for (const evt of allEvents) {
    const eventId = evt.fields[EF.event_id];
    const schoolName = evt.fields[EF.school_name];
    const eventDate = evt.fields[EF.event_date];
    const status = evt.fields[EF.status];
    const accessCode = evt.fields[EF.access_code];
    const estimatedChildren = evt.fields[EF.estimated_children];
    const simplybookBooking = evt.fields[EF.simplybook_booking];

    const classInfo = eventClassesMap.get(evt.id) || { hasDefault: false, classCount: 0, classes: [] };

    const eventSummary = {
      recordId: evt.id,
      eventId,
      schoolName,
      eventDate,
      status,
      accessCode,
      estimatedChildren,
      hasSimplyBookLink: !!(simplybookBooking && simplybookBooking.length > 0),
      classCount: classInfo.classCount,
      classes: classInfo.classes,
    };

    if (status === 'Deleted' || status === 'Cancelled') {
      if (!classInfo.hasDefault) {
        categories.deletedOrCancelled.push(eventSummary);
      }
    } else if (classInfo.classCount === 0) {
      categories.noClasses.push(eventSummary);
    } else if (!classInfo.hasDefault) {
      categories.noDefault.push(eventSummary);
    } else {
      categories.hasDefault.push(eventSummary);
    }
  }

  // Step 5: Report
  console.log('========================================');
  console.log('RESULTS');
  console.log('========================================\n');

  console.log(`✅ Events WITH "Alle Kinder" default class: ${categories.hasDefault.length}`);
  console.log(`❌ Events with NO classes at all: ${categories.noClasses.length}`);
  console.log(`⚠️  Events with classes but NO default: ${categories.noDefault.length}`);
  console.log(`🗑️  Deleted/Cancelled events missing default: ${categories.deletedOrCancelled.length}`);
  console.log('');

  // Detail: Events with no classes
  if (categories.noClasses.length > 0) {
    console.log('--- ❌ EVENTS WITH NO CLASSES ---');
    for (const evt of categories.noClasses) {
      console.log(`  [${evt.accessCode || 'no-code'}] ${evt.schoolName} (${evt.eventDate}) - Status: ${evt.status || 'none'} - Children: ${evt.estimatedChildren || '?'} - SimplyBook: ${evt.hasSimplyBookLink ? 'linked' : 'NOT linked'}`);
    }
    console.log('');
  }

  // Detail: Events with classes but no default
  if (categories.noDefault.length > 0) {
    console.log('--- ⚠️  EVENTS WITH CLASSES BUT NO DEFAULT ---');
    for (const evt of categories.noDefault) {
      const classList = evt.classes.map(c => `"${c.name}" (${c.type || 'regular'}${c.isDefault ? ', DEFAULT' : ''})`).join(', ');
      console.log(`  [${evt.accessCode || 'no-code'}] ${evt.schoolName} (${evt.eventDate}) - ${evt.classCount} classes: ${classList}`);
    }
    console.log('');
  }

  // Step 6: Fix if --fix flag is set
  const eventsToFix = [...categories.noClasses, ...categories.noDefault];

  if (eventsToFix.length === 0) {
    console.log('🎉 All active events have the "Alle Kinder" default class!');
    return;
  }

  if (!FIX_MODE) {
    console.log(`\n💡 Run with --fix to create "Alle Kinder" for ${eventsToFix.length} events:`);
    console.log('   node scripts/audit-missing-alle-kinder.js --fix');
    return;
  }

  console.log(`\n🔧 FIXING: Creating "Alle Kinder" for ${eventsToFix.length} events...\n`);

  let fixed = 0;
  let errors = 0;

  for (const evt of eventsToFix) {
    try {
      const classId = generateClassId(
        evt.schoolName || 'Unknown',
        evt.eventDate || '',
        'Alle Kinder'
      );

      // Check if a class with this ID already exists (idempotency)
      const existing = await base(CLASSES_TABLE).select({
        filterByFormula: `{${CF.class_id}} = '${classId.replace(/'/g, "\\'")}'`,
        maxRecords: 1,
        returnFieldsByFieldId: true,
      }).firstPage();

      if (existing.length > 0) {
        // Class exists but isn't marked as default — fix the flag
        const existingClass = existing[0];
        if (!existingClass.fields[CF.is_default]) {
          await base(CLASSES_TABLE).update(existingClass.id, {
            [CF.is_default]: true,
          });
          console.log(`  ✅ [${evt.accessCode}] ${evt.schoolName}: Marked existing class as default`);
          fixed++;
        } else {
          console.log(`  ⏭️  [${evt.accessCode}] ${evt.schoolName}: Class already exists and is default`);
        }
        continue;
      }

      // Create the missing "Alle Kinder" class
      const classFields = {
        [CF.class_id]: classId,
        [CF.class_name]: 'Alle Kinder',
        [CF.event_id]: [evt.recordId],
        [CF.is_default]: true,
        [CF.legacy_booking_id]: evt.eventId,
      };

      if (evt.estimatedChildren && evt.estimatedChildren > 0) {
        classFields[CF.total_children] = evt.estimatedChildren;
      }

      await base(CLASSES_TABLE).create([{ fields: classFields }]);
      console.log(`  ✅ [${evt.accessCode}] ${evt.schoolName} (${evt.eventDate}): Created "Alle Kinder" class`);
      fixed++;

      // Rate limit: Airtable allows 5 requests per second
      await new Promise(resolve => setTimeout(resolve, 250));

    } catch (err) {
      console.error(`  ❌ [${evt.accessCode}] ${evt.schoolName}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n========================================`);
  console.log(`SUMMARY: Fixed ${fixed}, Errors ${errors}, Total ${eventsToFix.length}`);
  console.log(`========================================`);
}

main().catch(console.error);
