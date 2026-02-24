/**
 * Fix Script: Update Herzlake songs from legacy event_id "1718" to new format
 *
 * Updates:
 * - 10 songs: event_id "1718" → "evt_grundschule_st_nikolaus_herzla_minimusiker_20260211_0c85ab"
 *             event_link → [recQoFZsoYK88sQou]
 * - 1 audio file: event_link → [recQoFZsoYK88sQou]
 */
require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');
const readline = require('readline');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const SONGS_TABLE = 'tblPjGWQlHuG8jp5X';
const AUDIO_FILES_TABLE = 'tbloCM4tmH7mYoyXR';

const SONGS_FID = {
  title: 'fldLjwkTwckDqT3Xl',
  class_id: 'fldK4wCT5oKZDN6sE',
  event_id: 'fldCKN3IXHPczIWfs',
  event_link: 'fldygKERszsLFRBaS',
};

const AUDIO_FID = {
  event_id: 'fldwtYA1GwhVf3Ia7',
  event_link: 'fldTFdrvuzIWd9WbK',
  filename: 'fldOTWiFz8G1lE04c',
};

const NEW_EVENT_ID = 'evt_grundschule_st_nikolaus_herzla_minimusiker_20260211_0c85ab';
const EVENT_RECORD_ID = 'recQoFZsoYK88sQou';
const OLD_EVENT_ID = '1718';

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

async function main() {
  console.log('=== Fix Herzlake Songs: Migrate event_id ===\n');
  console.log(`Old event_id: "${OLD_EVENT_ID}"`);
  console.log(`New event_id: "${NEW_EVENT_ID}"`);
  console.log(`Event record:  ${EVENT_RECORD_ID}\n`);

  // Step 1: Find all songs with old event_id
  const songs = await base(SONGS_TABLE).select({
    filterByFormula: `{${SONGS_FID.event_id}} = '${OLD_EVENT_ID}'`,
    returnFieldsByFieldId: true,
  }).all();

  console.log(`Found ${songs.length} songs with event_id = "${OLD_EVENT_ID}":\n`);
  songs.forEach((s) => {
    console.log(`  [${s.id}] ${s.fields[SONGS_FID.title] || 'Untitled'}`);
    console.log(`    class_id:   ${s.fields[SONGS_FID.class_id] || 'N/A'}`);
    console.log(`    event_id:   ${s.fields[SONGS_FID.event_id]}`);
    console.log(`    event_link: ${JSON.stringify(s.fields[SONGS_FID.event_link] || 'NOT SET')}`);
  });

  // Step 2: Find audio files with old event_id
  const audioFiles = await base(AUDIO_FILES_TABLE).select({
    filterByFormula: `{${AUDIO_FID.event_id}} = '${OLD_EVENT_ID}'`,
    returnFieldsByFieldId: true,
  }).all();

  // Also find audio files that already have the new event_id but no event_link
  const audioFilesNew = await base(AUDIO_FILES_TABLE).select({
    filterByFormula: `{${AUDIO_FID.event_id}} = '${NEW_EVENT_ID}'`,
    returnFieldsByFieldId: true,
  }).all();

  const allAudio = [...audioFiles, ...audioFilesNew];

  console.log(`\nFound ${audioFiles.length} audio files with event_id = "${OLD_EVENT_ID}"`);
  console.log(`Found ${audioFilesNew.length} audio files with event_id = "${NEW_EVENT_ID}"`);
  allAudio.forEach((a) => {
    console.log(`  [${a.id}] ${a.fields[AUDIO_FID.filename] || 'Unknown'}`);
    console.log(`    event_id:   ${a.fields[AUDIO_FID.event_id]}`);
    console.log(`    event_link: ${JSON.stringify(a.fields[AUDIO_FID.event_link] || 'NOT SET')}`);
  });

  // Step 3: Summary & confirmation
  const songsToUpdate = songs.length;
  const audioToUpdateEventId = audioFiles.length;
  const audioToUpdateLink = allAudio.filter(a => !a.fields[AUDIO_FID.event_link]).length;

  console.log('\n=== UPDATE PLAN ===');
  console.log(`Songs: Update ${songsToUpdate} records`);
  console.log(`  - Set event_id = "${NEW_EVENT_ID}"`);
  console.log(`  - Set event_link = ["${EVENT_RECORD_ID}"]`);
  console.log(`Audio: Update event_id on ${audioToUpdateEventId} records`);
  console.log(`Audio: Set event_link on ${audioToUpdateLink} records without one`);

  if (songsToUpdate === 0 && audioToUpdateEventId === 0 && audioToUpdateLink === 0) {
    console.log('\nNothing to update. All records already correct.');
    return;
  }

  const answer = await ask('\nProceed with updates? (yes/no): ');
  if (answer.toLowerCase() !== 'yes') {
    console.log('Aborted.');
    return;
  }

  // Step 4: Update songs in batches of 10
  console.log('\nUpdating songs...');
  for (let i = 0; i < songs.length; i += 10) {
    const batch = songs.slice(i, i + 10).map((s) => ({
      id: s.id,
      fields: {
        [SONGS_FID.event_id]: NEW_EVENT_ID,
        [SONGS_FID.event_link]: [EVENT_RECORD_ID],
      },
    }));
    await base(SONGS_TABLE).update(batch);
    console.log(`  Updated songs ${i + 1}-${Math.min(i + 10, songs.length)} of ${songs.length}`);
  }

  // Step 5: Update audio files
  console.log('Updating audio files...');
  for (const audio of allAudio) {
    const fields = {};
    if (audio.fields[AUDIO_FID.event_id] === OLD_EVENT_ID) {
      fields[AUDIO_FID.event_id] = NEW_EVENT_ID;
    }
    if (!audio.fields[AUDIO_FID.event_link]) {
      fields[AUDIO_FID.event_link] = [EVENT_RECORD_ID];
    }
    if (Object.keys(fields).length > 0) {
      await base(AUDIO_FILES_TABLE).update(audio.id, fields);
      console.log(`  Updated audio: ${audio.fields[AUDIO_FID.filename]}`);
    }
  }

  // Step 6: Verify
  console.log('\n=== VERIFICATION ===');
  const verifySongs = await base(SONGS_TABLE).select({
    filterByFormula: `{${SONGS_FID.event_id}} = '${NEW_EVENT_ID}'`,
    returnFieldsByFieldId: true,
  }).all();

  console.log(`Songs with new event_id: ${verifySongs.length}`);
  const withLink = verifySongs.filter(s => s.fields[SONGS_FID.event_link]?.length > 0).length;
  console.log(`Songs with event_link set: ${withLink}`);

  const verifyOld = await base(SONGS_TABLE).select({
    filterByFormula: `{${SONGS_FID.event_id}} = '${OLD_EVENT_ID}'`,
    returnFieldsByFieldId: true,
  }).all();
  console.log(`Songs still with old event_id: ${verifyOld.length}`);

  console.log('\n=== Done! ===');
}

main().catch(console.error);
