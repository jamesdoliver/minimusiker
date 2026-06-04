// diagnose-class-scoping-v4.js (READ-ONLY)
// Verifies the dedupeClassViews fix against LIVE data: replicates the two-pass
// dedupe over each event's reverse-linked classes (with real non-hidden song
// counts, assigned the same way getTeacherEvents does) and confirms no event
// shows duplicate class names afterwards.

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const CLASSES_TABLE_ID = 'tbl17SVI5gacwOP0n';
const SONGS_TABLE_ID = 'tblPjGWQlHuG8jp5X';
const E = { event_id: 'fldcNaHZyr6E5khDe', school_name: 'fld5QcpEsDFrLun6w', classes: 'fld08ht43r8rknIPI' };
const C = { class_id: 'fld1dXGae9I7xldun', class_name: 'fld1kaSb8my7q5mHt', class_type: 'fldpYd9tFi09joNPV', is_default: 'fldJouWNH4fudWQl0', total_children: 'flddABwj9UilV2OtG' };
const S = { class_id: 'fldK4wCT5oKZDN6sE', hidden: 'fldTRtpzm0SEFjudA' };
const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

async function loadAll(tableId, fields) {
  const out = [];
  await base(tableId).select({ fields, returnFieldsByFieldId: true, pageSize: 100 })
    .eachPage((records, next) => { out.push(...records); next(); });
  return out;
}

// Faithful JS port of src/lib/utils/eventAggregation.ts dedupeClassViews
function dedupeClassViews(classes) {
  const order = new Map(); classes.forEach((c, i) => order.set(c, i));
  const score = (c) => (c.songs?.length || 0) * 1_000_000 + (c.numChildren || 0);
  const byId = new Map();
  for (const c of classes) { const p = byId.get(c.classId); if (!p || score(c) > score(p)) byId.set(c.classId, c); }
  const afterId = [...byId.values()];
  const groups = new Map();
  for (const c of afterId) {
    const name = (c.className || '').trim().toLowerCase();
    const key = name ? `n:${c.classType || 'regular'}:${name}` : `i:${c.classId}`;
    const l = groups.get(key); if (l) l.push(c); else groups.set(key, [c]);
  }
  const isRedundant = (c) => (c.songs?.length || 0) === 0 && (c.isDefault === true || (c.numChildren || 0) === 0);
  const survivors = [];
  for (const list of groups.values()) {
    if (list.length === 1) { survivors.push(list[0]); continue; }
    const keepers = list.filter((c) => !isRedundant(c));
    if (keepers.length > 0) survivors.push(...keepers);
    else survivors.push(list.reduce((a, b) => ((b.numChildren || 0) > (a.numChildren || 0) ? b : a)));
  }
  return survivors.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

async function main() {
  const events = await loadAll(EVENTS_TABLE_ID, [E.event_id, E.school_name, E.classes]);
  const classes = await loadAll(CLASSES_TABLE_ID, [C.class_id, C.class_name, C.class_type, C.is_default, C.total_children]);
  const songs = await loadAll(SONGS_TABLE_ID, [S.class_id, S.hidden]);

  // non-hidden song count per class_id (matches getTeacherEvents excludeHidden)
  const songCountByClassId = new Map();
  for (const s of songs) {
    if (s.fields[S.hidden]) continue;
    const cid = s.fields[S.class_id];
    if (!cid) continue;
    songCountByClassId.set(cid, (songCountByClassId.get(cid) || 0) + 1);
  }

  const rowById = new Map(classes.map((c) => [c.id, {
    classId: c.fields[C.class_id] || '', className: c.fields[C.class_name] ?? '',
    classType: c.fields[C.class_type] || 'regular', isDefault: Boolean(c.fields[C.is_default]),
    numChildren: c.fields[C.total_children] || 0,
  }]));

  let eventsWithDupBefore = 0, eventsWithDupAfter = 0;
  const stillDup = [];

  for (const e of events) {
    const rows = arr(e.fields[E.classes]).map((id) => rowById.get(id)).filter(Boolean)
      .map((r) => ({ ...r, songs: new Array(songCountByClassId.get(r.classId) || 0).fill(0) }));
    if (rows.length === 0) continue;

    // The teacher class list only renders regular classes (choir/teacher_song
    // go to separate Chor/Lehrerlied sections), so measure duplicates there.
    const regularOnly = (list) => list.filter((r) => (r.classType || 'regular') === 'regular');

    const dupBefore = hasDupNames(regularOnly(rows));
    if (dupBefore) eventsWithDupBefore++;

    const deduped = dedupeClassViews(rows);
    const dupAfter = hasDupNames(regularOnly(deduped));
    if (dupAfter) { eventsWithDupAfter++; stillDup.push({ school: e.fields[E.school_name], event: e.fields[E.event_id], names: deduped.map((r) => r.className) }); }

    if (dupBefore) {
      console.log(`\n${e.fields[E.school_name]} | ${e.fields[E.event_id]}`);
      console.log(`  before (${rows.length}): ${rows.map((r) => `${r.className}[${r.classType}${r.isDefault ? ',def' : ''}|songs:${r.songs.length}]`).join(', ')}`);
      console.log(`  after  (${deduped.length}): ${deduped.map((r) => r.className).join(', ')}  ${dupAfter ? '❌ STILL DUP' : '✅'}`);
    }
  }

  console.log('\n================ RESULT ================');
  console.log(`Events with duplicate class names BEFORE dedupe: ${eventsWithDupBefore}`);
  console.log(`Events with duplicate class names AFTER  dedupe: ${eventsWithDupAfter}`);
  if (stillDup.length) { console.log('STILL DUPLICATED:'); stillDup.forEach((x) => console.log('  ' + JSON.stringify(x))); }
  else console.log('✅ All duplicate-class-name events resolved by dedupeClassViews.');
}

function hasDupNames(rows) {
  const seen = new Set();
  for (const r of rows) {
    const k = String(r.className).trim().toLowerCase();
    if (k === '') continue;
    if (seen.has(k)) return true;
    seen.add(k);
  }
  return false;
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
