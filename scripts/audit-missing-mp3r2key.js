/**
 * Audit AudioFiles where teacher/parent portal would serve a .wav.
 *
 * The teacher download endpoint prefers `mp3_r2_key` then falls back to `r2_key`,
 * setting the user-visible extension to whichever the chosen key ends in. So a
 * .wav reaches the user iff:
 *   type='final' AND status='ready' AND mp3_r2_key is empty AND r2_key ends in .wav
 *
 * This script lists every such record, grouped by event, plus summary counts.
 * Read-only.
 */
const Airtable = require('airtable');
require('dotenv').config({ path: '.env.local' });

Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

const AUDIO_FILES_TABLE = 'tbloCM4tmH7mYoyXR';
const EVENTS_TABLE = 'tblVWx1RrsGRjsNn5';

const F = {
  type:        'fldOMmFN7BqHVAqfH',
  status:      'fldCAcEMu0IF1bWgz',
  r2_key:      'fldvzj75CspwfOfPX',
  mp3_r2_key:  'fldzADPZjKEZbfy2i',
  filename:    'fldOTWiFz8G1lE04c',
  event_id:    null, // resolved below from a sample record
  class_id:    'fldAYW88oxtF5L5Bf',
  song_id:     'fldehSfLpy3iozdBt',
  is_schulsong:'fldaPVT59Gdf8hqPL',
};

function getField(rec, name, fieldId) {
  return rec.fields[name] ?? (fieldId ? rec.fields[fieldId] : undefined);
}

async function main() {
  console.log('='.repeat(80));
  console.log('AUDIT: AudioFiles where teacher/parent download would serve .wav');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('='.repeat(80));

  // Pull all final+ready records in one pass; filter in JS because Airtable's
  // formula language is awkward for "field is empty" against linked field IDs.
  const records = await base(AUDIO_FILES_TABLE).select({
    filterByFormula: `AND({type} = 'final', {status} = 'ready')`,
  }).all();

  console.log(`\nTotal final+ready AudioFiles: ${records.length}`);

  let mp3KeyPresent = 0;
  let mp3KeyMissing_r2IsMp3 = 0;
  let mp3KeyMissing_r2IsWav = 0;
  let mp3KeyMissing_r2IsOther = 0;

  const offenders = []; // mp3 missing AND r2 ends in .wav  → user-visible bug

  for (const r of records) {
    const r2Key = getField(r, 'r2_key', F.r2_key) || '';
    const mp3Key = getField(r, 'mp3_r2_key', F.mp3_r2_key) || '';

    if (mp3Key) { mp3KeyPresent++; continue; }

    const lower = r2Key.toLowerCase();
    if (lower.endsWith('.mp3')) {
      mp3KeyMissing_r2IsMp3++;
    } else if (lower.endsWith('.wav')) {
      mp3KeyMissing_r2IsWav++;
      offenders.push(r);
    } else {
      mp3KeyMissing_r2IsOther++;
    }
  }

  console.log('\n── BREAKDOWN ───────────────────────────────────────────────────');
  console.log(`  mp3_r2_key populated (no problem):              ${mp3KeyPresent}`);
  console.log(`  mp3_r2_key missing, r2_key is .mp3 (fine):      ${mp3KeyMissing_r2IsMp3}`);
  console.log(`  mp3_r2_key missing, r2_key is .wav (BUG):       ${mp3KeyMissing_r2IsWav}`);
  console.log(`  mp3_r2_key missing, r2_key other extension:     ${mp3KeyMissing_r2IsOther}`);

  if (offenders.length === 0) {
    console.log('\n✅ No final+ready files would currently serve as .wav from the teacher endpoint.');
    return;
  }

  console.log(`\n── ${offenders.length} OFFENDING RECORDS ─────────────────────────────────────`);
  console.log('(each of these would download as .wav from /api/teacher/.../audio-downloads/[fileId])\n');

  // Group by event for readability — extract event_id from r2_key path:
  // "recordings/{eventId}/{classId}/{songId}/final/{filename}.wav" or older patterns.
  const byEvent = new Map();
  for (const r of offenders) {
    const r2Key = getField(r, 'r2_key', F.r2_key) || '';
    const m = r2Key.match(/^(?:recordings|events)\/([^/]+)\//);
    const eventId = m ? m[1] : '(unknown)';
    if (!byEvent.has(eventId)) byEvent.set(eventId, []);
    byEvent.get(eventId).push(r);
  }

  // Look up event names for context.
  const eventIds = [...byEvent.keys()].filter(id => id !== '(unknown)');
  const eventNameById = new Map();
  if (eventIds.length > 0) {
    const formula = `OR(${eventIds.map(id => `{event_id} = "${id}"`).join(',')})`;
    const evRecs = await base(EVENTS_TABLE).select({
      filterByFormula: formula,
      fields: ['event_id', 'school_name', 'event_date'],
    }).all();
    for (const e of evRecs) {
      eventNameById.set(e.fields.event_id, {
        school: e.fields.school_name || '(no name)',
        date: e.fields.event_date || '(no date)',
      });
    }
  }

  for (const [eventId, recs] of byEvent.entries()) {
    const meta = eventNameById.get(eventId);
    console.log(`\n  📅 ${eventId}`);
    if (meta) console.log(`     ${meta.school} — ${meta.date}`);
    console.log(`     ${recs.length} offending file(s):`);
    for (const r of recs) {
      const filename = getField(r, 'filename', F.filename) || '';
      const classId = getField(r, 'class_id', F.class_id) || '';
      const songId  = getField(r, 'song_id', F.song_id) || '';
      const isSchulsong = getField(r, 'is_schulsong', F.is_schulsong) || false;
      const r2Key = getField(r, 'r2_key', F.r2_key) || '';
      console.log(`       - rec ${r.id} ${isSchulsong ? '(SCHULSONG)' : ''}`);
      console.log(`         filename: ${filename}`);
      console.log(`         class:    ${classId}`);
      console.log(`         song:     ${songId}`);
      console.log(`         r2_key:   ${r2Key}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`SUMMARY: ${offenders.length} of ${records.length} final+ready files (${(100 * offenders.length / records.length).toFixed(1)}%)`);
  console.log('would download as .wav from the teacher portal.');
  console.log('='.repeat(80));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
