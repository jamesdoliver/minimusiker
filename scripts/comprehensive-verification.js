/**
 * Comprehensive Class, Song & Group Verification Script
 *
 * Tests all aspects of the class management system
 */

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Table IDs
const CLASSES_TABLE_ID = 'tbl17SVI5gacwOP0n';
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const SCHOOL_BOOKINGS_TABLE_ID = 'tblrktl5eLJEWE4M6';
const SONGS_TABLE_ID = 'tblPjGWQlHuG8jp5X';
const GROUPS_TABLE_ID = 'tblAPwTzqYTHbaz2k';
const AUDIO_FILES_TABLE_ID = 'tbloCM4tmH7mYoyXR';

// Field IDs
const CLASSES_FIELD_IDS = {
  class_id: 'fld1dXGae9I7xldun',
  event_id: 'fldSSaeBuQDkOhOIT',
  class_name: 'fld1kaSb8my7q5mHt',
  legacy_booking_id: 'fldXGF3yXrHeI4vWn',
  total_children: 'flddABwj9UilV2OtG',
  is_default: 'fldJouWNH4fudWQl0',
};

const SONGS_FIELD_IDS = {
  title: 'fldLjwkTwckDqT3Xl',
  class_id: 'fldK4wCT5oKZDN6sE',
  event_id: 'fldCKN3IXHPczIWfs',
  artist: 'fld8kOwPLIscK51yH',
  notes: 'fldZRLk0JP05VRDm6',
  order: 'fld2RSJGY8pAqBaej',
};

const GROUPS_FIELD_IDS = {
  group_id: 'fld6BW3r6uAADjuMx',
  group_name: 'fldiqq6p37u8G6iGs',
  event_id: 'fld1wQzJMIA4uCNeQ',
  member_classes: 'fldyeuP6wYE3DRrXX',
  created_by: 'flduZ1riZm12QWD5Y',
};

// Test results
const results = {
  passed: [],
  failed: [],
  warnings: [],
};

function pass(test, details = '') {
  results.passed.push({ test, details });
  console.log(`✅ PASS: ${test}${details ? ` - ${details}` : ''}`);
}

function fail(test, details = '') {
  results.failed.push({ test, details });
  console.log(`❌ FAIL: ${test}${details ? ` - ${details}` : ''}`);
}

function warn(test, details = '') {
  results.warnings.push({ test, details });
  console.log(`⚠️  WARN: ${test}${details ? ` - ${details}` : ''}`);
}

async function main() {
  const testEventId = process.argv[2] || 'evt_gs_buchhaltung_minimusiker_20260330_d563af';

  console.log('='.repeat(70));
  console.log('COMPREHENSIVE CLASS, SONG & GROUP VERIFICATION');
  console.log('='.repeat(70));
  console.log(`Test Event ID: ${testEventId}`);
  console.log('');

  // =====================================================
  // PHASE 1: EVENT VERIFICATION
  // =====================================================
  console.log('\n' + '─'.repeat(70));
  console.log('PHASE 1: EVENT & DATA INTEGRITY');
  console.log('─'.repeat(70));

  // 1.1 Verify Event exists
  const eventRecords = await base(EVENTS_TABLE_ID).select({
    filterByFormula: `{event_id} = "${testEventId}"`,
    maxRecords: 1,
  }).firstPage();

  if (eventRecords.length > 0) {
    pass('Event exists', `Record ID: ${eventRecords[0].id}`);
    const event = eventRecords[0];

    // Check linked SchoolBooking
    const linkedBookings = event.get('simplybook_booking');
    if (linkedBookings && linkedBookings.length > 0) {
      pass('Event linked to SchoolBooking', `Booking ID: ${linkedBookings[0]}`);

      // Get SchoolBooking details
      const bookingRecords = await base(SCHOOL_BOOKINGS_TABLE_ID).select({
        filterByFormula: `RECORD_ID() = '${linkedBookings[0]}'`,
        maxRecords: 1,
        returnFieldsByFieldId: true,
      }).firstPage();

      if (bookingRecords.length > 0) {
        const simplybookId = bookingRecords[0].fields['fldb5FI6ij00eICaT'];
        pass('SchoolBooking found', `SimplyBook ID: ${simplybookId}`);
      }
    } else {
      warn('Event not linked to SchoolBooking');
    }
  } else {
    fail('Event does not exist');
    return;
  }

  // =====================================================
  // PHASE 2: CLASSES VERIFICATION
  // =====================================================
  console.log('\n' + '─'.repeat(70));
  console.log('PHASE 2: CLASSES VERIFICATION');
  console.log('─'.repeat(70));

  // Get all classes for this event (using both possible identifiers)
  const classRecords = await base(CLASSES_TABLE_ID).select({
    filterByFormula: `OR({${CLASSES_FIELD_IDS.legacy_booking_id}} = '${testEventId}', {${CLASSES_FIELD_IDS.legacy_booking_id}} = '1748')`,
    returnFieldsByFieldId: true,
  }).all();

  console.log(`\nFound ${classRecords.length} classes for event`);

  if (classRecords.length > 0) {
    pass('Classes found', `Count: ${classRecords.length}`);

    // Check each class has required fields
    let validClasses = 0;
    let defaultClassFound = false;

    for (const cls of classRecords) {
      const classId = cls.fields[CLASSES_FIELD_IDS.class_id];
      const className = cls.fields[CLASSES_FIELD_IDS.class_name];
      const legacyBookingId = cls.fields[CLASSES_FIELD_IDS.legacy_booking_id];
      const eventIdLink = cls.fields[CLASSES_FIELD_IDS.event_id];
      const isDefault = cls.fields[CLASSES_FIELD_IDS.is_default];

      if (isDefault) defaultClassFound = true;

      if (classId && className && legacyBookingId) {
        validClasses++;
      } else {
        warn(`Class missing fields`, `Record: ${cls.id}, classId: ${classId}, className: ${className}`);
      }

      // Check linked record to Events
      if (eventIdLink && eventIdLink.length > 0) {
        // Linked record exists
      } else {
        warn(`Class not linked to Event`, `class_id: ${classId}`);
      }
    }

    pass('Class field validation', `${validClasses}/${classRecords.length} classes have all required fields`);

    if (defaultClassFound) {
      pass('Default "Alle Kinder" class exists');
    } else {
      warn('No default "Alle Kinder" class found');
    }

    // Print class summary
    console.log('\nClass Summary:');
    for (const cls of classRecords.slice(0, 5)) {
      const classId = cls.fields[CLASSES_FIELD_IDS.class_id];
      const className = cls.fields[CLASSES_FIELD_IDS.class_name];
      const totalChildren = cls.fields[CLASSES_FIELD_IDS.total_children] || 'N/A';
      const isDefault = cls.fields[CLASSES_FIELD_IDS.is_default] ? ' (DEFAULT)' : '';
      console.log(`  - ${className}: ${totalChildren} children${isDefault}`);
    }
    if (classRecords.length > 5) {
      console.log(`  ... and ${classRecords.length - 5} more classes`);
    }
  } else {
    fail('No classes found for event');
  }

  // =====================================================
  // PHASE 3: SONGS VERIFICATION
  // =====================================================
  console.log('\n' + '─'.repeat(70));
  console.log('PHASE 3: SONGS VERIFICATION');
  console.log('─'.repeat(70));

  // Get all songs for this event
  const songRecords = await base(SONGS_TABLE_ID).select({
    filterByFormula: `OR({${SONGS_FIELD_IDS.event_id}} = '${testEventId}', {${SONGS_FIELD_IDS.event_id}} = '1748')`,
    returnFieldsByFieldId: true,
  }).all();

  console.log(`\nFound ${songRecords.length} songs for event`);

  if (songRecords.length > 0) {
    pass('Songs found', `Count: ${songRecords.length}`);

    // Group songs by class
    const songsByClass = {};
    for (const song of songRecords) {
      const classId = song.fields[SONGS_FIELD_IDS.class_id];
      if (!songsByClass[classId]) songsByClass[classId] = [];
      songsByClass[classId].push(song);
    }

    console.log('\nSongs by Class:');
    for (const [classId, songs] of Object.entries(songsByClass)) {
      const isGroup = classId && classId.startsWith('group_');
      console.log(`  ${isGroup ? '📁 Group' : '📚 Class'} ${classId}: ${songs.length} song(s)`);
      for (const song of songs.slice(0, 2)) {
        const title = song.fields[SONGS_FIELD_IDS.title];
        const artist = song.fields[SONGS_FIELD_IDS.artist] || 'Unknown';
        console.log(`    - "${title}" by ${artist}`);
      }
      if (songs.length > 2) console.log(`    ... and ${songs.length - 2} more`);
    }

    // Verify song-class linkage
    for (const song of songRecords) {
      const songClassId = song.fields[SONGS_FIELD_IDS.class_id];
      if (!songClassId) {
        warn('Song without class_id', `Song: ${song.fields[SONGS_FIELD_IDS.title]}`);
      }
    }
  } else {
    warn('No songs found for event');
  }

  // =====================================================
  // PHASE 4: GROUPS VERIFICATION
  // =====================================================
  console.log('\n' + '─'.repeat(70));
  console.log('PHASE 4: GROUPS ("Classes Singing Together") VERIFICATION');
  console.log('─'.repeat(70));

  // Get all groups - need to fetch all and filter in JS because linked record
  const allGroups = await base(GROUPS_TABLE_ID).select({
    returnFieldsByFieldId: true,
  }).all();

  // Filter groups for this event (check linked event record)
  const eventRecord = eventRecords[0];
  const groupsForEvent = allGroups.filter(group => {
    const linkedEvents = group.fields[GROUPS_FIELD_IDS.event_id];
    return linkedEvents && linkedEvents.includes(eventRecord.id);
  });

  console.log(`\nFound ${groupsForEvent.length} groups for event`);

  if (groupsForEvent.length > 0) {
    pass('Groups found', `Count: ${groupsForEvent.length}`);

    for (const group of groupsForEvent) {
      const groupId = group.fields[GROUPS_FIELD_IDS.group_id];
      const groupName = group.fields[GROUPS_FIELD_IDS.group_name];
      const memberClasses = group.fields[GROUPS_FIELD_IDS.member_classes] || [];

      console.log(`\n  📁 Group: ${groupName}`);
      console.log(`     ID: ${groupId}`);
      console.log(`     Member Classes: ${memberClasses.length}`);

      if (memberClasses.length >= 2) {
        pass(`Group "${groupName}" has ≥2 members`);
      } else {
        fail(`Group "${groupName}" has <2 members`, `Count: ${memberClasses.length}`);
      }

      // Check for songs on this group
      const groupSongs = songRecords.filter(s => s.fields[SONGS_FIELD_IDS.class_id] === groupId);
      if (groupSongs.length > 0) {
        pass(`Group "${groupName}" has songs`, `Count: ${groupSongs.length}`);
      } else {
        warn(`Group "${groupName}" has no songs`);
      }
    }
  } else {
    warn('No groups found for event');
  }

  // =====================================================
  // PHASE 5: AUDIO FILES VERIFICATION
  // =====================================================
  console.log('\n' + '─'.repeat(70));
  console.log('PHASE 5: AUDIO FILES VERIFICATION');
  console.log('─'.repeat(70));

  const audioRecords = await base(AUDIO_FILES_TABLE_ID).select({
    filterByFormula: `OR({event_id} = '${testEventId}', {event_id} = '1748')`,
    returnFieldsByFieldId: true,
  }).all();

  console.log(`\nFound ${audioRecords.length} audio files for event`);

  if (audioRecords.length > 0) {
    pass('Audio files found', `Count: ${audioRecords.length}`);

    // Group by type
    const byType = { raw: 0, preview: 0, final: 0 };
    for (const audio of audioRecords) {
      const type = audio.fields['fldOMmFN7BqHVAqfH']; // type field
      if (byType[type] !== undefined) byType[type]++;
    }
    console.log(`  Raw: ${byType.raw}, Preview: ${byType.preview}, Final: ${byType.final}`);
  } else {
    warn('No audio files found for event');
  }

  // =====================================================
  // SUMMARY
  // =====================================================
  console.log('\n' + '='.repeat(70));
  console.log('VERIFICATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);

  if (results.failed.length > 0) {
    console.log('\nFailed Tests:');
    for (const f of results.failed) {
      console.log(`  - ${f.test}: ${f.details}`);
    }
  }

  if (results.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const w of results.warnings) {
      console.log(`  - ${w.test}: ${w.details}`);
    }
  }

  console.log('\n' + '='.repeat(70));

  // Return exit code
  process.exit(results.failed.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
