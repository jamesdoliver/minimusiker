// cleanup-duplicate-classes-apply.js
//
// Layer 3 data cleanup for the duplicate-classes bug. SAFE BY DEFAULT:
//   node scripts/cleanup-duplicate-classes-apply.js          -> preview only, writes NOTHING
//   node scripts/cleanup-duplicate-classes-apply.js --apply   -> dumps a backup, then writes
//
// Operations are an EXPLICIT, audited list (record ids decided from the dry-run
// + the user's choices: GS Lengerich EXCLUDED; St. Michael merged keeping the
// DEFAULT). Nothing is re-derived by heuristic. Before every delete the script
// re-fetches the record and REFUSES to delete if it has any movable attachment
// (registration / linked song / linked audio / group membership) that is not
// being explicitly repointed — so stale data can never cause silent loss.

const APPLY = process.argv.includes('--apply');

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const T = { CLASSES: 'tbl17SVI5gacwOP0n', SONGS: 'tblPjGWQlHuG8jp5X', AUDIO: 'tbloCM4tmH7mYoyXR', REGS: 'tblXsmPuZcePcre5u', GROUPS: 'tblAPwTzqYTHbaz2k' };
const C = { class_id: 'fld1dXGae9I7xldun', class_name: 'fld1kaSb8my7q5mHt' };
const S = { class_id_text: 'fldK4wCT5oKZDN6sE', class_link: 'fldMPAHLnyNralsLS', title: 'fldLjwkTwckDqT3Xl' };
const A = { class_id_text: 'fldAYW88oxtF5L5Bf', class_link: 'fld04rZUWLKCv15s2' };
const R = { class_link: 'fldfZeZiOGFg5UD0I' };
const G = { member_classes: 'fldyeuP6wYE3DRrXX', group_name: 'fldiqq6p37u8G6iGs' };
const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

// ---- Explicit operation list (decided, not derived) -----------------------
// loser = record to delete; survivor = record that stays.
const SAFE_DELETES = [
  { school: 'Paul-Sillus-Schule', loser: 'rec3GrpmpzWp2G7Xm', survivor: 'reczMz5vrC0hmOgfc' },
  { school: 'Grundschule Sundheim', loser: 'recq8u4nLO0fPbLRJ', survivor: 'rec2cGohYyu8XusWJ' },
  { school: 'Test School 2', loser: 'recihedpxa2cy0ZjT', survivor: 'rectx9GepqEiYytSo' },
  { school: 'Otto-Willmann-Schule', loser: 'rec20lwjtVzYVLlNt', survivor: 'recOci4ATPMRPfmwL' },
  { school: 'Maximilianschule Rütenbrock', loser: 'recoCzCi9IWY4Bnla', survivor: 'rec552AdTmUg1D1Jx' },
  { school: 'Grundschule Hainholz', loser: 'reco3kENptPKlxGqz', survivor: 'recMdOjPQvaMpC5Ns' },
  { school: 'Erich-Kästner Schule', loser: 'recKYaQGQulzdteSy', survivor: 'rec6CrAuWEc7ZYOVK' },
  { school: 'Schlossschule', loser: 'recnefw681ujEsAH7', survivor: 'recLS0Nbf4Wm6rSKA' },
  { school: 'Fuchshofschule', loser: 'recIpQSTEYvigLfOZ', survivor: 'rec4yulq6CsU9o7Lf' },
  // Ochsenfurt "4b": loser shares the SAME class_id as survivor, so its song
  // "Auf uns" stays attached to the survivor by text-match. Expect no movable
  // (link/reg/group) attachments on the loser.
  { school: 'Grundschule Ochsenfurt (4b)', loser: 'rec7ep3ujHPnxQXxq', survivor: 'rec68PsBiQwLVLhqc' },
];

// repoint the loser's registrations + linked songs to the survivor, then delete.
const MERGES = [
  { school: 'Grundschule Tempelhofer Straße', loser: 'receic1NyQ5SjUq2d', survivor: 'recjL5f3eN7ZxhjAA' },
  { school: 'Kindergarten St. Michael (keep default)', loser: 'recUJVQKgzWahfNZZ', survivor: 'receAMGWVeMYgLM8G' },
];

const RENAMES = [
  { school: 'Hexentalschule', record: 'recOER24OftZIOPd5', name: 'Alle Kinder' },
  { school: 'Grundschule Ostheim', record: 'recaOFaO2240QzK7W', name: 'Klasse 3b' },
];

// ---- Attachment lookups ---------------------------------------------------
// IMPORTANT: linked-record fields must be matched by RECORD ID. We load the
// tables once (returnFieldsByFieldId makes link fields arrays of record ids)
// and build record-id maps. ARRAYJOIN()/FIND() in a formula returns the linked
// record's DISPLAY value (the class_id slug), not its id, so it CANNOT be used
// to find attachments by record id.
const idx = { regsByClassRec: new Map(), songsByText: new Map(), songsByLinkRec: new Map(), audioByText: new Map(), audioByLinkRec: new Map(), groupsByMemberRec: new Map() };
const push = (m, k, v) => { if (k == null) return; const l = m.get(k); if (l) l.push(v); else m.set(k, [v]); };

async function loadAll(tableId, fields) {
  const out = [];
  await base(tableId).select({ fields, returnFieldsByFieldId: true, pageSize: 100 })
    .eachPage((records, next) => { out.push(...records); next(); });
  return out;
}
async function buildIndexes() {
  const [songs, audio, regs, groups] = await Promise.all([
    loadAll(T.SONGS, [S.class_id_text, S.class_link, S.title]),
    loadAll(T.AUDIO, [A.class_id_text, A.class_link]),
    loadAll(T.REGS, [R.class_link]),
    loadAll(T.GROUPS, [G.member_classes, G.group_name]),
  ]);
  for (const s of songs) {
    push(idx.songsByText, s.fields[S.class_id_text], s);
    for (const cid of arr(s.fields[S.class_link])) push(idx.songsByLinkRec, cid, s);
  }
  for (const a of audio) {
    push(idx.audioByText, a.fields[A.class_id_text], a);
    for (const cid of arr(a.fields[A.class_link])) push(idx.audioByLinkRec, cid, a);
  }
  for (const r of regs) for (const cid of arr(r.fields[R.class_link])) push(idx.regsByClassRec, cid, r);
  for (const g of groups) for (const cid of arr(g.fields[G.member_classes])) push(idx.groupsByMemberRec, cid, g);
}

async function classRow(id) {
  try {
    const [r] = await base(T.CLASSES).select({ filterByFormula: `RECORD_ID() = '${id}'`, returnFieldsByFieldId: true, maxRecords: 1 }).firstPage();
    return r ? { id: r.id, classId: r.fields[C.class_id], name: r.fields[C.class_name], _raw: r } : null;
  } catch { return null; }
}
function attachmentsOf(rec) {
  // rec = { id, classId }; links matched by record id, songs/audio also by text id
  return {
    regs: idx.regsByClassRec.get(rec.id) || [],
    songsText: idx.songsByText.get(rec.classId) || [],
    songsLink: idx.songsByLinkRec.get(rec.id) || [],
    audioText: idx.audioByText.get(rec.classId) || [],
    audioLink: idx.audioByLinkRec.get(rec.id) || [],
    groups: idx.groupsByMemberRec.get(rec.id) || [],
  };
}

const fmtAtt = (a, survivorClassId) => {
  const sharedText = survivorClassId && survivorClassId === a._classId;
  const parts = [];
  if (a.regs.length) parts.push(`regs:${a.regs.length}`);
  if (a.songsText.length) parts.push(`${sharedText ? 'songs(text,shared)' : 'songs(text)'}:${a.songsText.length}`);
  if (a.songsLink.length) parts.push(`songs(link):${a.songsLink.length}`);
  if (a.audioText.length) parts.push(`${sharedText ? 'audio(text,shared)' : 'audio(text)'}:${a.audioText.length}`);
  if (a.audioLink.length) parts.push(`audio(link):${a.audioLink.length}`);
  if (a.groups.length) parts.push(`groups:${a.groups.length}`);
  return parts.length ? parts.join(' ') : 'no attachments';
};

const backup = { startedAt: new Date().toISOString(), apply: APPLY, records: {} };
const snap = (label, recs) => { for (const r of arr(recs)) backup.records[`${label}:${r.id}`] = { id: r.id, fields: r.fields || r._rawJson?.fields }; };

async function run() {
  console.log(`\n=== Class cleanup ${APPLY ? '*** APPLY MODE (will write) ***' : '(preview — writes nothing; pass --apply to execute)'} ===\n`);
  console.log('Loading attachment indexes...');
  await buildIndexes();
  const actions = []; // {do: async fn}
  let blocked = 0;

  // ---- SAFE DELETES -------------------------------------------------------
  console.log('--- SAFE DELETES (loser must have NO movable attachments) ---');
  for (const op of SAFE_DELETES) {
    const loser = await classRow(op.loser);
    const survivor = await classRow(op.survivor);
    if (!loser) { console.log(`  ${op.school}: loser ${op.loser} already gone — skip`); continue; }
    if (!survivor) { console.log(`  ⛔ ${op.school}: SURVIVOR ${op.survivor} missing — skip (won't delete last class)`); blocked++; continue; }
    const att = attachmentsOf(loser); att._classId = loser.classId;
    const sharedTextSong = survivor.classId === loser.classId; // Ochsenfurt: song kept by survivor
    const movable = att.regs.length + att.songsLink.length + att.audioLink.length + att.groups.length
      + (sharedTextSong ? 0 : att.songsText.length + att.audioText.length);
    const tag = movable === 0 ? '✅ delete' : '⛔ BLOCK (unexpected attachments)';
    console.log(`  ${tag}  ${op.school}  loser=${loser.id} "${loser.name}"  [${fmtAtt(att, survivor.classId)}]`);
    if (movable !== 0) { blocked++; continue; }
    snap("delete", [loser._raw]);
    actions.push({ desc: `delete ${loser.id} (${op.school})`, fn: () => base(T.CLASSES).destroy(loser.id) });
  }

  // ---- MERGES (repoint then delete) --------------------------------------
  console.log('\n--- MERGES: repoint loser regs + songs to survivor, then delete loser ---');
  for (const op of MERGES) {
    const loser = await classRow(op.loser);
    const survivor = await classRow(op.survivor);
    if (!loser) { console.log(`  ${op.school}: loser ${op.loser} already gone — skip`); continue; }
    if (!survivor) { console.log(`  ⛔ ${op.school}: survivor ${op.survivor} missing — skip`); blocked++; continue; }
    const att = attachmentsOf(loser); att._classId = loser.classId;
    console.log(`  ${op.school}: survivor=${survivor.id} "${survivor.name}" (class_id=${survivor.classId})`);
    console.log(`     loser=${loser.id} "${loser.name}" [${fmtAtt(att, survivor.classId)}]`);

    // registrations -> survivor record
    for (const r of att.regs) {
      snap('reg', [r]);
      const titleNote = '';
      console.log(`       repoint registration ${r.id} -> survivor`);
      actions.push({ desc: `reg ${r.id} -> ${survivor.id}`, fn: () => base(T.REGS).update(r.id, { [R.class_link]: [survivor.id] }) });
    }
    // songs (by link OR by text id) -> survivor (set both link and text id)
    const songSet = new Map();
    for (const s of [...att.songsLink, ...att.songsText]) songSet.set(s.id, s);
    for (const s of songSet.values()) {
      snap('song', [s]);
      console.log(`       repoint song ${s.id} "${s.fields?.[S.title] || ''}" -> survivor (link + class_id text)`);
      actions.push({ desc: `song ${s.id} -> ${survivor.id}`, fn: () => base(T.SONGS).update(s.id, { [S.class_link]: [survivor.id], [S.class_id_text]: survivor.classId }) });
    }
    // audio (by link OR by text id) -> survivor
    const audSet = new Map();
    for (const a of [...att.audioLink, ...att.audioText]) audSet.set(a.id, a);
    for (const a of audSet.values()) {
      snap('audio', [a]);
      console.log(`       repoint audio ${a.id} -> survivor (link + class_id text)`);
      actions.push({ desc: `audio ${a.id} -> ${survivor.id}`, fn: () => base(T.AUDIO).update(a.id, { [A.class_link]: [survivor.id], [A.class_id_text]: survivor.classId }) });
    }
    // group memberships: replace loser with survivor in member_classes
    for (const g of att.groups) {
      snap('group', [g]);
      const members = arr(g.fields[G.member_classes]).map((m) => (m === loser.id ? survivor.id : m));
      const deduped = [...new Set(members)];
      console.log(`       repoint group ${g.id} "${g.fields?.[G.group_name] || ''}" member ${loser.id} -> ${survivor.id}`);
      actions.push({ desc: `group ${g.id} member`, fn: () => base(T.GROUPS).update(g.id, { [G.member_classes]: deduped }) });
    }
    // finally delete the loser
    snap("delete", [loser._raw]);
    actions.push({ desc: `delete ${loser.id} (${op.school})`, fn: () => base(T.CLASSES).destroy(loser.id), afterRepoint: true });
  }

  // ---- RENAMES ------------------------------------------------------------
  console.log('\n--- RENAMES (fill blank class_name) ---');
  for (const op of RENAMES) {
    const rec = await classRow(op.record);
    if (!rec) { console.log(`  ${op.school}: record ${op.record} missing — skip`); continue; }
    const cur = (rec.name || '').trim();
    if (cur) { console.log(`  ${op.school}: already named "${cur}" — skip`); continue; }
    console.log(`  ✅ rename ${rec.id} -> "${op.name}"`);
    snap("rename", [rec._raw]);
    actions.push({ desc: `rename ${rec.id} -> "${op.name}"`, fn: () => base(T.CLASSES).update(rec.id, { [C.class_name]: op.name }) });
  }

  console.log(`\n=== Planned writes: ${actions.length}  |  blocked: ${blocked} ===`);

  if (!APPLY) { console.log('\nPreview only — nothing written. Re-run with --apply to execute.'); return; }
  if (blocked > 0) { console.log('\n⛔ Refusing to apply while any operation is blocked. Investigate the blocked records first.'); process.exit(1); }

  // backup first
  const dir = path.join(__dirname, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `class-cleanup-${backup.startedAt.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 2));
  console.log(`\nBackup written: ${file}`);

  // execute: repoints/renames first, deletes last (deletes already ordered after their repoints in the array)
  let done = 0;
  for (const a of actions) {
    try { await a.fn(); done++; console.log(`  ✓ ${a.desc}`); }
    catch (e) { console.error(`  ✗ ${a.desc} — ${e.message}`); }
    await new Promise((r) => setTimeout(r, 220)); // stay under Airtable 5 req/s
  }
  console.log(`\n=== Done: ${done}/${actions.length} writes applied. Backup: ${file} ===`);
}

run().catch((e) => { console.error('APPLY FAILED:', e); process.exit(1); });
