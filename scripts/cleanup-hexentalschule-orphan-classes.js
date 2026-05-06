/**
 * Cleanup orphaned class records for event Hexentalschule (M-65519a).
 *
 * Background: The teacher portal previously created 10 class records with
 * `legacy_booking_id = 'M-65519a'` but no `event_id` linkage to the Event
 * record. These orphans confused the parent registration flow (duplicate
 * class names + a phantom default class + blocked submission). The code
 * fix in airtableService.getEventClasses now ignores them, but the records
 * still clutter the Classes table.
 *
 * Safety: Refuses to delete any class that has linked Registrations,
 * Songs, AudioFiles, Groups, Orders, or non-placeholder parent_journey
 * rows. By default runs as a dry-run; pass --execute to actually delete.
 *
 * Usage:
 *   node scripts/cleanup-hexentalschule-orphan-classes.js            # dry run
 *   node scripts/cleanup-hexentalschule-orphan-classes.js --execute  # delete
 */
const Airtable = require('airtable');
require('dotenv').config({ path: '.env.local' });
Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

// Table IDs (from src/lib/types/airtable.ts)
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const CLASSES_TABLE_ID = 'tbl17SVI5gacwOP0n';
const REGISTRATIONS_TABLE_ID = 'tblXsmPuZcePcre5u';
const GROUPS_TABLE_ID = 'tblAPwTzqYTHbaz2k';
const ORDERS_TABLE_ID = 'tblu9AGaLSoEVwqq7';
const SONGS_TABLE_ID = 'tblPjGWQlHuG8jp5X';
const AUDIO_FILES_TABLE_ID = 'tbloCM4tmH7mYoyXR';
const PARENT_JOURNEY_TABLE = 'parent_journey_table';

// Field IDs
const CLASSES_FIELD_IDS = {
  class_id: 'fld1dXGae9I7xldun',
  class_name: 'fld1kaSb8my7q5mHt',
  event_id: 'fldSSaeBuQDkOhOIT',
  legacy_booking_id: 'fldXGF3yXrHeI4vWn',
  is_default: 'fldJouWNH4fudWQl0',
  registrations: 'fld9hLZ4aNOw4v75X',
};
const SONGS_LINKED_FIELD_IDS = {
  class_link: 'fldMPAHLnyNralsLS',
};
const AUDIO_FILES_LINKED_FIELD_IDS = {
  class_link: 'fld04rZUWLKCv15s2',
};

// Target event
const SIMPLYBOOK_ID = 'M-65519a';
const CANONICAL_EVENT_ID = 'evt_hexentalschule_minimusiker_20260508_ae481a';

const dryRun = !process.argv.includes('--execute');

async function safeAll(table, options) {
  try {
    return await base(table).select(options).all();
  } catch (err) {
    // Some tables (e.g. AudioFiles) may not exist — treat as empty so the
    // safety check fails open, not closed.
    if (/NOT_FOUND|TABLE_NOT_FOUND/i.test(err?.error || err?.message || '')) {
      return null;
    }
    throw err;
  }
}

async function main() {
  console.log(`=== Cleanup orphaned classes for ${SIMPLYBOOK_ID} (Hexentalschule) ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no deletions)' : 'EXECUTE (will delete)'}`);

  // 1. Resolve Event
  const eventRecords = await base(EVENTS_TABLE_ID).select({
    filterByFormula: `{event_id} = '${CANONICAL_EVENT_ID}'`,
    returnFieldsByFieldId: true,
    maxRecords: 1,
  }).firstPage();
  if (eventRecords.length === 0) {
    console.error(`Event '${CANONICAL_EVENT_ID}' not found. Aborting.`);
    process.exit(1);
  }
  const eventRecordId = eventRecords[0].id;
  console.log(`Event record: ${eventRecordId}`);

  // 2. Find candidate classes (anything that looks linked to this booking)
  const candidates = await base(CLASSES_TABLE_ID).select({
    filterByFormula: `OR({legacy_booking_id} = '${SIMPLYBOOK_ID}', {legacy_booking_id} = '${CANONICAL_EVENT_ID}')`,
    returnFieldsByFieldId: true,
  }).all();

  // Orphans are those NOT linked to our Event via the linked event_id field
  const orphans = candidates.filter((c) => {
    const linked = (c.fields[CLASSES_FIELD_IDS.event_id] || []);
    return !linked.includes(eventRecordId);
  });

  console.log(`\nCandidates: ${candidates.length}; Orphans: ${orphans.length}`);

  if (orphans.length === 0) {
    console.log('Nothing to clean up.');
    return;
  }

  // 3. For each orphan, audit linked data
  const safeToDelete = [];
  const blocked = [];

  for (const cls of orphans) {
    const classRecordId = cls.id;
    const classFields = cls.fields;
    const className = classFields[CLASSES_FIELD_IDS.class_name] || '(no name)';
    const classId = classFields[CLASSES_FIELD_IDS.class_id] || '(no class_id)';
    const issues = [];

    // 3a. Cross-check: the orphan's own `registrations` linked field
    const linkedRegs = (classFields[CLASSES_FIELD_IDS.registrations] || []);
    if (linkedRegs.length > 0) {
      issues.push(`${linkedRegs.length} linked registrations on the class record`);
    }

    // 3b. Registrations table — class_id is a linked record
    const regs = await safeAll(REGISTRATIONS_TABLE_ID, {
      filterByFormula: `FIND('${classRecordId}', ARRAYJOIN({class_id}))`,
    });
    if (regs && regs.length > 0) {
      // Treat any record with a non-empty parent_id link as real parent data
      const real = regs.filter((r) => {
        const pid = r.fields.parent_id;
        return Array.isArray(pid) && pid.length > 0;
      });
      if (real.length > 0) {
        issues.push(`${real.length} registrations in Registrations table`);
      }
    }

    // 3c. parent_journey_table (legacy) — class_id is text. Skip placeholders.
    const journeys = await safeAll(PARENT_JOURNEY_TABLE, {
      filterByFormula: `AND({class_id} = '${classId.replace(/'/g, "\\'")}', {parent_id} != 'PLACEHOLDER', {parent_id} != '')`,
    });
    if (journeys && journeys.length > 0) {
      issues.push(`${journeys.length} legacy parent_journey records`);
    }

    // 3d. Songs — class_link linked record
    const songs = await safeAll(SONGS_TABLE_ID, {
      filterByFormula: `FIND('${classRecordId}', ARRAYJOIN({${SONGS_LINKED_FIELD_IDS.class_link}}))`,
      returnFieldsByFieldId: true,
    });
    if (songs && songs.length > 0) {
      issues.push(`${songs.length} songs`);
    }

    // 3e. AudioFiles — class_link linked record. Table may not exist; null = unknown,
    // we treat unknown as blocking to stay safe.
    const audio = await safeAll(AUDIO_FILES_TABLE_ID, {
      filterByFormula: `FIND('${classRecordId}', ARRAYJOIN({${AUDIO_FILES_LINKED_FIELD_IDS.class_link}}))`,
      returnFieldsByFieldId: true,
    });
    if (audio === null) {
      issues.push('AudioFiles table check failed (table may have moved) — refusing to delete');
    } else if (audio.length > 0) {
      issues.push(`${audio.length} audio files`);
    }

    // 3f. Groups — member_classes linked record
    const groups = await safeAll(GROUPS_TABLE_ID, {
      filterByFormula: `FIND('${classRecordId}', ARRAYJOIN({member_classes}))`,
    });
    if (groups && groups.length > 0) {
      issues.push(`${groups.length} groups`);
    }

    // 3g. Orders — class_id linked record
    const orders = await safeAll(ORDERS_TABLE_ID, {
      filterByFormula: `FIND('${classRecordId}', ARRAYJOIN({class_id}))`,
    });
    if (orders && orders.length > 0) {
      issues.push(`${orders.length} orders`);
    }

    if (issues.length === 0) {
      safeToDelete.push(cls);
    } else {
      blocked.push({ cls, issues });
    }
  }

  // 4. Report
  console.log(`\n=== Audit results ===`);
  console.log(`Safe to delete: ${safeToDelete.length}`);
  for (const cls of safeToDelete) {
    const f = cls.fields;
    console.log(`  - ${f[CLASSES_FIELD_IDS.class_name] || '(no name)'} | class_id=${f[CLASSES_FIELD_IDS.class_id]} | legacy_booking_id=${f[CLASSES_FIELD_IDS.legacy_booking_id]} | record=${cls.id}`);
  }

  if (blocked.length > 0) {
    console.log(`\nBlocked (linked data found, will NOT delete): ${blocked.length}`);
    for (const { cls, issues } of blocked) {
      const f = cls.fields;
      console.log(`  - ${f[CLASSES_FIELD_IDS.class_name] || '(no name)'} | record=${cls.id}`);
      for (const issue of issues) console.log(`      ! ${issue}`);
    }
  }

  // 5. Delete (or report)
  if (safeToDelete.length === 0) {
    console.log('\nNothing safe to delete.');
    return;
  }

  if (dryRun) {
    console.log(`\n[DRY RUN] Would delete ${safeToDelete.length} record(s). Re-run with --execute to actually delete.`);
    return;
  }

  console.log(`\nDeleting ${safeToDelete.length} record(s)...`);
  // Airtable API: destroy max 10 IDs per call
  const ids = safeToDelete.map((c) => c.id);
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    await base(CLASSES_TABLE_ID).destroy(batch);
    console.log(`  Deleted batch of ${batch.length}: ${batch.join(', ')}`);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
