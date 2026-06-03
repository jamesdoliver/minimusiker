// cleanup-duplicate-classes-dryrun.js  (READ-ONLY — writes NOTHING)
//
// Layer 3 data cleanup PLAN for the duplicate-classes bug. Derives duplicate
// Class records per event using the same identity as the shipped dedupe
// (eventAggregation.dedupeClassViews), picks a survivor for each group, and
// inventories every attachment a delete/merge would touch so the plan can be
// reviewed before anything is mutated.
//
// Categories:
//   A) REDUNDANT delete  — empty duplicate (the dedupe already hides it); delete
//                          the loser, repointing any stray attachments first.
//   B) MERGE             — two same-named records that BOTH hold content; pick a
//                          survivor and repoint the loser's songs/audio/regs/
//                          group-memberships, then delete the loser.
//   C) BLANK NAME        — a visible class whose class_name is empty; propose a fill.

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const T = {
  EVENTS: 'tblVWx1RrsGRjsNn5',
  CLASSES: 'tbl17SVI5gacwOP0n',
  SONGS: 'tblPjGWQlHuG8jp5X',
  AUDIO: 'tbloCM4tmH7mYoyXR',
  REGS: 'tblXsmPuZcePcre5u',
  GROUPS: 'tblAPwTzqYTHbaz2k',
};
const E = { event_id: 'fldcNaHZyr6E5khDe', school_name: 'fld5QcpEsDFrLun6w', classes: 'fld08ht43r8rknIPI' };
const C = { class_id: 'fld1dXGae9I7xldun', class_name: 'fld1kaSb8my7q5mHt', class_type: 'fldpYd9tFi09joNPV', is_default: 'fldJouWNH4fudWQl0', total_children: 'flddABwj9UilV2OtG', created_at: 'fld3q0jZPIAlsx8FD', main_teacher: 'fldsODu2rjT8ZMqLl' };
const S = { class_id_text: 'fldK4wCT5oKZDN6sE', class_link: 'fldMPAHLnyNralsLS', title: 'fldLjwkTwckDqT3Xl' };
const A = { class_id_text: 'fldAYW88oxtF5L5Bf', class_link: 'fld04rZUWLKCv15s2' };
const R = { class_link: 'fldfZeZiOGFg5UD0I' };
const G = { member_classes: 'fldyeuP6wYE3DRrXX', group_name: 'fldiqq6p37u8G6iGs' };
const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

async function loadAll(tableId, fields) {
  const out = [];
  await base(tableId).select({ fields, returnFieldsByFieldId: true, pageSize: 100 })
    .eachPage((records, next) => { out.push(...records); next(); });
  return out;
}

async function main() {
  console.log('Loading tables (read-only)...');
  const [events, classes, songs, audio, regs, groups] = await Promise.all([
    loadAll(T.EVENTS, [E.event_id, E.school_name, E.classes]),
    loadAll(T.CLASSES, [C.class_id, C.class_name, C.class_type, C.is_default, C.total_children, C.created_at, C.main_teacher]),
    loadAll(T.SONGS, [S.class_id_text, S.class_link, S.title]),
    loadAll(T.AUDIO, [A.class_id_text, A.class_link]),
    loadAll(T.REGS, [R.class_link]),
    loadAll(T.GROUPS, [G.member_classes, G.group_name]),
  ]);
  console.log(`events=${events.length} classes=${classes.length} songs=${songs.length} audio=${audio.length} registrations=${regs.length} groups=${groups.length}\n`);

  const row = (c) => ({
    id: c.id,
    classId: c.fields[C.class_id] || '',
    name: c.fields[C.class_name] ?? '',
    type: c.fields[C.class_type] || 'regular',
    isDefault: Boolean(c.fields[C.is_default]),
    children: c.fields[C.total_children] || 0,
    created: c.fields[C.created_at] || '',
    teacher: c.fields[C.main_teacher] || '',
  });
  const rowById = new Map(classes.map((c) => [c.id, row(c)]));

  // ---- Attachment indexes -------------------------------------------------
  const songsByText = new Map();   // class_id text -> [{id,title}]
  const songsByLink = new Map();   // class record id -> [{id,title}]
  for (const s of songs) {
    const t = s.fields[S.class_id_text];
    if (t) (songsByText.get(t) || songsByText.set(t, []).get(t)).push({ id: s.id, title: s.fields[S.title] || '' });
    for (const cid of arr(s.fields[S.class_link])) (songsByLink.get(cid) || songsByLink.set(cid, []).get(cid)).push({ id: s.id, title: s.fields[S.title] || '' });
  }
  const audioByText = new Map(), audioByLink = new Map();
  for (const a of audio) {
    const t = a.fields[A.class_id_text];
    if (t) audioByText.set(t, (audioByText.get(t) || 0) + 1);
    for (const cid of arr(a.fields[A.class_link])) audioByLink.set(cid, (audioByLink.get(cid) || 0) + 1);
  }
  const regsByClass = new Map();   // class record id -> count
  for (const r of regs) for (const cid of arr(r.fields[R.class_link])) regsByClass.set(cid, (regsByClass.get(cid) || 0) + 1);
  const groupsByClass = new Map(); // class record id -> [group names]
  for (const g of groups) for (const cid of arr(g.fields[G.member_classes])) (groupsByClass.get(cid) || groupsByClass.set(cid, []).get(cid)).push(g.fields[G.group_name] || g.id);

  // song "content" for survivor scoring = songs matching by text id OR link
  const songContentCount = (r) => {
    const ids = new Set([...(songsByText.get(r.classId) || []), ...(songsByLink.get(r.id) || [])].map((s) => s.id));
    return ids.size;
  };
  const attachmentSummary = (r, survivorClassId) => {
    // Songs/audio by TEXT only count as "lost" if the survivor has a DIFFERENT class_id text.
    const textShared = survivorClassId && survivorClassId === r.classId;
    const songText = (songsByText.get(r.classId) || []);
    const songLink = (songsByLink.get(r.id) || []);
    const aText = audioByText.get(r.classId) || 0;
    const aLink = audioByLink.get(r.id) || 0;
    return {
      registrations: regsByClass.get(r.id) || 0,
      songsByText: textShared ? 0 : songText.length,   // shared text id => survivor keeps them
      songsByTextShared: textShared ? songText.length : 0,
      songsByLink: songLink.length,
      audioByText: textShared ? 0 : aText,
      audioByLink: aLink,
      groups: groupsByClass.get(r.id) || [],
      songTitles: [...new Set([...songText, ...songLink].map((s) => s.title))].filter(Boolean),
    };
  };
  const needsRepoint = (s) => s.registrations > 0 || s.songsByText > 0 || s.songsByLink > 0 || s.audioByText > 0 || s.audioByLink > 0 || s.groups.length > 0;

  // ---- Derive duplicate groups per event (dedupe identity) ----------------
  const planRedundant = []; // {event, survivor, losers:[{row,summary}]}
  const planMerge = [];
  const planBlank = [];
  const REDUNDANT = (r) => songContentCount(r) === 0 && (r.isDefault || (r.children || 0) === 0);

  for (const e of events) {
    const evId = e.fields[E.event_id] || '';
    const school = e.fields[E.school_name] || '';
    const rows = arr(e.fields[E.classes]).map((id) => rowById.get(id)).filter(Boolean);

    // group by classType + normalized name (blank -> by id, never grouped)
    const groupsMap = new Map();
    for (const r of rows) {
      const n = String(r.name).trim().toLowerCase();
      const key = n ? `${r.type}:${n}` : `__blank__:${r.id}`;
      (groupsMap.get(key) || groupsMap.set(key, []).get(key)).push(r);
    }

    for (const [key, list] of groupsMap) {
      if (key.startsWith('__blank__')) {
        for (const r of list) planBlank.push({ school, evId, r, proposed: proposeName(r) });
        continue;
      }
      if (list.length < 2) continue;
      // survivor = most song content, then registrations, then children, then oldest
      const score = (r) => songContentCount(r) * 1e6 + (regsByClass.get(r.id) || 0) * 1e3 + (r.children || 0);
      const sorted = [...list].sort((a, b) => score(b) - score(a) || String(a.created).localeCompare(String(b.created)));
      const survivor = sorted[0];
      const losers = sorted.slice(1);

      const allLosersRedundant = losers.every(REDUNDANT);
      const entry = {
        school, evId, survivor,
        losers: losers.map((r) => ({ row: r, summary: attachmentSummary(r, survivor.classId) })),
      };
      if (allLosersRedundant && REDUNDANT_or_survivorHasContent(survivor, losers)) planRedundant.push(entry);
      else planMerge.push(entry);
    }
  }

  // ---- Output -------------------------------------------------------------
  const fmtSummary = (s) => {
    const parts = [];
    if (s.registrations) parts.push(`regs:${s.registrations}`);
    if (s.songsByText) parts.push(`songs(text,LOST):${s.songsByText}`);
    if (s.songsByTextShared) parts.push(`songs(text,shared-with-survivor):${s.songsByTextShared}`);
    if (s.songsByLink) parts.push(`songs(link):${s.songsByLink}`);
    if (s.audioByText) parts.push(`audio(text,LOST):${s.audioByText}`);
    if (s.audioByLink) parts.push(`audio(link):${s.audioByLink}`);
    if (s.groups.length) parts.push(`groups:[${s.groups.join('|')}]`);
    if (s.songTitles.length) parts.push(`titles:[${s.songTitles.join(' / ')}]`);
    return parts.length ? parts.join(' ') : 'NOTHING ATTACHED';
  };

  console.log('================================================================');
  console.log(`CATEGORY A — REDUNDANT empty-duplicate deletes (${planRedundant.length} groups)`);
  console.log('================================================================');
  let aSafe = 0, aRepoint = 0, aLoserCount = 0;
  for (const p of planRedundant) {
    console.log(`\n${p.school} | ${p.evId}`);
    console.log(`  SURVIVOR keep  rec=${p.survivor.id} class_id=${p.survivor.classId} name="${p.survivor.name}" default=${p.survivor.isDefault} songs=${songContentCount(p.survivor)} children=${p.survivor.children}`);
    for (const l of p.losers) {
      aLoserCount++;
      const repoint = needsRepoint(l.summary);
      if (repoint) aRepoint++; else aSafe++;
      console.log(`  DELETE loser   rec=${l.row.id} class_id=${l.row.classId} name="${l.row.name}" default=${l.row.isDefault} created=${l.row.created}`);
      console.log(`     -> ${repoint ? '⚠ REPOINT FIRST: ' : 'safe: '}${fmtSummary(l.summary)}`);
    }
  }

  console.log('\n================================================================');
  console.log(`CATEGORY B — MERGE (both copies hold content) (${planMerge.length} groups)`);
  console.log('================================================================');
  for (const p of planMerge) {
    console.log(`\n${p.school} | ${p.evId}`);
    console.log(`  SURVIVOR keep  rec=${p.survivor.id} class_id=${p.survivor.classId} name="${p.survivor.name}" songs=${songContentCount(p.survivor)} regs=${regsByClass.get(p.survivor.id) || 0} children=${p.survivor.children}`);
    for (const l of p.losers) {
      console.log(`  MERGE loser    rec=${l.row.id} class_id=${l.row.classId} name="${l.row.name}" created=${l.row.created}`);
      console.log(`     -> repoint to survivor then delete: ${fmtSummary(l.summary)}`);
    }
  }

  console.log('\n================================================================');
  console.log(`CATEGORY C — BLANK class names (${planBlank.length})`);
  console.log('================================================================');
  for (const b of planBlank) {
    const s = attachmentSummary(b.r, null);
    console.log(`  ${b.school} | ${b.evId}`);
    console.log(`     rec=${b.r.id} class_id=${b.r.classId} default=${b.r.isDefault} children=${b.r.children}  ->  SET name="${b.proposed}"   (${fmtSummary(s)})`);
  }

  console.log('\n================================================================');
  console.log('SUMMARY');
  console.log('================================================================');
  console.log(`A) Redundant deletes: ${aLoserCount} record(s) across ${planRedundant.length} group(s) — ${aSafe} safe, ${aRepoint} need repoint`);
  console.log(`B) Merges:            ${planMerge.reduce((n, p) => n + p.losers.length, 0)} loser record(s) across ${planMerge.length} group(s) — all need repoint`);
  console.log(`C) Blank names:       ${planBlank.length}`);
  console.log('\nNOTHING WAS MODIFIED. Review above before running the apply step.');
}

// A redundant group only qualifies for category A if the survivor itself is a
// real keeper (has content) OR is the chosen catch-all; always true here, kept
// explicit for clarity.
function REDUNDANT_or_survivorHasContent() { return true; }

function proposeName(r) {
  if (r.isDefault) return 'Alle Kinder';
  // Derive from the class_id slug tail, e.g. cls_..._klasse3b_xxxx -> "Klasse 3b"
  const m = String(r.classId).match(/_([a-z0-9]+)_[a-z0-9]{6}$/i);
  if (m) {
    const slug = m[1];
    const km = slug.match(/^klasse(.+)$/i);
    if (km) return `Klasse ${km[1]}`;
    return slug;
  }
  return '(needs manual name)';
}

main().catch((e) => { console.error('DRY-RUN FAILED:', e); process.exit(1); });
