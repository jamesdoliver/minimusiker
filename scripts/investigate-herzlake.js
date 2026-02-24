/**
 * Diagnostic Script: Investigate Herzlake / St. Nikolaus - No Songs in Engineer Portal
 *
 * Known facts:
 * - Event record recQoFZsoYK88sQou has event_id: evt_grundschule_st_nikolaus_herzla_minimusiker_20260211_0c85ab
 * - Engineer portal shows 0 classes, 0 songs
 * - Admin view might show songs
 *
 * This script does a broad investigation across all relevant tables.
 */
require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Table IDs (for tables that require field IDs)
const SONGS_TABLE = 'tblPjGWQlHuG8jp5X';
const AUDIO_FILES_TABLE = 'tbloCM4tmH7mYoyXR';
const CLASSES_TABLE = 'tblwydZ8INAemRJaC';

// Field IDs
const SONGS_FID = {
  title: 'fldLjwkTwckDqT3Xl',
  class_id: 'fldK4wCT5oKZDN6sE',
  event_id: 'fldCKN3IXHPczIWfs',
  event_link: 'fldygKERszsLFRBaS',
};

const AUDIO_FID = {
  event_id: 'fldwtYA1GwhVf3Ia7',
  event_link: 'fldTFdrvuzIWd9WbK',
  class_id: 'fldAYW88oxtF5L5Bf',
  filename: 'fldOTWiFz8G1lE04c',
  type: 'fldOMmFN7BqHVAqfH',
};

const CLASSES_FID = {
  class_id: 'fld4BTJZ9GJwHBpHX',
  class_name: 'fldBCX9GXfRB9rrth',
};

const KNOWN_RECORD_ID = 'recQoFZsoYK88sQou';
const KNOWN_EVENT_ID = 'evt_grundschule_st_nikolaus_herzla_minimusiker_20260211_0c85ab';

function separator(title) {
  console.log('\n' + '='.repeat(80));
  console.log(`  ${title}`);
  console.log('='.repeat(80));
}

async function main() {
  console.log('Herzlake / St. Nikolaus Investigation');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`USE_NORMALIZED_TABLES = ${process.env.USE_NORMALIZED_TABLES || '(not set)'}`);

  // =========================================================================
  // 1. Search Events table for ANY event mentioning Herzlake or Nikolaus
  // =========================================================================
  separator('1. EVENTS TABLE - Search for Herzlake / Nikolaus');

  try {
    const events = await base('Events').select({
      filterByFormula: `OR(SEARCH('herzlake', LOWER({school_name})), SEARCH('nikolaus', LOWER({school_name})), SEARCH('herzla', LOWER({event_id})))`,
    }).all();

    console.log(`Found ${events.length} event(s):\n`);

    for (const event of events) {
      console.log(`  Record ID:          ${event.id}`);
      console.log(`  event_id:           ${event.get('event_id')}`);
      console.log(`  school_name:        ${event.get('school_name')}`);
      console.log(`  event_date:         ${event.get('event_date')}`);
      console.log(`  status:             ${event.get('status') || 'N/A'}`);
      console.log(`  classes (linked):   ${JSON.stringify(event.get('classes') || [])}`);
      console.log(`  assigned_engineer:  ${JSON.stringify(event.get('assigned_engineer') || [])}`);
      console.log(`  assigned_staff:     ${JSON.stringify(event.get('assigned_staff') || [])}`);
      console.log(`  is_schulsong:       ${event.get('is_schulsong')}`);
      console.log(`  is_plus:            ${event.get('is_plus')}`);
      console.log(`  audio_pipeline:     ${event.get('audio_pipeline_stage')}`);
      console.log(`  simplybook_booking: ${JSON.stringify(event.get('simplybook_booking') || [])}`);
      console.log(`  legacy_booking_id:  ${event.get('legacy_booking_id')}`);
      console.log('');
    }
  } catch (err) {
    console.error('Error searching Events:', err.message);
  }

  // =========================================================================
  // 2. Dump ALL fields of known record recQoFZsoYK88sQou
  // =========================================================================
  separator('2. FULL DUMP of known event record recQoFZsoYK88sQou');

  try {
    const record = await base('Events').find(KNOWN_RECORD_ID);
    console.log(`Record ID: ${record.id}`);
    console.log('All fields:');
    for (const [key, value] of Object.entries(record.fields)) {
      console.log(`  ${key}: ${JSON.stringify(value)}`);
    }
  } catch (err) {
    console.error('Error fetching known record:', err.message);
  }

  // =========================================================================
  // 3. Search Songs table - multiple strategies
  // =========================================================================
  separator('3. SONGS TABLE - Search for Herzlake-related songs');

  // 3a. By exact event_id text match
  console.log('\n--- 3a. Songs where event_id = known event_id ---');
  try {
    const songs = await base(SONGS_TABLE).select({
      filterByFormula: `{${SONGS_FID.event_id}} = '${KNOWN_EVENT_ID}'`,
      returnFieldsByFieldId: true,
    }).all();
    console.log(`Found ${songs.length} song(s) by exact event_id match`);
    songs.forEach(s => {
      console.log(`  [${s.id}] title="${s.fields[SONGS_FID.title]}" class_id="${s.fields[SONGS_FID.class_id]}" event_id="${s.fields[SONGS_FID.event_id]}" event_link=${JSON.stringify(s.fields[SONGS_FID.event_link])}`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }

  // 3b. By event_link (linked record) pointing to known record ID
  console.log('\n--- 3b. Songs where event_link contains recQoFZsoYK88sQou ---');
  try {
    const songs = await base(SONGS_TABLE).select({
      filterByFormula: `FIND('${KNOWN_RECORD_ID}', ARRAYJOIN({${SONGS_FID.event_link}}))`,
      returnFieldsByFieldId: true,
    }).all();
    console.log(`Found ${songs.length} song(s) by event_link match`);
    songs.forEach(s => {
      console.log(`  [${s.id}] title="${s.fields[SONGS_FID.title]}" class_id="${s.fields[SONGS_FID.class_id]}" event_id="${s.fields[SONGS_FID.event_id]}" event_link=${JSON.stringify(s.fields[SONGS_FID.event_link])}`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }

  // 3c. Partial match on event_id containing "herzla"
  console.log('\n--- 3c. Songs where event_id contains "herzla" (partial) ---');
  try {
    const songs = await base(SONGS_TABLE).select({
      filterByFormula: `SEARCH('herzla', LOWER({${SONGS_FID.event_id}}))`,
      returnFieldsByFieldId: true,
    }).all();
    console.log(`Found ${songs.length} song(s) with "herzla" in event_id`);
    songs.forEach(s => {
      console.log(`  [${s.id}] title="${s.fields[SONGS_FID.title]}" class_id="${s.fields[SONGS_FID.class_id]}" event_id="${s.fields[SONGS_FID.event_id]}" event_link=${JSON.stringify(s.fields[SONGS_FID.event_link])}`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }

  // 3d. Songs with "nikolaus" in event_id
  console.log('\n--- 3d. Songs where event_id contains "nikolaus" ---');
  try {
    const songs = await base(SONGS_TABLE).select({
      filterByFormula: `SEARCH('nikolaus', LOWER({${SONGS_FID.event_id}}))`,
      returnFieldsByFieldId: true,
    }).all();
    console.log(`Found ${songs.length} song(s) with "nikolaus" in event_id`);
    songs.forEach(s => {
      console.log(`  [${s.id}] title="${s.fields[SONGS_FID.title]}" class_id="${s.fields[SONGS_FID.class_id]}" event_id="${s.fields[SONGS_FID.event_id]}" event_link=${JSON.stringify(s.fields[SONGS_FID.event_link])}`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }

  // 3e. Brute force: scan ALL songs and find any referencing herzla
  console.log('\n--- 3e. Brute force scan: ALL songs checked for "herzla" in any field ---');
  try {
    const allSongs = await base(SONGS_TABLE).select({
      returnFieldsByFieldId: true,
    }).all();
    console.log(`Total songs in table: ${allSongs.length}`);

    const matches = allSongs.filter(s => {
      const eventId = (s.fields[SONGS_FID.event_id] || '').toLowerCase();
      const title = (s.fields[SONGS_FID.title] || '').toLowerCase();
      const classId = (s.fields[SONGS_FID.class_id] || '').toLowerCase();
      return eventId.includes('herzla') || eventId.includes('nikolaus') ||
             title.includes('herzla') || title.includes('nikolaus') ||
             classId.includes('herzla') || classId.includes('nikolaus');
    });

    console.log(`Matches found: ${matches.length}`);
    matches.forEach(s => {
      console.log(`  [${s.id}] title="${s.fields[SONGS_FID.title]}" class_id="${s.fields[SONGS_FID.class_id]}" event_id="${s.fields[SONGS_FID.event_id]}" event_link=${JSON.stringify(s.fields[SONGS_FID.event_link])}`);
    });

    // Also check if any songs link to the known record ID
    const linkedToKnown = allSongs.filter(s => {
      const eventLink = s.fields[SONGS_FID.event_link] || [];
      return Array.isArray(eventLink) && eventLink.includes(KNOWN_RECORD_ID);
    });
    console.log(`\nSongs linked to ${KNOWN_RECORD_ID}: ${linkedToKnown.length}`);
    linkedToKnown.forEach(s => {
      console.log(`  [${s.id}] title="${s.fields[SONGS_FID.title]}" class_id="${s.fields[SONGS_FID.class_id]}" event_id="${s.fields[SONGS_FID.event_id]}"`);
    });
  } catch (err) {
    console.error('Error during brute force scan:', err.message);
  }

  // =========================================================================
  // 4. Search Classes table
  // =========================================================================
  separator('4. CLASSES TABLE - Search for Herzlake/Nikolaus classes');

  try {
    const classes = await base(CLASSES_TABLE).select({
      filterByFormula: `OR(SEARCH('herzla', LOWER({${CLASSES_FID.class_id}})), SEARCH('nikolaus', LOWER({${CLASSES_FID.class_id}})), SEARCH('herzla', LOWER({${CLASSES_FID.class_name}})), SEARCH('nikolaus', LOWER({${CLASSES_FID.class_name}})))`,
      returnFieldsByFieldId: true,
    }).all();

    console.log(`Found ${classes.length} class(es):`);
    classes.forEach(c => {
      console.log(`  [${c.id}] class_id="${c.fields[CLASSES_FID.class_id]}" class_name="${c.fields[CLASSES_FID.class_name]}"`);
      // Dump all fields
      for (const [key, value] of Object.entries(c.fields)) {
        if (key !== CLASSES_FID.class_id && key !== CLASSES_FID.class_name) {
          console.log(`    ${key}: ${JSON.stringify(value)}`);
        }
      }
    });
  } catch (err) {
    console.error('Error searching Classes:', err.message);
  }

  // =========================================================================
  // 5. Search AudioFiles table
  // =========================================================================
  separator('5. AUDIO FILES TABLE - Search for Herzlake audio');

  // 5a. By exact event_id
  console.log('\n--- 5a. AudioFiles where event_id = known event_id ---');
  try {
    const audio = await base(AUDIO_FILES_TABLE).select({
      filterByFormula: `{${AUDIO_FID.event_id}} = '${KNOWN_EVENT_ID}'`,
      returnFieldsByFieldId: true,
    }).all();
    console.log(`Found ${audio.length} audio file(s) by exact event_id`);
    audio.forEach(a => {
      console.log(`  [${a.id}] filename="${a.fields[AUDIO_FID.filename]}" type="${a.fields[AUDIO_FID.type]}" event_id="${a.fields[AUDIO_FID.event_id]}" class_id="${a.fields[AUDIO_FID.class_id]}"`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }

  // 5b. Partial match on event_id containing "herzla"
  console.log('\n--- 5b. AudioFiles where event_id contains "herzla" ---');
  try {
    const audio = await base(AUDIO_FILES_TABLE).select({
      filterByFormula: `SEARCH('herzla', LOWER({${AUDIO_FID.event_id}}))`,
      returnFieldsByFieldId: true,
    }).all();
    console.log(`Found ${audio.length} audio file(s) with "herzla" in event_id`);
    audio.forEach(a => {
      console.log(`  [${a.id}] filename="${a.fields[AUDIO_FID.filename]}" type="${a.fields[AUDIO_FID.type]}" event_id="${a.fields[AUDIO_FID.event_id]}" class_id="${a.fields[AUDIO_FID.class_id]}"`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }

  // 5c. By event_link to known record
  console.log('\n--- 5c. AudioFiles where event_link contains recQoFZsoYK88sQou ---');
  try {
    const audio = await base(AUDIO_FILES_TABLE).select({
      filterByFormula: `FIND('${KNOWN_RECORD_ID}', ARRAYJOIN({${AUDIO_FID.event_link}}))`,
      returnFieldsByFieldId: true,
    }).all();
    console.log(`Found ${audio.length} audio file(s) linked to known record`);
    audio.forEach(a => {
      console.log(`  [${a.id}] filename="${a.fields[AUDIO_FID.filename]}" type="${a.fields[AUDIO_FID.type]}" event_id="${a.fields[AUDIO_FID.event_id]}" class_id="${a.fields[AUDIO_FID.class_id]}"`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }

  // =========================================================================
  // 6. Search SchoolBookings table
  // =========================================================================
  separator('6. SCHOOL BOOKINGS TABLE - Search for Herzlake/Nikolaus');

  try {
    const bookings = await base('SchoolBookings').select({
      filterByFormula: `OR(SEARCH('herzlake', LOWER({school_name})), SEARCH('nikolaus', LOWER({school_name})), SEARCH('herzlake', LOWER({school_contact_name})), SEARCH('nikolaus', LOWER({school_contact_name})))`,
    }).all();

    console.log(`Found ${bookings.length} booking(s):`);
    bookings.forEach(b => {
      console.log(`\n  Record ID: ${b.id}`);
      for (const [key, value] of Object.entries(b.fields)) {
        console.log(`    ${key}: ${JSON.stringify(value)}`);
      }
    });
  } catch (err) {
    console.error('Error searching SchoolBookings:', err.message);
  }

  // =========================================================================
  // 7. Cross-reference: What eventId does the engineer portal use?
  // =========================================================================
  separator('7. ANALYSIS: Engineer Portal Data Path');

  console.log(`
The engineer portal route (GET /api/engineer/events/[eventId]) does:
  1. getEngineerEventDetailOptimized(eventId, engineerId)
     - Queries Events table by event_id field
     - Checks assigned_engineer for authorization
     - Fetches linked classes from the Event record
  2. teacherService.getSongsByEventId(eventId)
     - Primary: queries Songs by text event_id = eventId
     - Fallback (if USE_NORMALIZED_TABLES=true): resolves event_id → record ID,
       then queries Songs by event_link = recordId

KEY QUESTION: Is the eventId being passed to the engineer route the correct one?
If there are duplicate events, the engineer might be viewing a different event_id
than the one that has songs attached.

Also: the event record has a 'classes' linked field. If that's empty, the engineer
portal will show 0 classes even if Classes records exist with matching class_ids.
`);

  // =========================================================================
  // 8. Check if there's a DIFFERENT event_id that songs might be under
  // =========================================================================
  separator('8. Check for similar event_ids in Songs table');

  try {
    // Search for any event_id containing "grundschule" AND "nikolaus"
    const songs = await base(SONGS_TABLE).select({
      filterByFormula: `AND(SEARCH('grundschule', LOWER({${SONGS_FID.event_id}})), SEARCH('nikolaus', LOWER({${SONGS_FID.event_id}})))`,
      returnFieldsByFieldId: true,
    }).all();
    console.log(`Songs with event_id containing "grundschule" AND "nikolaus": ${songs.length}`);
    songs.forEach(s => {
      console.log(`  [${s.id}] event_id="${s.fields[SONGS_FID.event_id]}" title="${s.fields[SONGS_FID.title]}" class_id="${s.fields[SONGS_FID.class_id]}"`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }

  // Check for any event_id starting with "evt_grundschule"
  console.log('\n--- Songs with event_id containing "grundschule_st" ---');
  try {
    const songs = await base(SONGS_TABLE).select({
      filterByFormula: `SEARCH('grundschule_st', LOWER({${SONGS_FID.event_id}}))`,
      returnFieldsByFieldId: true,
    }).all();
    console.log(`Found ${songs.length} song(s)`);
    songs.forEach(s => {
      console.log(`  [${s.id}] event_id="${s.fields[SONGS_FID.event_id]}" title="${s.fields[SONGS_FID.title]}"`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }

  // =========================================================================
  // 9. Check ALL events table for duplicates (same school, close dates)
  // =========================================================================
  separator('9. Check for ALL events with "grundschule" AND "nikolaus"');

  try {
    const events = await base('Events').select({
      filterByFormula: `AND(SEARCH('grundschule', LOWER({school_name})), SEARCH('nikolaus', LOWER({school_name})))`,
    }).all();
    console.log(`Found ${events.length} event(s) with "Grundschule" AND "Nikolaus":`);
    events.forEach(e => {
      const classes = e.get('classes') || [];
      const engineers = e.get('assigned_engineer') || [];
      console.log(`  [${e.id}] event_id="${e.get('event_id')}" date=${e.get('event_date')} status=${e.get('status')} classes=${classes.length} engineers=${engineers.length}`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }

  separator('INVESTIGATION COMPLETE');
}

main().catch(console.error);
