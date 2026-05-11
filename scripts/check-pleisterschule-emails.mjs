#!/usr/bin/env node
import 'dotenv/config';
import Airtable from 'airtable';

const EVENT_ID = 'evt_pleisterschule_minimusiker_20260603_5874e6';
const EVENT_RECORD_ID = 'recDfzIX7sCJTontJ';

const EMAIL_LOGS_TABLE_ID = 'tblxLemlKY8p8cIwS';
const EMAIL_LOGS_F = {
  template_name: 'fldcNHa3GTYmp1mzp',
  event_id: 'fldejWMhTGwxz4Dr8',
  recipient_email: 'fldsg3jsbFjCtCj4O',
  recipient_type: 'fldP4i5NjOFb8n711',
  sent_at: 'fldHi7daVcCWpjrFj',
  status: 'fld0HyrvPQtWQDGTj',
  error_message: 'fldObgfIAwwOjVWJC',
};

const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const EVENTS_F = {
  school_name: 'fld5QcpEsDFrLun6w',
  event_date: 'fld7pswBblm9jlOsS',
  status: 'fld636QqQuc5Uwyec',
  is_minimusikertag: 'fld2GuudFY4Rk6f8i',
  is_plus: 'fldMFQPU0v0SEmGqJ',
  is_schulsong: 'fld2ml1yiecD1a5ms',
  is_kita: 'flddRbQV0qoqR3KIr',
  timeline_overrides: 'fld25hstx4yePlpnB',
  teachers: 'fldivuUPiW6Q09vce',
  simplybook_booking: 'fldK7vyxLd9MxgmES',
  created_at: 'fldnOuSFihr3HrJkF',
};

Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

console.log(`\n=== Pleisterschule email audit (event_id=${EVENT_ID}) ===\n`);

// 1) Verify the event row itself
const eventRec = await base(EVENTS_TABLE_ID).find(EVENT_RECORD_ID);
const f = eventRec.fields;
console.log('EVENT ROW:');
console.log('  school_name        :', f[EVENTS_F.school_name]);
console.log('  event_date         :', f[EVENTS_F.event_date]);
console.log('  status             :', f[EVENTS_F.status]);
console.log('  created_at         :', f[EVENTS_F.created_at]);
console.log('  is_minimusikertag  :', f[EVENTS_F.is_minimusikertag]);
console.log('  is_plus            :', f[EVENTS_F.is_plus]);
console.log('  is_schulsong       :', f[EVENTS_F.is_schulsong]);
console.log('  is_kita            :', f[EVENTS_F.is_kita]);
console.log('  timeline_overrides :', f[EVENTS_F.timeline_overrides] || '(empty)');
console.log('  teachers (linked)  :', f[EVENTS_F.teachers] || '(none)');
console.log('  simplybook (linked):', f[EVENTS_F.simplybook_booking] || '(none)');

const today = new Date('2026-05-11');
const evDate = new Date(f[EVENTS_F.event_date]);
const daysUntil = Math.round((evDate - today) / (1000 * 60 * 60 * 24));
console.log(`  → ${daysUntil} days from today (2026-05-11)\n`);

// 2) Pull all EMAIL_LOGS rows for this event_id
console.log('EMAIL_LOGS rows for this event:');
const logs = await base(EMAIL_LOGS_TABLE_ID).select({
  filterByFormula: `{${EMAIL_LOGS_F.event_id}} = '${EVENT_ID.replace(/'/g, "\\'")}'`,
  returnFieldsByFieldId: true,
}).all();

if (logs.length === 0) {
  console.log('  (none — no email_logs rows reference this event_id)');
} else {
  // Sort by sent_at desc
  logs.sort((a, b) => {
    const aDate = new Date(a.fields[EMAIL_LOGS_F.sent_at] || 0);
    const bDate = new Date(b.fields[EMAIL_LOGS_F.sent_at] || 0);
    return bDate - aDate;
  });
  for (const log of logs) {
    const lf = log.fields;
    console.log(
      `  [${lf[EMAIL_LOGS_F.status]}]`,
      `${lf[EMAIL_LOGS_F.sent_at]?.slice(0, 16) || '?'}`,
      `· "${lf[EMAIL_LOGS_F.template_name]}"`,
      `→ ${lf[EMAIL_LOGS_F.recipient_email]} (${lf[EMAIL_LOGS_F.recipient_type]})`
    );
    if (lf[EMAIL_LOGS_F.error_message]) {
      console.log(`    ⚠ error: ${lf[EMAIL_LOGS_F.error_message]}`);
    }
  }
}

console.log(`\nTotal log rows: ${logs.length}`);
console.log(`Grouped by status: ${JSON.stringify(
  logs.reduce((acc, l) => {
    const s = l.fields[EMAIL_LOGS_F.status] || 'unknown';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {})
)}`);

process.exit(0);
