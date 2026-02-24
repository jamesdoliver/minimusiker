/**
 * Diagnostic & Fix Script: Herzlake Duplicate Events
 *
 * Problem: Two duplicate Event records exist for "Grundschule St. Nikolaus Herzlake".
 * Songs were created under Event A's event_id, but the engineer is viewing Event B.
 *
 * This script:
 * 1. Finds all events matching "Herzlake" or "Nikolaus"
 * 2. Prints diagnostic info (songs, classes, audio files, engineer assignments)
 * 3. Identifies the canonical event (the one with songs/data)
 * 4. Merges data from orphan → canonical and deletes the orphan (with confirmation)
 */
require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');
const readline = require('readline');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Table IDs
const EVENTS_TABLE = 'tblqsvSttKD81MF8v';
const SONGS_TABLE = 'tblPjGWQlHuG8jp5X';
const AUDIO_FILES_TABLE = 'tbloCM4tmH7mYoyXR';
const CLASSES_TABLE = 'tblwydZ8INAemRJaC';
const SCHOOL_BOOKINGS_TABLE = 'tblrktl5eLJEWE4M6';

// Field IDs
const EVENTS_FIELD_IDS = {
  event_id: 'fldcNaHZyr6E5khDe',
  school_name: 'fld5QcpEsDFrLun6w',
  event_date: 'fld7pswBblm9jlOsS',
  assigned_engineer: 'fldHK6sQA3jrU6O2H',
  assigned_staff: 'fldKFG7lVsO1w9Td3',
  simplybook_booking: 'fldK7vyxLd9MxgmES',
  classes: 'fld08ht43r8rknIPI',
  status: 'fld636QqQuc5Uwyec',
};

const SONGS_LINKED_FIELD_IDS = {
  event_link: 'fldygKERszsLFRBaS',
};

const AUDIO_FILES_LINKED_FIELD_IDS = {
  event_link: 'fldTFdrvuzIWd9WbK',
};

const CLASSES_FIELD_IDS = {
  class_id: 'fld4BTJZ9GJwHBpHX',
  class_name: 'fldBCX9GXfRB9rrth',
  event_id: 'fldPfaqRjhg1LZNXh',
};

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

async function main() {
  console.log('=== Herzlake Duplicate Event Diagnostic ===\n');

  // Step 1: Find all events matching Herzlake / Nikolaus
  const events = await base(EVENTS_TABLE).select({
    filterByFormula: `OR(SEARCH('Herzlake', {school_name}), SEARCH('Nikolaus', {school_name}))`,
  }).all();

  if (events.length === 0) {
    console.log('No events found matching Herzlake/Nikolaus. Exiting.');
    return;
  }

  console.log(`Found ${events.length} event(s):\n`);

  // Step 2: For each event, gather all related data
  const eventData = [];

  for (const event of events) {
    const eventId = event.get('event_id') || event.fields[EVENTS_FIELD_IDS.event_id];
    const schoolName = event.get('school_name') || event.fields[EVENTS_FIELD_IDS.school_name];
    const eventDate = event.get('event_date') || event.fields[EVENTS_FIELD_IDS.event_date];
    const assignedEngineer = event.get('assigned_engineer') || event.fields[EVENTS_FIELD_IDS.assigned_engineer] || [];
    const assignedStaff = event.get('assigned_staff') || event.fields[EVENTS_FIELD_IDS.assigned_staff] || [];
    const linkedClasses = event.get('classes') || event.fields[EVENTS_FIELD_IDS.classes] || [];
    const bookingLink = event.get('simplybook_booking') || event.fields[EVENTS_FIELD_IDS.simplybook_booking] || [];
    const status = event.get('status') || event.fields[EVENTS_FIELD_IDS.status];

    // Songs by text event_id field
    const songsByTextId = await base(SONGS_TABLE).select({
      filterByFormula: `{event_id} = '${eventId}'`,
    }).all();

    // Songs by linked event_link (Airtable record ID)
    const songsByLink = await base(SONGS_TABLE).select({
      filterByFormula: `{${SONGS_LINKED_FIELD_IDS.event_link}} = '${event.id}'`,
    }).all();

    // Audio files by text event_id field
    const audioByTextId = await base(AUDIO_FILES_TABLE).select({
      filterByFormula: `{event_id} = '${eventId}'`,
    }).all();

    // Audio files by linked event_link
    const audioByLink = await base(AUDIO_FILES_TABLE).select({
      filterByFormula: `{${AUDIO_FILES_LINKED_FIELD_IDS.event_link}} = '${event.id}'`,
    }).all();

    // Classes by linked record
    const classes = [];
    for (const classId of linkedClasses) {
      try {
        const classRecord = await base(CLASSES_TABLE).find(classId);
        classes.push(classRecord);
      } catch (e) {
        console.log(`  Warning: Could not find class ${classId}`);
      }
    }

    const data = {
      recordId: event.id,
      eventId,
      schoolName,
      eventDate,
      status,
      assignedEngineer,
      assignedStaff,
      bookingLink,
      songsByTextId,
      songsByLink,
      audioByTextId,
      audioByLink,
      classes,
      linkedClassIds: linkedClasses,
    };

    eventData.push(data);

    // Print diagnostic
    console.log(`--- Event: ${eventId} ---`);
    console.log(`  Record ID:        ${event.id}`);
    console.log(`  School:           ${schoolName}`);
    console.log(`  Date:             ${eventDate}`);
    console.log(`  Status:           ${status || 'N/A'}`);
    console.log(`  Engineers:        ${assignedEngineer.length > 0 ? assignedEngineer.join(', ') : 'None'}`);
    console.log(`  Staff:            ${assignedStaff.length > 0 ? assignedStaff.join(', ') : 'None'}`);
    console.log(`  Booking Link:     ${bookingLink.length > 0 ? bookingLink.join(', ') : 'None'}`);
    console.log(`  Classes (linked): ${classes.length}`);
    classes.forEach((c) => {
      const cName = c.get('class_name') || c.fields[CLASSES_FIELD_IDS.class_name] || 'Unknown';
      const cId = c.get('class_id') || c.fields[CLASSES_FIELD_IDS.class_id] || 'N/A';
      console.log(`    - ${cName} (${cId})`);
    });
    console.log(`  Songs (text):     ${songsByTextId.length}`);
    songsByTextId.forEach((s) => console.log(`    - ${s.get('title') || 'Untitled'} [class: ${s.get('class_id') || 'N/A'}]`));
    console.log(`  Songs (link):     ${songsByLink.length}`);
    songsByLink.forEach((s) => console.log(`    - ${s.get('title') || 'Untitled'} [class: ${s.get('class_id') || 'N/A'}]`));
    console.log(`  Audio (text):     ${audioByTextId.length}`);
    console.log(`  Audio (link):     ${audioByLink.length}`);
    console.log('');
  }

  if (eventData.length < 2) {
    console.log('Only 1 event found — no duplicates to merge. Exiting.');
    return;
  }

  // Step 3: Determine canonical event (the one with the most data)
  const scored = eventData.map((d) => ({
    ...d,
    score: d.songsByTextId.length + d.songsByLink.length + d.audioByTextId.length + d.audioByLink.length + d.classes.length + (d.bookingLink.length > 0 ? 5 : 0),
  }));

  scored.sort((a, b) => b.score - a.score);
  const canonical = scored[0];
  const orphans = scored.slice(1);

  console.log('=== MERGE PLAN ===');
  console.log(`Canonical event: ${canonical.eventId} (record: ${canonical.recordId}, score: ${canonical.score})`);
  orphans.forEach((o) => console.log(`Orphan event:    ${o.eventId} (record: ${o.recordId}, score: ${o.score})`));
  console.log('');

  for (const orphan of orphans) {
    console.log(`--- Merging orphan ${orphan.eventId} → ${canonical.eventId} ---`);

    // Collect all items to reassign
    const songsToFix = new Set();
    [...orphan.songsByTextId, ...orphan.songsByLink].forEach((s) => songsToFix.add(s.id));

    const audioToFix = new Set();
    [...orphan.audioByTextId, ...orphan.audioByLink].forEach((a) => audioToFix.add(a.id));

    const classesToFix = orphan.linkedClassIds.filter((id) => !canonical.linkedClassIds.includes(id));

    const needsEngineer = orphan.assignedEngineer.length > 0 && canonical.assignedEngineer.length === 0;

    console.log(`  Songs to reassign:     ${songsToFix.size}`);
    console.log(`  Audio to reassign:     ${audioToFix.size}`);
    console.log(`  Classes to reassign:   ${classesToFix.length}`);
    console.log(`  Transfer engineer:     ${needsEngineer ? 'Yes' : 'No'}`);

    if (songsToFix.size === 0 && audioToFix.size === 0 && classesToFix.length === 0 && !needsEngineer) {
      console.log('  Nothing to merge — orphan has no unique data.');
    }

    const answer = await ask('\nProceed with merge? (yes/no): ');
    if (answer.toLowerCase() !== 'yes') {
      console.log('Skipping merge. Exiting.');
      return;
    }

    // Reassign songs
    const songIds = Array.from(songsToFix);
    for (let i = 0; i < songIds.length; i += 10) {
      const batch = songIds.slice(i, i + 10).map((id) => ({
        id,
        fields: {
          event_id: canonical.eventId,
          [SONGS_LINKED_FIELD_IDS.event_link]: [canonical.recordId],
        },
      }));
      await base(SONGS_TABLE).update(batch);
      console.log(`  Updated ${batch.length} song(s)`);
    }

    // Reassign audio files
    const audioIds = Array.from(audioToFix);
    for (let i = 0; i < audioIds.length; i += 10) {
      const batch = audioIds.slice(i, i + 10).map((id) => ({
        id,
        fields: {
          event_id: canonical.eventId,
          [AUDIO_FILES_LINKED_FIELD_IDS.event_link]: [canonical.recordId],
        },
      }));
      await base(AUDIO_FILES_TABLE).update(batch);
      console.log(`  Updated ${batch.length} audio file(s)`);
    }

    // Reassign classes
    if (classesToFix.length > 0) {
      for (let i = 0; i < classesToFix.length; i += 10) {
        const batch = classesToFix.slice(i, i + 10).map((id) => ({
          id,
          fields: {
            [CLASSES_FIELD_IDS.event_id]: [canonical.recordId],
          },
        }));
        await base(CLASSES_TABLE).update(batch);
        console.log(`  Reassigned ${batch.length} class(es)`);
      }
    }

    // Transfer engineer assignment if needed
    if (needsEngineer) {
      await base(EVENTS_TABLE).update(canonical.recordId, {
        [EVENTS_FIELD_IDS.assigned_engineer]: orphan.assignedEngineer,
      });
      console.log(`  Transferred engineer assignment: ${orphan.assignedEngineer.join(', ')}`);
    }

    // Delete orphan event
    const deleteAnswer = await ask(`\nDelete orphan event record ${orphan.recordId}? (yes/no): `);
    if (deleteAnswer.toLowerCase() === 'yes') {
      await base(EVENTS_TABLE).destroy(orphan.recordId);
      console.log(`  Deleted orphan event: ${orphan.recordId}`);
    } else {
      console.log('  Orphan event NOT deleted.');
    }
  }

  console.log('\n=== Done! ===');
}

main().catch(console.error);
