// diagnose-class-scoping-v2.js  (READ-ONLY)
// Per-event class composition: duplicate names within an event, visible blank
// names, and the actual events behind the anomalies found in v1.

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const CLASSES_TABLE_ID = 'tbl17SVI5gacwOP0n';
const E = { event_id: 'fldcNaHZyr6E5khDe', school_name: 'fld5QcpEsDFrLun6w', event_date: 'fld7pswBblm9jlOsS', classes: 'fld08ht43r8rknIPI' };
const C = { class_id: 'fld1dXGae9I7xldun', event_id: 'fldSSaeBuQDkOhOIT', class_name: 'fld1kaSb8my7q5mHt', legacy_booking_id: 'fldXGF3yXrHeI4vWn', class_type: 'fldpYd9tFi09joNPV', is_default: 'fldJouWNH4fudWQl0' };
const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

async function loadAll(tableId, fields) {
  const out = [];
  await base(tableId).select({ fields, returnFieldsByFieldId: true, pageSize: 100 })
    .eachPage((records, next) => { out.push(...records); next(); });
  return out;
}

async function main() {
  const events = await loadAll(EVENTS_TABLE_ID, [E.event_id, E.school_name, E.event_date, E.classes]);
  const classes = await loadAll(CLASSES_TABLE_ID, [C.class_id, C.event_id, C.class_name, C.legacy_booking_id, C.class_type, C.is_default]);

  const rowById = new Map();
  for (const c of classes) {
    rowById.set(c.id, {
      id: c.id,
      classId: c.fields[C.class_id] || '',
      name: c.fields[C.class_name] ?? '',
      legacy: c.fields[C.legacy_booking_id] ?? '',
      type: c.fields[C.class_type] || 'regular',
      isDefault: Boolean(c.fields[C.is_default]),
      eventLink: arr(c.fields[C.event_id]),
    });
  }

  // ---- Per-event analysis using the Event.classes reverse-link (what teacher portal renders)
  const dupNameEvents = [];
  const visibleBlankEvents = [];
  let eventsWithClasses = 0;

  for (const e of events) {
    const school = e.fields[E.school_name] || '';
    const eventId = e.fields[E.event_id] || '';
    const date = e.fields[E.event_date] || '';
    const linkIds = arr(e.fields[E.classes]);
    if (linkIds.length === 0) continue;
    eventsWithClasses++;

    const rows = linkIds.map((id) => rowById.get(id)).filter(Boolean);

    // What the teacher portal shows: every reverse-linked class verbatim (no default-hide, no type filter)
    const teacherVisible = rows; // teacherService pushes ALL of them
    // What parent registration shows: registrable types, default hidden if real classes exist
    const registrable = rows.filter((r) => r.type === 'regular');
    const nonDefault = registrable.filter((r) => !r.isDefault);
    const parentVisible = nonDefault.length > 0 ? nonDefault : registrable;

    // Duplicate NAMES among teacher-visible classes (case-insensitive, trimmed)
    const nameCount = new Map();
    for (const r of teacherVisible) {
      const k = String(r.name).trim().toLowerCase();
      nameCount.set(k, (nameCount.get(k) || 0) + 1);
    }
    const dups = [...nameCount.entries()].filter(([k, n]) => n > 1 && k !== '');
    if (dups.length > 0) {
      dupNameEvents.push({ school, eventId, date, dups: dups.map(([k, n]) => `"${k}"×${n}`), classNames: teacherVisible.map((r) => `${r.name}[${r.type}${r.isDefault ? ',default' : ''}]`) });
    }

    // Visible blank names (blank name AND would be shown)
    const blankTeacher = teacherVisible.filter((r) => !String(r.name).trim());
    const blankParent = parentVisible.filter((r) => !String(r.name).trim());
    if (blankTeacher.length > 0 || blankParent.length > 0) {
      visibleBlankEvents.push({ school, eventId, date, blankTeacher: blankTeacher.length, blankParent: blankParent.length, ids: blankTeacher.map((r) => r.classId) });
    }
  }

  console.log(`Events with >=1 linked class: ${eventsWithClasses}\n`);

  console.log('=== Events where the TEACHER class list shows DUPLICATE class names ===');
  console.log(`Count: ${dupNameEvents.length}`);
  for (const x of dupNameEvents.slice(0, 25)) {
    console.log(`\n  ${x.school} | ${x.eventId} | ${x.date}`);
    console.log(`    duplicates: ${x.dups.join(', ')}`);
    console.log(`    full list : ${x.classNames.join(', ')}`);
  }

  console.log('\n=== Events where a VISIBLE class has a blank name ===');
  console.log(`Count: ${visibleBlankEvents.length}`);
  for (const x of visibleBlankEvents.slice(0, 25)) {
    console.log(`  ${x.school} | ${x.eventId} | teacherBlank=${x.blankTeacher} parentBlank=${x.blankParent} ids=${JSON.stringify(x.ids)}`);
  }

  // ---- Detail on duplicate class_id records: same event? both in reverse-link?
  console.log('\n=== Duplicate class_id records — are both in the same event reverse-link? ===');
  const byClassId = new Map();
  for (const r of rowById.values()) {
    if (!r.classId) continue;
    if (!byClassId.has(r.classId)) byClassId.set(r.classId, []);
    byClassId.get(r.classId).push(r);
  }
  const reverseLinkOf = new Map(); // class record id -> set of event ids that reverse-link it
  for (const e of events) {
    for (const cid of arr(e.fields[E.classes])) {
      if (!reverseLinkOf.has(cid)) reverseLinkOf.set(cid, []);
      reverseLinkOf.get(cid).push(e.fields[E.event_id] || e.id);
    }
  }
  for (const [cid, list] of byClassId) {
    if (list.length < 2) continue;
    console.log(`\n  class_id=${cid} (${list.length} records)`);
    for (const r of list) {
      console.log(`    record=${r.id} name="${r.name}" type=${r.type} default=${r.isDefault} legacy="${r.legacy}" reverseLinkedBy=${JSON.stringify(reverseLinkOf.get(r.id) || [])}`);
    }
  }
}

main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
