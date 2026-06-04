// cleanup-stmichael-redundant-song.js
// One-shot: delete St. Michael's redundant no-audio duplicate song recZtd4
// ("Wir Bühlertäler Kinder"). The keeper recgswq carries the final audio.
// Aborts if ANY audio references the song being deleted. Backs up first.
require('dotenv').config({ path: '.env.local' });
const fs = require('fs'); const path = require('path');
const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
const SONGS = 'tblPjGWQlHuG8jp5X', AUDIO = 'tbloCM4tmH7mYoyXR';
const Asong_id = 'fldehSfLpy3iozdBt', Asong_link = 'fld4E2dFKJqkB0CuA';
const DROP = 'recZtd4PJFlamWZfU';
const arr = v => Array.isArray(v) ? v : v == null ? [] : [v];
(async () => {
  // Guard: ensure no audio references the song we are deleting
  const audio = [];
  await base(AUDIO).select({ fields: [Asong_id, Asong_link], returnFieldsByFieldId: true, pageSize: 100 })
    .eachPage((r, n) => { audio.push(...r); n(); });
  const refs = audio.filter(a => a.fields[Asong_id] === DROP || arr(a.fields[Asong_link]).includes(DROP));
  if (refs.length) { console.error(`ABORT: ${refs.length} audio file(s) reference ${DROP}:`, refs.map(a => a.id)); process.exit(1); }

  // Backup the full record
  const rec = await base(SONGS).find(DROP);
  const dir = path.join(__dirname, 'backups'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `stmichael-song-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify({ id: rec.id, fields: rec.fields }, null, 2));
  console.log(`Backup written: ${file}`);

  await base(SONGS).destroy(DROP);
  console.log(`Deleted redundant song ${DROP}. Keeper recgswqiQjuoAomah (with audio) remains.`);
})().catch(e => { console.error(e); process.exit(1); });
