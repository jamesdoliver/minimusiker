require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const SONGS_TABLE_ID = 'tblPjGWQlHuG8jp5X';

const SONGS_FIELD_IDS = {
  title: 'fldLjwkTwckDqT3Xl',
  class_id: 'fldK4wCT5oKZDN6sE',
  event_id: 'fldCKN3IXHPczIWfs',
  artist: 'fld8kOwPLIscK51yH',
  notes: 'fldZRLk0JP05VRDm6',
};

async function main() {
  const searchTerm = process.argv[2] || 'Verification Test Song';

  console.log('Searching for songs containing: "' + searchTerm + '"\n');

  const records = await base(SONGS_TABLE_ID).select({
    filterByFormula: 'SEARCH("' + searchTerm + '", {' + SONGS_FIELD_IDS.title + '}) > 0',
    returnFieldsByFieldId: true,
  }).all();

  if (records.length === 0) {
    console.log('No songs found matching search term.\n');

    // Also get recent songs for this event
    console.log('Checking recent songs for TEST-EVENT-001...\n');
    const eventSongs = await base(SONGS_TABLE_ID).select({
      filterByFormula: '{' + SONGS_FIELD_IDS.event_id + '} = "TEST-EVENT-001"',
      returnFieldsByFieldId: true,
    }).all();

    console.log('Found ' + eventSongs.length + ' songs for event TEST-EVENT-001:');
    for (const song of eventSongs) {
      console.log('  - ' + song.fields[SONGS_FIELD_IDS.title] + ' (class: ' + song.fields[SONGS_FIELD_IDS.class_id] + ')');
    }
    return;
  }

  console.log('SUCCESS: Found ' + records.length + ' matching song(s)\n');

  for (const record of records) {
    console.log('Record ID: ' + record.id);
    console.log('  title: ' + record.fields[SONGS_FIELD_IDS.title]);
    console.log('  class_id: ' + record.fields[SONGS_FIELD_IDS.class_id]);
    console.log('  event_id: ' + record.fields[SONGS_FIELD_IDS.event_id]);
    console.log('  artist: ' + record.fields[SONGS_FIELD_IDS.artist]);
    console.log('  notes: ' + record.fields[SONGS_FIELD_IDS.notes]);
    console.log('---');
  }
}

main().catch(console.error);
