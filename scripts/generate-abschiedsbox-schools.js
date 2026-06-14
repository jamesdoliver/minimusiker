#!/usr/bin/env node
/**
 * Regenerates public/abschiedsbox/schools.js (the school dropdown on the
 * Abschiedsbox landing page) from Airtable.
 *
 * Sources (union, deduped):
 *   - Projekttage (legacy events)  -> via linked Einrichtung
 *   - SchoolBookings (SimplyBook + manual M-* drafts) -> school_name/city
 *   - Events                       -> safety net for events without a booking
 *
 * Rules:
 *   - Event/booking date >= WINDOW_START; cancelled/deleted excluded.
 *     Manual drafts without start_date fall back to their linked Event's date.
 *   - Kitas excluded (Einrichtungen type, is_kita flag, or name pattern)
 *   - Test bookings excluded (TEST_BLOCKLIST, entries web-verified 2026-06-12)
 *   - Existing dropdown entries are preserved verbatim (labels untouched);
 *     known-bad `k` values are corrected via K_FIXES
 *   - `k` = Einrichtungen.alte_id (0 if unknown), `e` = legacy event id or
 *     SimplyBook id. They are only used as a unique combobox key — checkout
 *     sends the visible label.
 *
 * Usage:
 *   node scripts/generate-abschiedsbox-schools.js --dry-run   # report only
 *   node scripts/generate-abschiedsbox-schools.js             # rewrite schools.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const fs = require('fs');
const path = require('path');
const Airtable = require('airtable');

const DRY_RUN = process.argv.includes('--dry-run');
const WINDOW_START = '2025-08-01';

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
const T = {
  EINRICHTUNGEN: 'tblLPUjLnHZ0Y4mdB',
  SCHOOL_BOOKINGS: 'tblrktl5eLJEWE4M6',
  EVENTS: 'tblVWx1RrsGRjsNn5',
  PROJEKTTAGE: 'tblM8HeUpKDtRTzOz',
};

const SCHOOLS_PATH = path.join(__dirname, '..', 'public', 'abschiedsbox', 'schools.js');

// Wrong legacy customer ids in the original hand-generated file.
const K_FIXES = {
  'Grundschule Wahlsburg|Wesertal': 2878, // was 2787 (= Oetternbachschule)
  'OGGS Mausbach|Stolberg': 2823, // was 2824 (not an Einrichtungen alte_id)
};

// Internal test bookings / placeholder names — never real schools.
// (normalized form; "Larseland", "Mini/Maxi Maren" web-verified as test data)
const TEST_BLOCKLIST = new Set([
  'test', 'test2', 'testschule', 'test school', 'test school 2', 'test schule api',
  'till', 'till two', 'tillschule', 'till s test school', 'james oliver',
  'mini maren schule', 'maxi maren schule', 'gs buchhaltung', 'laberrabarber',
  'school of hard knocks', 'calder high school', 'cragg vale school',
  'unknown school', 'sabine bleck', 'larseland grundschule',
]);

// Abandoned manual-draft bookings (M-*) for real schools whose event never
// took place: pending months past the draft date with zero recordings,
// registrations, orders, or audio-pipeline activity, and no confirmed booking.
// Keyed by simplybook_id (stable). If a school is genuinely rebooked it will get
// a numeric, dated booking that this generator picks up automatically.
// Verified 2026-06-14 (see scripts/tmp-verify-pending-drafts diagnostics).
const STALE_DRAFT_IDS = new Set([
  'M-23a8b4', // Schule am Halmerweg, Bremen — draft date 2026-02-17, no activity
  'M-9fdc47', // Paul-Sillus-Schule, Jever — draft date 2026-03-10, no activity
  'M-f65466', // Paul-Sillus-Schule, Jever — duplicate draft, no linked event
  'M-08ed7e', // Lembergschule Poppenweiler, Ludwigsburg — draft date 2026-03-23, no activity
]);

// Display-name fixes for typos / misnamed bookings (web-verified).
const NAME_FIXES = {
  'Erich Kästner Grundschule Veitrsbronn': 'Erich Kästner Grundschule Veitsbronn', // Airtable typo
  'Grundschule am Buchenende': 'Grundschule Bötersen', // booking named after the school's street
  'Am Waldschlösschen': 'Grundschule Am Waldschlösschen',
  'Lembergschule': 'Lembergschule Poppenweiler',
  'Grundschule „Lucas Cranach“': 'Lucas Cranach Grundschule', // draft variant of the Weimar school
};

// City fixes keyed by "name|city" — source typos / district-vs-municipality
// mismatches that would otherwise defeat deduplication.
const CITY_FIXES = {
  'Grundschule am Römerbad (Zunzweier)|Offenberg': 'Offenburg', // booking typo
  'Hans-Elm-Schule Altengronau|Altengronau': 'Sinntal', // Altengronau is a district of Sinntal
};

// Combined bookings covering several real schools -> split into separate entries.
const SPLITS = {
  'GS Lengerich und GS Gersten': [
    { n: 'Grundschule Lengerich', c: 'Lengerich (Emsland)' },
    { n: 'Grundschule Gersten', c: 'Gersten' },
  ],
};

const KITA_NAME_RE = /\b(kita|kiga|kindergarten|kindertagesst(ae|ä)tte|kindertageseinrichtung|kte|kts|familienzentrum|fz)\b/i;
const DEAD_STATUS_RE = /cancel|delete|abgesagt|storniert/i;

function cleanName(name) {
  const trimmed = String(name || '').replace(/\s+/g, ' ').trim();
  return NAME_FIXES[trimmed] || trimmed;
}
function norm(s) {
  if (!s) return '';
  return String(s).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function loose(s) {
  return norm(s)
    .replace(/\bggs\b/g, 'gemeinschaftsgrundschule')
    .replace(/\bgs\b/g, 'grundschule')
    .replace(/\bkgs\b/g, 'katholische grundschule')
    .replace(/\boggs\b/g, 'offene ganztagsgrundschule')
    .replace(/\bgsv\b/g, 'grundschulverbund');
}
const STOP = new Set(['grundschule', 'schule', 'gemeinschaftsgrundschule', 'katholische', 'offene', 'ganztagsgrundschule', 'grundschulverbund', 'am', 'an', 'der', 'die', 'das', 'im', 'in', 'von', 'und', 'zu', 'auf', 'dem', 'st', 'staedt', 'kath']);
function tokens(s) { return new Set(loose(s).split(' ').filter((t) => t && !STOP.has(t))); }
function jaccard(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}
function cityCompatible(a, b) {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return true;
  return na === nb || na.includes(nb) || nb.includes(na);
}
// "Medardusschule" vs "Medardusschule Bendorf": one token set contained in the other.
function tokenSubset(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return false;
  const [small, big] = A.size <= B.size ? [A, B] : [B, A];
  for (const t of small) if (!big.has(t)) return false;
  return true;
}
function sameSchool(nameA, cityA, nameB, cityB) {
  if (loose(nameA) === loose(nameB) && cityCompatible(cityA, cityB)) return true;
  if (!cityCompatible(cityA, cityB)) return false;
  return jaccard(nameA, nameB) >= 0.6 || tokenSubset(nameA, nameB);
}
function isTest(name) {
  const n = norm(name);
  return TEST_BLOCKLIST.has(n) || /\btest\b/.test(n);
}
function isKitaName(name) { return KITA_NAME_RE.test(name || ''); }

async function fetchAll(table, fields) {
  const out = [];
  await base(table).select({ fields }).eachPage((recs, next) => {
    for (const r of recs) out.push({ recId: r.id, ...Object.fromEntries(fields.map((f) => [f, r.get(f)])) });
    next();
  });
  return out;
}

(async () => {
  const existingRaw = fs.readFileSync(SCHOOLS_PATH, 'utf8');
  const existing = JSON.parse(existingRaw.replace(/^const SCHOOLS = /, '').replace(/;\s*$/, ''));

  const [einrichtungen, bookings, events, projekttage] = await Promise.all([
    fetchAll(T.EINRICHTUNGEN, ['customer_name', 'ort', 'type', 'alte_id']),
    fetchAll(T.SCHOOL_BOOKINGS, ['simplybook_id', 'school_name', 'city', 'start_date', 'simplybook_status', 'is_kita', 'einrichtung', 'Events']),
    fetchAll(T.EVENTS, ['event_id', 'school_name', 'event_date', 'status', 'is_kita', 'simplybook_booking']),
    fetchAll(T.PROJEKTTAGE, ['Name', 'alte Event ID', 'Datum', 'Status', 'Einrichtung']),
  ]);
  const einById = new Map(einrichtungen.map((e) => [e.recId, e]));
  const bookingById = new Map(bookings.map((b) => [b.recId, b]));

  // latest event date per booking (fallback for manual drafts without start_date)
  const eventDateByBooking = new Map();
  for (const ev of events) {
    if (!ev.event_date) continue;
    for (const bId of ev.simplybook_booking || []) {
      const cur = eventDateByBooking.get(bId);
      if (!cur || ev.event_date > cur) eventDateByBooking.set(bId, ev.event_date);
    }
  }

  // Apply k fixes to preserved entries (labels stay untouched), and drop any
  // entry keyed to a stale abandoned draft (verified never to have happened).
  const droppedStale = existing.filter((s) => STALE_DRAFT_IDS.has(String(s.e)));
  const preserved = existing
    .filter((s) => !STALE_DRAFT_IDS.has(String(s.e)))
    .map((s) => {
      const fix = K_FIXES[`${s.n}|${s.c}`];
      return fix ? { ...s, k: fix } : { ...s };
    });
  if (droppedStale.length) console.log(`Dropped ${droppedStale.length} stale draft entries: ${droppedStale.map((s) => `${s.n} (e=${s.e})`).join(', ')}`);
  const existingEs = new Set(preserved.map((s) => String(s.e)));
  const existingKs = new Map(); // alte_id -> entry (for same-school-different-spelling)
  for (const s of preserved) if (s.k) existingKs.set(s.k, s);

  function alreadyInDropdown(name, city, k) {
    if (k && existingKs.has(k) && cityCompatible(existingKs.get(k).c, city)) return existingKs.get(k);
    for (const d of preserved) if (sameSchool(d.n, d.c, name, city)) return d;
    return null;
  }

  function findEinrichtung(name, city) {
    let best = null, bestSim = 0;
    for (const e of einrichtungen) {
      if (!e.customer_name) continue;
      let sim = loose(e.customer_name) === loose(name) ? 1 : jaccard(e.customer_name, name);
      if (sim >= 0.5 && !cityCompatible(e.ort, city)) continue;
      if (sim > bestSim) { bestSim = sim; best = e; }
    }
    return bestSim >= 0.6 ? best : null;
  }

  // ---------- collect candidates ----------
  const candidates = []; // {name, city, e, k, src, date}
  const review = []; // excluded-but-noteworthy, for the report

  function addCandidate(c) {
    if (!c.name) return;
    for (const [combined, parts] of Object.entries(SPLITS)) {
      if (cleanName(c.name) === cleanName(combined)) {
        parts.forEach((p, i) => candidates.push({ ...c, name: p.n, city: p.c, e: i === 0 ? c.e : `${c.e}-${i + 1}` }));
        return;
      }
    }
    const name = cleanName(c.name);
    let city = String(c.city || '').trim();
    city = CITY_FIXES[`${name}|${city}`] || city;
    candidates.push({ ...c, name, city });
  }

  // 1. Legacy Projekttage
  for (const p of projekttage) {
    if (!p.Datum || p.Datum < WINDOW_START) continue;
    if (p.Status && DEAD_STATUS_RE.test(p.Status)) continue;
    const ein = (p.Einrichtung || []).map((id) => einById.get(id)).filter(Boolean)[0];
    if (!ein || !ein.customer_name) continue;
    if (ein.type === 'KiTa' || isKitaName(ein.customer_name)) continue;
    if (isTest(ein.customer_name)) continue;
    const e = p['alte Event ID'] != null ? p['alte Event ID'] : `pt-${p.recId.slice(-6)}`;
    if (existingEs.has(String(e))) continue;
    addCandidate({ name: ein.customer_name, city: ein.ort, e, k: ein.alte_id || 0, src: 'Projekttage', date: p.Datum });
  }

  // 2. SchoolBookings (SimplyBook + manual drafts)
  for (const b of bookings) {
    if (b.simplybook_status && DEAD_STATUS_RE.test(b.simplybook_status)) continue;
    if (STALE_DRAFT_IDS.has(b.simplybook_id)) { review.push({ name: (b.school_name || '').trim(), city: b.city, src: `SchoolBookings sb=${b.simplybook_id}`, why: 'EXCLUDED — abandoned draft, event verified as never having taken place' }); continue; }
    const effDate = b.start_date || eventDateByBooking.get(b.recId) || null;
    if (!effDate || effDate < WINDOW_START) continue;
    const ein = (b.einrichtung || []).map((id) => einById.get(id)).filter(Boolean)[0];
    const name = b.school_name || (ein && ein.customer_name) || '';
    if (!name.trim()) continue;
    if (b.is_kita || (ein && ein.type === 'KiTa') || isKitaName(name)) continue;
    if (isTest(name)) { review.push({ name: name.trim(), city: b.city, src: `SchoolBookings sb=${b.simplybook_id}`, why: 'test blocklist' }); continue; }
    if (!b.start_date) review.push({ name: cleanName(name), city: b.city, src: `SchoolBookings sb=${b.simplybook_id}`, why: `INCLUDED, manual draft without start_date (status=${b.simplybook_status}, event date ${effDate}) — backed by a confirmed sibling booking` });
    addCandidate({ name, city: b.city || (ein && ein.ort), e: b.simplybook_id || `sb-${b.recId.slice(-6)}`, k: (ein && ein.alte_id) || 0, src: 'SchoolBookings', date: effDate });
  }

  // 3. Events without any booking link — anchor to an Einrichtung or flag for review.
  for (const ev of events) {
    if (!ev.event_date || ev.event_date < WINDOW_START) continue;
    if (ev.status && DEAD_STATUS_RE.test(ev.status)) continue;
    const name = (ev.school_name || '').trim();
    if (!name) continue;
    if (ev.is_kita || isKitaName(name)) continue;
    if (isTest(name)) continue;
    if ((ev.simplybook_booking || []).some((id) => bookingById.has(id))) continue; // covered by pass 2
    const ein = findEinrichtung(name, null);
    if (!ein) { review.push({ name, city: '', src: `Events ${ev.event_id}`, why: 'no booking link, no Einrichtungen match — excluded' }); continue; }
    if (ein.type === 'KiTa' || isKitaName(ein.customer_name)) continue;
    addCandidate({ name: ein.customer_name, city: ein.ort, e: `ev-${String(ev.event_id || ev.recId).slice(-6)}`, k: ein.alte_id || 0, src: 'Events', date: ev.event_date });
  }

  // ---------- dedupe candidates against dropdown and each other ----------
  const additions = [];
  for (const c of candidates) {
    if (alreadyInDropdown(c.name, c.city, c.k)) continue;
    const prior = additions.find((a) => sameSchool(a.name, a.city, c.name, c.city) || (a.k && a.k === c.k && cityCompatible(a.city, c.city)));
    if (prior) { prior.srcs.add(c.src); continue; }
    additions.push({ ...c, srcs: new Set([c.src]) });
  }

  // ---------- report ----------
  console.log(`Existing entries: ${preserved.length}`);
  console.log(`\n===== ADDITIONS (${additions.length}) =====`);
  for (const a of additions.slice().sort((x, y) => x.name.localeCompare(y.name, 'de'))) {
    console.log(`+ ${a.name} — ${a.city || '??'}  [k=${a.k} e=${a.e} src=${[...a.srcs].join('+')} date=${a.date}]`);
  }
  console.log(`\n===== EXCLUDED / NEEDS REVIEW (${review.length}) =====`);
  for (const r of review) console.log(`- ${r.name} [${r.city || '?'}] (${r.src}): ${r.why}`);

  const missingCity = additions.filter((a) => !a.city);
  if (missingCity.length) console.log(`\nWARNING: ${missingCity.length} additions have no city: ${missingCity.map((a) => a.name).join(', ')}`);

  if (DRY_RUN) { console.log('\n(dry run — schools.js not modified)'); return; }

  const finalList = [
    ...preserved,
    ...additions.map((a) => ({ k: a.k, e: a.e, n: a.name, c: a.city })),
  ].sort((x, y) => x.n.localeCompare(y.n, 'de') || String(x.c).localeCompare(String(y.c), 'de'));

  // uniqueness guards
  const keys = new Set(), labels = new Set();
  for (const s of finalList) {
    const key = `${s.k}-${s.e}`;
    const label = `${s.n} — ${s.c}`;
    if (keys.has(key)) throw new Error(`Duplicate combobox key: ${key} (${s.n})`);
    if (labels.has(label)) throw new Error(`Duplicate label: ${label}`);
    keys.add(key);
    labels.add(label);
  }

  fs.writeFileSync(SCHOOLS_PATH, `const SCHOOLS = ${JSON.stringify(finalList)};\n`);
  console.log(`\nWrote ${finalList.length} schools to ${path.relative(process.cwd(), SCHOOLS_PATH)}`);
})().catch((e) => { console.error(e); process.exit(1); });
