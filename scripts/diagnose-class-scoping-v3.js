// diagnose-class-scoping-v3.js (READ-ONLY)
// For events with duplicate class NAMES, dump each duplicated record's
// class_id + legacy_booking_id + created info to reveal HOW the dup was created.

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const CLASSES_TABLE_ID = 'tbl17SVI5gacwOP0n';
const E = { event_id: 'fldcNaHZyr6E5khDe', school_name: 'fld5QcpEsDFrLun6w', classes: 'fld08ht43r8rknIPI' };
const C = { class_id: 'fld1dXGae9I7xldun', class_name: 'fld1kaSb8my7q5mHt', legacy_booking_id: 'fldXGF3yXrHeI4vWn', class_type: 'fldpYd9tFi09joNPV', is_default: 'fldJouWNH4fudWQl0', created_at: 'fld3q0jZPIAlsx8FD' };
const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

async function loadAll(tableId, fields) {
  const out = [];
  await base(tableId).select({ fields, returnFieldsByFieldId: true, pageSize: 100 })
    .eachPage((records, next) => { out.push(...records); next(); });
  return out;
}

async function main() {
  const events = await loadAll(EVENTS_TABLE_ID, [E.event_id, E.school_name, E.classes]);
  const classes = await loadAll(CLASSES_TABLE_ID, [C.class_id, C.class_name, C.legacy_booking_id, C.class_type, C.is_default, C.created_at]);
  const rowById = new Map(classes.map((c) => [c.id, {
    id: c.id, classId: c.fields[C.class_id] || '', name: c.fields[C.class_name] ?? '',
    legacy: c.fields[C.legacy_booking_id] ?? '', type: c.fields[C.class_type] || 'regular',
    isDefault: Boolean(c.fields[C.is_default]), created: c.fields[C.created_at] || '',
  }]));

  let dupDefaultSameId = 0, dupDefaultDiffId = 0, dupRealSameId = 0, dupRealDiffId = 0;

  for (const e of events) {
    const linkIds = arr(e.fields[E.classes]);
    const rows = linkIds.map((id) => rowById.get(id)).filter(Boolean);
    const byName = new Map();
    for (const r of rows) {
      const k = String(r.name).trim().toLowerCase();
      if (!byName.has(k)) byName.set(k, []);
      byName.get(k).push(r);
    }
    const dups = [...byName.entries()].filter(([k, l]) => l.length > 1 && k !== '');
    if (dups.length === 0) continue;

    console.log(`\n### ${e.fields[E.school_name]} | ${e.fields[E.event_id]}`);
    for (const [name, l] of dups) {
      const ids = new Set(l.map((r) => r.classId));
      const sameId = ids.size === 1;
      const isDef = l.some((r) => r.isDefault);
      if (isDef) sameId ? dupDefaultSameId++ : dupDefaultDiffId++;
      else sameId ? dupRealSameId++ : dupRealDiffId++;
      console.log(`  "${name}" ×${l.length}  classIdMatch=${sameId}`);
      for (const r of l) {
        console.log(`     rec=${r.id} class_id=${r.classId} legacy="${r.legacy}" type=${r.type} default=${r.isDefault} created=${r.created}`);
      }
    }
  }

  console.log('\n================ TALLY ================');
  console.log(`Duplicate DEFAULT "Alle Kinder"  — same class_id (idempotency bypassed): ${dupDefaultSameId}`);
  console.log(`Duplicate DEFAULT "Alle Kinder"  — different class_id (id-input drift) : ${dupDefaultDiffId}`);
  console.log(`Duplicate REAL class             — same class_id                       : ${dupRealSameId}`);
  console.log(`Duplicate REAL class             — different class_id                  : ${dupRealDiffId}`);
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
