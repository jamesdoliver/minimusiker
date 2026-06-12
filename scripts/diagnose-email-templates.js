/**
 * READ-ONLY diagnostic for the timeline-email catch-up investigation.
 *
 * 1. Dumps every EMAIL_TEMPLATES record (name, type, triggerDays/Hour, audience,
 *    tier flags, only_under_100, active, slug, recordId) so we can see whether the
 *    school journey ("E-Mail 1/2", "Schul-Email 1/2", "Schul E-Mail 3") is one
 *    journey fragmented across renamed records.
 * 2. Reproduces the "Versand-Log Diagnose" by aggregating EMAIL_LOGS by
 *    template_name + status, so we can see the unequal school-step counts.
 *
 * Pure select() calls — writes nothing.
 */
const Airtable = require('airtable');
require('dotenv').config({ path: '.env.local' });
Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

const EMAIL_TEMPLATES_TABLE_ID = 'tbl9M6cOhR6OpYJRe';
const EMAIL_LOGS_TABLE_ID = 'tblxLemlKY8p8cIwS';

const T = {
  name: 'fldJnr0LjUf1fG3aK',
  audience: 'fldnmFNebIrstXsWT',
  trigger_days: 'fldqvR1BPJg3oSEFN',
  trigger_hour: 'fldZdp0R50gmHwLl2',
  active: 'fldBcHlpMUQCCN8iZ',
  is_minimusikertag: 'fldn63uUb14CkH4l3',
  is_kita: 'fldBCfeWCeVNErpQW',
  is_plus: 'fldHIcAFxGOHLMZD9',
  is_schulsong: 'fldbYsFdCwHoTvhmh',
  template_type: 'fld1FaqKGyWwWwOp6',
  trigger_slug: 'fldBJsRxe1PxvTXoL',
  only_under_100: 'fld5822FIA25rLMdn',
};

const L = {
  template_name: 'fldcNHa3GTYmp1mzp',
  status: 'fld0HyrvPQtWQDGTj',
  sent_at: 'fldHi7daVcCWpjrFj',
  event_id: 'fldejWMhTGwxz4Dr8',
};

const flag = (v) => (v === true ? 'x' : ' ');
const pad = (s, n) => String(s ?? '').padEnd(n).slice(0, n);

async function dumpTemplates() {
  const records = await base(EMAIL_TEMPLATES_TABLE_ID)
    .select({ returnFieldsByFieldId: true })
    .all();

  const rows = records.map((r) => ({
    id: r.id,
    name: r.get(T.name) || '',
    type: r.get(T.template_type) || '(none)',
    slug: r.get(T.trigger_slug) || '',
    days: r.get(T.trigger_days) ?? 0,
    hour: r.get(T.trigger_hour) ?? null,
    audience: Array.isArray(r.get(T.audience)) ? r.get(T.audience).join('+') : (r.get(T.audience) || ''),
    active: r.get(T.active) === true,
    mimi: flag(r.get(T.is_minimusikertag)),
    kita: flag(r.get(T.is_kita)),
    plus: flag(r.get(T.is_plus)),
    song: flag(r.get(T.is_schulsong)),
    u100: flag(r.get(T.only_under_100)),
  }));

  const timeline = rows
    .filter((x) => x.type !== 'trigger')
    .sort((a, b) => a.days - b.days);
  const triggers = rows.filter((x) => x.type === 'trigger');

  console.log('\n================ TIMELINE TEMPLATES (cron, day-threshold) ================');
  console.log(
    `${pad('name', 26)} ${pad('type', 9)} ${pad('days', 5)} ${pad('hr', 3)} ` +
      `${pad('audience', 18)} act mi ki pl so u100  recId`
  );
  for (const x of timeline) {
    console.log(
      `${pad(x.name, 26)} ${pad(x.type, 9)} ${pad(x.days, 5)} ${pad(x.hour, 3)} ` +
        `${pad(x.audience, 18)} ${x.active ? 'Y' : 'n'}   ${x.mimi}  ${x.kita}  ${x.plus}  ${x.song}  ${x.u100}    ${x.id}`
    );
  }

  console.log('\n================ TRIGGER TEMPLATES (state-driven, have slug) ================');
  for (const x of triggers) {
    console.log(`${pad(x.name, 30)} slug=${pad(x.slug, 34)} ${x.active ? 'Y' : 'n'}  ${x.id}`);
  }

  return rows;
}

async function dumpLogStats() {
  // Pull last 120 days of logs to comfortably cover the 90-day diagnose window.
  const cutoff = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
  const records = await base(EMAIL_LOGS_TABLE_ID)
    .select({
      returnFieldsByFieldId: true,
      filterByFormula: `IS_AFTER({${L.sent_at}}, '${cutoff}')`,
      fields: [L.template_name, L.status, L.sent_at, L.event_id],
    })
    .all();

  const byName = new Map();
  for (const r of records) {
    const name = r.get(L.template_name) || '(ohne Vorlage)';
    const status = r.get(L.status) || '(none)';
    const ev = r.get(L.event_id);
    const eventKey = Array.isArray(ev) ? ev[0] : ev;
    const row =
      byName.get(name) || { sent: 0, failed: 0, skipped: 0, other: 0, events: new Set() };
    if (status === 'sent') row.sent++;
    else if (status === 'failed') row.failed++;
    else if (status === 'skipped') row.skipped++;
    else row.other++;
    if (eventKey) row.events.add(eventKey);
    byName.set(name, row);
  }

  const sorted = [...byName.entries()].sort((a, b) => b[1].sent - a[1].sent);
  console.log(`\n================ EMAIL_LOGS by template_name (last 120d, ${records.length} rows) ================`);
  console.log(`${pad('template_name', 30)} ${pad('sent', 6)} ${pad('skip', 6)} ${pad('fail', 6)} ${pad('#events', 8)}`);
  for (const [name, row] of sorted) {
    console.log(
      `${pad(name, 30)} ${pad(row.sent, 6)} ${pad(row.skipped, 6)} ${pad(row.failed, 6)} ${pad(row.events.size, 8)}`
    );
  }
}

async function main() {
  if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
    console.error('Missing AIRTABLE_API_KEY / AIRTABLE_BASE_ID in .env.local');
    process.exit(1);
  }
  await dumpTemplates();
  await dumpLogStats();
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
