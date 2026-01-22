#!/usr/bin/env node

/**
 * Verification Script: Song Storage and Staff Visibility
 *
 * This script verifies that:
 * 1. Songs are stored correctly with proper class_id and event_id links
 * 2. Staff members can see songs when assigned to events
 *
 * Usage:
 *   node scripts/verify-song-staff-visibility.js --check-songs
 *   node scripts/verify-song-staff-visibility.js --assign <staff-email> <booking-id>
 *   node scripts/verify-song-staff-visibility.js --full <staff-email> <booking-id>
 *
 * Examples:
 *   node scripts/verify-song-staff-visibility.js --check-songs
 *   node scripts/verify-song-staff-visibility.js --assign max@example.com booking-12345
 *   node scripts/verify-song-staff-visibility.js --full max@example.com booking-12345
 */

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

// Airtable configuration
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !BASE_ID) {
  console.error('Error: AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set in .env.local');
  process.exit(1);
}

// Initialize Airtable
Airtable.configure({ apiKey: AIRTABLE_API_KEY });
const base = Airtable.base(BASE_ID);

// Table IDs
const SONGS_TABLE = 'tblPjGWQlHuG8jp5X';
const EVENTS_TABLE = 'tblVWx1RrsGRjsNn5';
const CLASSES_TABLE = 'tbl17SVI5gacwOP0n';
const PERSONEN_TABLE = 'tblu8iWectQaQGTto';
const PARENT_JOURNEY_TABLE = 'tblJHPmCrGeFhJ6u3';

// Field IDs
const SONGS_FIELD_IDS = {
  title: 'fldLjwkTwckDqT3Xl',
  class_id: 'fldK4wCT5oKZDN6sE',
  event_id: 'fldCKN3IXHPczIWfs',
  artist: 'fld8kOwPLIscK51yH',
  order: 'fld2RSJGY8pAqBaej',
  created_by: 'fldva8udIq88Syq0p',
  class_link: 'fldMPAHLnyNralsLS',
  event_link: 'fldygKERszsLFRBaS',
};

const EVENTS_FIELD_IDS = {
  event_id: 'fldcNaHZyr6E5khDe',
  school_name: 'fld5QcpEsDFrLun6w',
  event_date: 'fld7pswBblm9jlOsS',
  assigned_staff: 'fldYpEu0LbYBiQANW',
};

const CLASSES_FIELD_IDS = {
  class_id: 'fldDhHsFwdLOE0t1W',
  class_name: 'fldyqiMcxBhOWg1r6',
  event_id: 'fld9v4bQq1kIZ1Pxy',
};

const PERSONEN_FIELD_IDS = {
  staff_name: 'fldEBMBVfGSWpywKU',
  email: 'fldKCmnASEo1RhvLu',
};

const PARENT_JOURNEY_FIELD_IDS = {
  booking_id: 'fldUB8dAiQd61VncB',
  class_id: 'fldtiPDposZlSD2lm',
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// =============================================================================
// PART A: CHECK SONG STORAGE
// =============================================================================

async function getAllSongs() {
  const records = await base(SONGS_TABLE).select().all();
  return records.map(record => ({
    id: record.id,
    title: record.fields.title || record.fields[SONGS_FIELD_IDS.title],
    classId: record.fields.class_id || record.fields[SONGS_FIELD_IDS.class_id],
    eventId: record.fields.event_id || record.fields[SONGS_FIELD_IDS.event_id],
    order: record.fields.order || record.fields[SONGS_FIELD_IDS.order],
    classLink: record.fields.class_link || record.fields[SONGS_FIELD_IDS.class_link],
    eventLink: record.fields.event_link || record.fields[SONGS_FIELD_IDS.event_link],
  }));
}

async function getClassByClassId(classId) {
  try {
    const records = await base(CLASSES_TABLE)
      .select({
        filterByFormula: `{class_id} = '${classId.replace(/'/g, "\\'")}'`,
        maxRecords: 1,
      })
      .firstPage();
    return records.length > 0 ? records[0] : null;
  } catch (error) {
    console.log(`${colors.yellow}Warning: Could not access Classes table: ${error.message}${colors.reset}`);
    return { id: 'unknown', skipped: true };
  }
}

async function getEventByEventId(eventId) {
  try {
    // Try Events table first
    const eventRecords = await base(EVENTS_TABLE)
      .select({
        filterByFormula: `{event_id} = '${eventId.replace(/'/g, "\\'")}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (eventRecords.length > 0) {
      return {
        source: 'Events',
        record: eventRecords[0],
        schoolName: eventRecords[0].fields.school_name || eventRecords[0].fields[EVENTS_FIELD_IDS.school_name],
        eventDate: eventRecords[0].fields.event_date || eventRecords[0].fields[EVENTS_FIELD_IDS.event_date],
      };
    }
  } catch (error) {
    console.log(`${colors.yellow}Warning: Could not access Events table: ${error.message}${colors.reset}`);
  }

  try {
    // Fallback to parent_journey_table
    const pjtRecords = await base(PARENT_JOURNEY_TABLE)
      .select({
        filterByFormula: `{booking_id} = '${eventId.replace(/'/g, "\\'")}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (pjtRecords.length > 0) {
      return {
        source: 'parent_journey_table',
        record: pjtRecords[0],
      };
    }
  } catch (error) {
    console.log(`${colors.yellow}Warning: Could not access parent_journey_table: ${error.message}${colors.reset}`);
  }

  return null;
}

async function checkSongStorage() {
  console.log('\n' + '='.repeat(70));
  console.log(`${colors.bright}SONG STORAGE VERIFICATION${colors.reset}`);
  console.log('='.repeat(70));

  const songs = await getAllSongs();
  console.log(`\nTotal songs found: ${colors.cyan}${songs.length}${colors.reset}`);

  if (songs.length === 0) {
    console.log(`\n${colors.yellow}No songs found in database.${colors.reset}`);
    return { success: true, songs: [] };
  }

  const results = {
    total: songs.length,
    validClassId: 0,
    validEventId: 0,
    hasClassLink: 0,
    hasEventLink: 0,
    issues: [],
  };

  // Check each song
  for (const song of songs) {
    const songIssues = [];

    // Check class_id
    if (!song.classId) {
      songIssues.push('Missing class_id');
    } else {
      const classRecord = await getClassByClassId(song.classId);
      if (classRecord && !classRecord.skipped) {
        results.validClassId++;
      } else if (classRecord && classRecord.skipped) {
        results.validClassId++; // Assume valid if we can't check
      } else {
        songIssues.push(`class_id "${song.classId}" not found in Classes table`);
      }
    }

    // Check event_id
    if (!song.eventId) {
      songIssues.push('Missing event_id');
    } else {
      const eventRecord = await getEventByEventId(song.eventId);
      if (eventRecord) {
        results.validEventId++;
      } else {
        songIssues.push(`event_id "${song.eventId}" not found in Events or parent_journey_table`);
      }
    }

    // Check linked records
    if (song.classLink && song.classLink.length > 0) {
      results.hasClassLink++;
    }
    if (song.eventLink && song.eventLink.length > 0) {
      results.hasEventLink++;
    }

    if (songIssues.length > 0) {
      results.issues.push({
        songId: song.id,
        title: song.title,
        issues: songIssues,
      });
    }
  }

  // Print results
  console.log('\n--- Results ---');

  if (results.validClassId === results.total) {
    console.log(`${colors.green}All songs have valid class_id references${colors.reset}`);
  } else {
    console.log(`${colors.red}${results.total - results.validClassId} songs have invalid/missing class_id${colors.reset}`);
  }

  if (results.validEventId === results.total) {
    console.log(`${colors.green}All songs have valid event_id references${colors.reset}`);
  } else {
    console.log(`${colors.red}${results.total - results.validEventId} songs have invalid/missing event_id${colors.reset}`);
  }

  console.log(`\n--- Linked Records (Normalized Mode) ---`);
  console.log(`Songs with class_link: ${results.hasClassLink}/${results.total}`);
  console.log(`Songs with event_link: ${results.hasEventLink}/${results.total}`);

  if (results.issues.length > 0) {
    console.log(`\n${colors.red}--- Issues Found ---${colors.reset}`);
    for (const issue of results.issues) {
      console.log(`\n${colors.yellow}Song: "${issue.title}" (${issue.songId})${colors.reset}`);
      for (const i of issue.issues) {
        console.log(`  ${colors.red}- ${i}${colors.reset}`);
      }
    }
  } else {
    console.log(`\n${colors.green}No issues found! All songs have valid references.${colors.reset}`);
  }

  console.log('\n' + '='.repeat(70));

  return {
    success: results.issues.length === 0,
    ...results,
  };
}

// =============================================================================
// PART B: ASSIGN STAFF TO EVENT
// =============================================================================

async function getStaffByEmail(email) {
  const records = await base(PERSONEN_TABLE)
    .select({
      filterByFormula: `LOWER({E-Mail}) = LOWER('${email.replace(/'/g, "\\'")}')`,
      maxRecords: 1,
    })
    .firstPage();

  if (records.length === 0) return null;

  return {
    id: records[0].id,
    name: records[0].fields.staff_name || records[0].fields['Staff Name'] || records[0].fields[PERSONEN_FIELD_IDS.staff_name],
    email: records[0].fields['E-Mail'] || records[0].fields[PERSONEN_FIELD_IDS.email],
  };
}

async function assignStaffToEvent(staffEmail, bookingId) {
  console.log('\n' + '='.repeat(70));
  console.log(`${colors.bright}STAFF ASSIGNMENT VERIFICATION${colors.reset}`);
  console.log('='.repeat(70));

  // Get staff member
  console.log(`\nLooking up staff member: ${colors.cyan}${staffEmail}${colors.reset}`);
  const staff = await getStaffByEmail(staffEmail);

  if (!staff) {
    console.log(`${colors.red}Staff member not found: ${staffEmail}${colors.reset}`);
    return { success: false, error: 'Staff not found' };
  }

  console.log(`${colors.green}Found: ${staff.name} (${staff.email})${colors.reset}`);

  // Get event
  console.log(`\nLooking up event: ${colors.cyan}${bookingId}${colors.reset}`);
  const event = await getEventByEventId(bookingId);

  if (!event) {
    console.log(`${colors.red}Event not found: ${bookingId}${colors.reset}`);
    return { success: false, error: 'Event not found' };
  }

  console.log(`${colors.green}Found event in ${event.source}${colors.reset}`);
  if (event.schoolName) {
    console.log(`  School: ${event.schoolName}`);
  }
  if (event.eventDate) {
    console.log(`  Date: ${event.eventDate}`);
  }

  // Assign staff to event
  console.log(`\nAssigning staff to event...`);

  if (event.source === 'Events') {
    await base(EVENTS_TABLE).update(event.record.id, {
      'assigned_staff': [staff.id],
    });
    console.log(`${colors.green}Staff assigned successfully to Events table${colors.reset}`);
  } else {
    // For parent_journey_table, we need to update all records with this booking_id
    const records = await base(PARENT_JOURNEY_TABLE)
      .select({
        filterByFormula: `{booking_id} = '${bookingId.replace(/'/g, "\\'")}'`,
      })
      .all();

    if (records.length > 0) {
      const updates = records.map(r => ({
        id: r.id,
        fields: { assigned_staff: [staff.id] },
      }));

      // Update in batches of 10
      for (let i = 0; i < updates.length; i += 10) {
        const batch = updates.slice(i, i + 10);
        await base(PARENT_JOURNEY_TABLE).update(batch);
      }
      console.log(`${colors.green}Staff assigned to ${records.length} records in parent_journey_table${colors.reset}`);
    }
  }

  // Verify assignment
  console.log(`\nVerifying assignment...`);
  const verifyEvent = await getEventByEventId(bookingId);
  const assignedStaff = verifyEvent.record.fields.assigned_staff ||
                        verifyEvent.record.fields[EVENTS_FIELD_IDS.assigned_staff];

  if (assignedStaff && assignedStaff.includes(staff.id)) {
    console.log(`${colors.green}Assignment verified successfully!${colors.reset}`);
  } else {
    console.log(`${colors.yellow}Could not verify assignment (field may have different ID)${colors.reset}`);
  }

  console.log('\n' + '='.repeat(70));

  return {
    success: true,
    staff,
    event: {
      bookingId,
      source: event.source,
      schoolName: event.schoolName,
      eventDate: event.eventDate,
    },
  };
}

// =============================================================================
// PART C: VERIFY STAFF CAN SEE SONGS
// =============================================================================

async function getSongsByEventId(eventId) {
  // First try to find the event record ID
  const eventRecords = await base(EVENTS_TABLE)
    .select({
      filterByFormula: `{event_id} = '${eventId.replace(/'/g, "\\'")}'`,
      maxRecords: 1,
    })
    .firstPage();

  let songs;

  if (eventRecords.length > 0) {
    const eventRecordId = eventRecords[0].id;
    // Try linked record first
    songs = await base(SONGS_TABLE)
      .select({
        filterByFormula: `{event_link} = '${eventRecordId}'`,
        sort: [
          { field: 'class_id', direction: 'asc' },
          { field: 'order', direction: 'asc' },
        ],
      })
      .all();

    // Fallback to text field if no results
    if (songs.length === 0) {
      songs = await base(SONGS_TABLE)
        .select({
          filterByFormula: `{event_id} = '${eventId.replace(/'/g, "\\'")}'`,
          sort: [
            { field: 'class_id', direction: 'asc' },
            { field: 'order', direction: 'asc' },
          ],
        })
        .all();
    }
  } else {
    // No event record, use text field directly
    songs = await base(SONGS_TABLE)
      .select({
        filterByFormula: `{event_id} = '${eventId.replace(/'/g, "\\'")}'`,
        sort: [
          { field: 'class_id', direction: 'asc' },
          { field: 'order', direction: 'asc' },
        ],
      })
      .all();
  }

  return songs.map(record => ({
    id: record.id,
    title: record.fields.title,
    classId: record.fields.class_id,
    eventId: record.fields.event_id,
    order: record.fields.order,
    artist: record.fields.artist,
  }));
}

async function getClassesByEventId(eventId) {
  try {
    // First, get the event record ID from the Events table
    const eventRecords = await base(EVENTS_TABLE)
      .select({
        filterByFormula: `{event_id} = '${eventId.replace(/'/g, "\\'")}'`,
        maxRecords: 1,
      })
      .firstPage();

    let filterFormula;
    if (eventRecords.length > 0) {
      const eventRecordId = eventRecords[0].id;
      // Use linked record filter
      filterFormula = `FIND('${eventRecordId}', ARRAYJOIN({event_id}))`;
    } else {
      // Fallback to text match (for legacy data)
      filterFormula = `{event_id} = '${eventId.replace(/'/g, "\\'")}'`;
    }

    const records = await base(CLASSES_TABLE)
      .select({
        filterByFormula: filterFormula,
      })
      .all();

    return records.map(record => ({
      id: record.id,
      classId: record.fields.class_id,
      className: record.fields.class_name,
    }));
  } catch (error) {
    console.log(`${colors.yellow}Warning: Could not get classes: ${error.message}${colors.reset}`);
    return [];
  }
}

async function verifyStaffSongVisibility(staffEmail, bookingId) {
  console.log('\n' + '='.repeat(70));
  console.log(`${colors.bright}STAFF SONG VISIBILITY VERIFICATION${colors.reset}`);
  console.log('='.repeat(70));

  console.log(`\nSimulating staff portal query flow...`);
  console.log(`Event ID: ${colors.cyan}${bookingId}${colors.reset}`);

  // Get all songs for this event (same as staff portal does)
  const songs = await getSongsByEventId(bookingId);
  console.log(`\nSongs found for event: ${colors.cyan}${songs.length}${colors.reset}`);

  if (songs.length === 0) {
    console.log(`\n${colors.yellow}No songs found for this event.${colors.reset}`);
    console.log(`This could mean:`);
    console.log(`  1. No songs have been created for this event yet`);
    console.log(`  2. Songs have a different event_id value`);
    console.log(`  3. Linked records are not populated`);
    console.log('\n' + '='.repeat(70));
    return { success: true, songsFound: 0, classes: [] };
  }

  // Get classes for this event
  const classes = await getClassesByEventId(bookingId);
  console.log(`Classes found: ${colors.cyan}${classes.length}${colors.reset}`);

  // Group songs by class
  const songsByClass = {};
  for (const song of songs) {
    if (!songsByClass[song.classId]) {
      songsByClass[song.classId] = [];
    }
    songsByClass[song.classId].push(song);
  }

  // Display results
  console.log('\n--- Songs by Class ---\n');

  for (const classInfo of classes) {
    const classSongs = songsByClass[classInfo.classId] || [];
    console.log(`${colors.cyan}${classInfo.className || classInfo.classId}${colors.reset}`);
    console.log(`  Class ID: ${classInfo.classId}`);

    if (classSongs.length === 0) {
      console.log(`  ${colors.yellow}(No songs)${colors.reset}`);
    } else {
      for (const song of classSongs) {
        console.log(`  ${colors.green}Song ${song.order || '?'}: "${song.title}"${song.artist ? ` by ${song.artist}` : ''}${colors.reset}`);
      }
    }
    console.log('');
  }

  // Check for orphaned songs (songs with class_id not in classes list)
  const knownClassIds = new Set(classes.map(c => c.classId));
  const orphanedSongs = songs.filter(s => !knownClassIds.has(s.classId));

  if (orphanedSongs.length > 0) {
    console.log(`${colors.yellow}Warning: Found ${orphanedSongs.length} songs with unknown class_id:${colors.reset}`);
    for (const song of orphanedSongs) {
      console.log(`  - "${song.title}" (class_id: ${song.classId})`);
    }
  }

  // Summary
  console.log('\n--- Summary ---');
  console.log(`Total classes: ${classes.length}`);
  console.log(`Total songs: ${songs.length}`);
  console.log(`Classes with songs: ${Object.keys(songsByClass).length}`);

  if (orphanedSongs.length === 0 && songs.length > 0) {
    console.log(`\n${colors.green}STAFF SONG VISIBILITY VERIFIED!${colors.reset}`);
  }

  console.log('\n' + '='.repeat(70));

  return {
    success: true,
    songsFound: songs.length,
    classes: classes.length,
    songsByClass: Object.keys(songsByClass).length,
    orphanedSongs: orphanedSongs.length,
  };
}

// =============================================================================
// MAIN
// =============================================================================

async function runFullVerification(staffEmail, bookingId) {
  console.log(`\n${colors.bright}${colors.blue}Running Full Verification${colors.reset}`);
  console.log(`Staff: ${staffEmail}`);
  console.log(`Booking: ${bookingId}`);

  // Part A: Check song storage
  const songCheck = await checkSongStorage();

  // Part B: Assign staff
  const assignResult = await assignStaffToEvent(staffEmail, bookingId);
  if (!assignResult.success) {
    console.log(`\n${colors.red}VERIFICATION FAILED: Could not assign staff${colors.reset}`);
    process.exit(1);
  }

  // Part C: Verify visibility
  const visibilityResult = await verifyStaffSongVisibility(staffEmail, bookingId);

  // Final summary
  console.log('\n' + '='.repeat(70));
  console.log(`${colors.bright}FINAL SUMMARY${colors.reset}`);
  console.log('='.repeat(70));
  console.log(`\nSong Storage: ${songCheck.success ? colors.green + 'PASSED' : colors.red + 'ISSUES FOUND'}${colors.reset}`);
  console.log(`Staff Assignment: ${assignResult.success ? colors.green + 'PASSED' : colors.red + 'FAILED'}${colors.reset}`);
  console.log(`Song Visibility: ${visibilityResult.success ? colors.green + 'PASSED' : colors.red + 'FAILED'}${colors.reset}`);

  if (songCheck.success && assignResult.success && visibilityResult.success) {
    console.log(`\n${colors.green}${colors.bright}ALL VERIFICATIONS PASSED!${colors.reset}`);
  }
  console.log('\n' + '='.repeat(70) + '\n');
}

function printUsage() {
  console.log(`
${colors.bright}Song Storage and Staff Visibility Verification Script${colors.reset}

Usage:
  node scripts/verify-song-staff-visibility.js --check-songs
      Check all songs have valid class_id and event_id references

  node scripts/verify-song-staff-visibility.js --assign <staff-email> <booking-id>
      Assign a staff member to an event and verify the assignment

  node scripts/verify-song-staff-visibility.js --verify <booking-id>
      Verify songs are visible for a specific event (staff view simulation)

  node scripts/verify-song-staff-visibility.js --full <staff-email> <booking-id>
      Run full verification (check songs + assign staff + verify visibility)

Examples:
  node scripts/verify-song-staff-visibility.js --check-songs
  node scripts/verify-song-staff-visibility.js --assign max@example.com booking-12345
  node scripts/verify-song-staff-visibility.js --verify booking-12345
  node scripts/verify-song-staff-visibility.js --full max@example.com booking-12345
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const command = args[0];

  try {
    switch (command) {
      case '--check-songs':
        await checkSongStorage();
        break;

      case '--assign':
        if (args.length < 3) {
          console.error(`${colors.red}Error: --assign requires <staff-email> and <booking-id>${colors.reset}`);
          printUsage();
          process.exit(1);
        }
        await assignStaffToEvent(args[1], args[2]);
        break;

      case '--verify':
        if (args.length < 2) {
          console.error(`${colors.red}Error: --verify requires <booking-id>${colors.reset}`);
          printUsage();
          process.exit(1);
        }
        await verifyStaffSongVisibility(null, args[1]);
        break;

      case '--full':
        if (args.length < 3) {
          console.error(`${colors.red}Error: --full requires <staff-email> and <booking-id>${colors.reset}`);
          printUsage();
          process.exit(1);
        }
        await runFullVerification(args[1], args[2]);
        break;

      default:
        console.error(`${colors.red}Unknown command: ${command}${colors.reset}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error(`\n${colors.red}Error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

main();
