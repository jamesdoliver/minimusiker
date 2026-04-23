/**
 * Find all events with BOTH is_plus=true AND is_minimusikertag=true.
 * Same bug pattern as Grundschule Ochsenfurt — these events cannot receive
 * Minimusikertag-only tier emails (E-Mail 1 at -29d, Eltern - Wohoo at 0d)
 * because getEventTier returns 'plus' and template tier is 'minimusikertag'.
 */
const Airtable = require('airtable');
require('dotenv').config({ path: '.env.local' });
Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

const EVENTS_TABLE = 'tblVWx1RrsGRjsNn5';

async function main() {
  const events = await base(EVENTS_TABLE).select({}).all();

  const affected = [];
  for (const ev of events) {
    if (ev.get('is_plus') === true && ev.get('is_minimusikertag') === true) {
      affected.push({
        event_id: ev.get('event_id'),
        school: ev.get('school_name'),
        event_date: ev.get('event_date'),
        status: ev.get('status'),
        is_schulsong: ev.get('is_schulsong') === true ? 'x' : '',
        admin_approval: ev.get('admin_approval_status') || '—',
      });
    }
  }

  console.log(`Events with BOTH is_plus=true AND is_minimusikertag=true: ${affected.length}`);
  console.log(`Total events in Airtable: ${events.length}\n`);
  affected.sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''));
  console.table(affected);
}

main().catch(err => { console.error(err); process.exit(1); });
