// diagnose-class-scoping.js
// READ-ONLY diagnostic for two reported bugs:
//   (A) wrong class names shown to teachers
//   (B) wrong classes appearing for a school/event
// Tests each candidate root-cause mechanism against live Airtable data.
// Does NOT modify anything.

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const CLASSES_TABLE_ID = 'tbl17SVI5gacwOP0n';

const E = {
  event_id: 'fldcNaHZyr6E5khDe',
  school_name: 'fld5QcpEsDFrLun6w',
  event_date: 'fld7pswBblm9jlOsS',
  legacy_booking_id: 'fldYrZSh7tdkwuWp4',
  simplybook_booking: 'fldK7vyxLd9MxgmES',
  classes: 'fld08ht43r8rknIPI',
};
const C = {
  class_id: 'fld1dXGae9I7xldun',
  event_id: 'fldSSaeBuQDkOhOIT',
  class_name: 'fld1kaSb8my7q5mHt',
  legacy_booking_id: 'fldXGF3yXrHeI4vWn',
  class_type: 'fldpYd9tFi09joNPV',
  is_default: 'fldJouWNH4fudWQl0',
};

const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
const cap = (list, n = 12) => list.slice(0, n);

async function loadAll(tableId, fields) {
  const out = [];
  await base(tableId)
    .select({ fields, returnFieldsByFieldId: true, pageSize: 100 })
    .eachPage((records, next) => {
      out.push(...records);
      next();
    });
  return out;
}

async function main() {
  console.log('Loading Events and Classes (this scans both tables once)...\n');

  const events = await loadAll(EVENTS_TABLE_ID, [
    E.event_id, E.school_name, E.event_date, E.legacy_booking_id, E.simplybook_booking, E.classes,
  ]);
  const classes = await loadAll(CLASSES_TABLE_ID, [
    C.class_id, C.event_id, C.class_name, C.legacy_booking_id, C.class_type, C.is_default,
  ]);

  console.log(`Events: ${events.length}   Classes: ${classes.length}\n`);

  // Index events by record id
  const eventById = new Map();
  for (const e of events) {
    eventById.set(e.id, {
      id: e.id,
      eventId: e.fields[E.event_id] || '',
      school: e.fields[E.school_name] || '',
      date: e.fields[E.event_date] || '',
      classesLink: arr(e.fields[E.classes]),
    });
  }

  // Normalize class rows
  const rows = classes.map((c) => ({
    id: c.id,
    classId: c.fields[C.class_id] || '',
    name: (c.fields[C.class_name] ?? ''),
    legacy: (c.fields[C.legacy_booking_id] ?? ''),
    type: c.fields[C.class_type] || 'regular',
    isDefault: Boolean(c.fields[C.is_default]),
    eventLink: arr(c.fields[C.event_id]), // event record ids this class links to
  }));
  const rowById = new Map(rows.map((r) => [r.id, r]));

  const schoolOfClass = (r) => {
    const evs = r.eventLink.map((id) => eventById.get(id)).filter(Boolean);
    return [...new Set(evs.map((e) => e.school))];
  };

  console.log('==================================================================');
  console.log('BUG B — WRONG CLASSES PER SCHOOL');
  console.log('==================================================================\n');

  // -------- Mechanism 1: legacy_booking_id shared across DIFFERENT events/schools
  console.log('--- [B1] legacy_booking_id values shared across classes of DIFFERENT events ---');
  const byLegacy = new Map();
  for (const r of rows) {
    if (!r.legacy) continue;
    if (!byLegacy.has(r.legacy)) byLegacy.set(r.legacy, []);
    byLegacy.get(r.legacy).push(r);
  }
  const crossEventLegacy = [];
  for (const [legacy, list] of byLegacy) {
    const eventLinkSet = new Set(list.flatMap((r) => r.eventLink));
    const schoolSet = new Set(list.flatMap((r) => schoolOfClass(r)));
    if (eventLinkSet.size > 1 || schoolSet.size > 1) {
      crossEventLegacy.push({ legacy, count: list.length, events: eventLinkSet.size, schools: [...schoolSet] });
    }
  }
  crossEventLegacy.sort((a, b) => b.count - a.count);
  console.log(`Found ${crossEventLegacy.length} legacy_booking_id value(s) shared across >1 event or >1 school.`);
  for (const x of cap(crossEventLegacy)) {
    const namespaced = /^evt_/.test(x.legacy);
    console.log(`   legacy="${x.legacy}" classes=${x.count} distinctEventLinks=${x.events} schools=${JSON.stringify(x.schools)} ${namespaced ? '' : '  <-- NON-namespaced (numeric/M-/text)'}`);
  }
  console.log('');

  // -------- Mechanism 2: Events with EMPTY reverse-link that the text fallback would still match
  console.log('--- [B2] Events with EMPTY classes reverse-link that the text fallback would still pull classes for ---');
  const legacyExact = new Map(); // legacy value -> classes (for fallback simulation)
  for (const r of rows) {
    if (!r.legacy) continue;
    if (!legacyExact.has(r.legacy)) legacyExact.set(r.legacy, []);
    legacyExact.get(r.legacy).push(r);
  }
  let emptyLinkEvents = 0;
  const fallbackLeaks = [];
  for (const e of eventById.values()) {
    if (e.classesLink.length > 0) continue;
    emptyLinkEvents++;
    // App fallback matches legacy_booking_id == event.eventId (and == booking.simplybookId, which we approximate by event_id only here)
    const matched = legacyExact.get(e.eventId) || [];
    if (matched.length === 0) continue;
    // Do any matched classes actually belong to a DIFFERENT event?
    const foreign = matched.filter((r) => r.eventLink.length > 0 && !r.eventLink.includes(e.id));
    fallbackLeaks.push({
      event: e.eventId, school: e.school, matched: matched.length,
      foreign: foreign.length,
      foreignSchools: [...new Set(foreign.flatMap((r) => schoolOfClass(r)))],
    });
  }
  console.log(`Events with empty reverse-link (would hit text fallback): ${emptyLinkEvents}`);
  console.log(`Of those, ${fallbackLeaks.length} would text-match >=1 class by event_id string.`);
  const realLeaks = fallbackLeaks.filter((x) => x.foreign > 0);
  console.log(`SMOKING GUN: ${realLeaks.length} would pull classes belonging to a DIFFERENT event:`);
  for (const x of cap(realLeaks)) {
    console.log(`   event="${x.event}" (${x.school}) matches=${x.matched} foreign=${x.foreign} foreignSchools=${JSON.stringify(x.foreignSchools)}`);
  }
  console.log('');

  // -------- Mechanism 3: classes linked to MULTIPLE events (appear in multiple reverse-links)
  console.log('--- [B3] Classes whose event_id link points to MORE THAN ONE event (leak via primary path) ---');
  const multiLink = rows.filter((r) => r.eventLink.length > 1);
  console.log(`Found ${multiLink.length} class(es) linked to multiple events:`);
  for (const r of cap(multiLink)) {
    const schools = r.eventLink.map((id) => eventById.get(id)?.school || id);
    console.log(`   class="${r.name}" id=${r.classId} links=${r.eventLink.length} schools=${JSON.stringify([...new Set(schools)])}`);
  }
  console.log('');

  // -------- Mechanism 4: reverse-link references a class whose own event_id does NOT include this event
  console.log('--- [B4] Event.classes reverse-link entries whose class.event_id does NOT point back (stale/inconsistent) ---');
  let inconsistent = [];
  for (const e of eventById.values()) {
    for (const cid of e.classesLink) {
      const r = rowById.get(cid);
      if (!r) { inconsistent.push({ event: e.eventId, school: e.school, classId: cid, reason: 'class record not loaded/exists' }); continue; }
      if (r.eventLink.length > 0 && !r.eventLink.includes(e.id)) {
        inconsistent.push({ event: e.eventId, school: e.school, classId: r.classId, name: r.name, classSchools: schoolOfClass(r) });
      }
    }
  }
  console.log(`Found ${inconsistent.length} inconsistent reverse-link entr(ies):`);
  for (const x of cap(inconsistent)) console.log('   ' + JSON.stringify(x));
  console.log('');

  console.log('==================================================================');
  console.log('BUG A — WRONG / MISSING CLASS NAMES');
  console.log('==================================================================\n');

  // -------- A1: blank class names
  console.log('--- [A1] Classes with blank/empty class_name ---');
  const blank = rows.filter((r) => !String(r.name).trim());
  console.log(`Found ${blank.length} class(es) with blank name.`);
  for (const r of cap(blank)) {
    const schools = schoolOfClass(r);
    console.log(`   id=${r.classId} legacy="${r.legacy}" type=${r.type} default=${r.isDefault} schools=${JSON.stringify(schools)}`);
  }
  console.log('');

  // -------- A2: class_id collisions (tracklist writeback corruption + 'Unknown')
  console.log('--- [A2] class_id values shared by MULTIPLE class records (writeback can hit wrong record) ---');
  const byClassId = new Map();
  for (const r of rows) {
    if (!r.classId) continue;
    if (!byClassId.has(r.classId)) byClassId.set(r.classId, []);
    byClassId.get(r.classId).push(r);
  }
  const dupClassId = [...byClassId.entries()].filter(([, l]) => l.length > 1);
  console.log(`Found ${dupClassId.length} class_id value(s) on >1 record:`);
  for (const [cid, l] of cap(dupClassId)) {
    const schools = [...new Set(l.flatMap((r) => schoolOfClass(r)))];
    console.log(`   class_id=${cid} records=${l.length} names=${JSON.stringify(l.map((r) => r.name))} schools=${JSON.stringify(schools)}`);
  }
  console.log('');

  console.log('==================================================================');
  console.log('SUMMARY');
  console.log('==================================================================');
  console.log(`B1 cross-event legacy_booking_id collisions : ${crossEventLegacy.length}`);
  console.log(`B2 empty-link events that text-match classes : ${fallbackLeaks.length}  (foreign leaks: ${realLeaks.length})`);
  console.log(`B3 multi-event linked classes               : ${multiLink.length}`);
  console.log(`B4 inconsistent reverse-link entries        : ${inconsistent.length}`);
  console.log(`A1 blank class names                        : ${blank.length}`);
  console.log(`A2 duplicate class_id records               : ${dupClassId.length}`);
}

main().catch((err) => { console.error('DIAGNOSTIC FAILED:', err); process.exit(1); });
