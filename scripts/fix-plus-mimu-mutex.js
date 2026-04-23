/**
 * Fix events with BOTH is_plus=true AND is_minimusikertag=true.
 *
 * These flags should be mutually exclusive. Current bad state came from the
 * legacy Deal Builder auto-sync (removed 2026-03-16, commit 084c92f). After
 * cleanup, `getEventTier()` and `eventMatchesTemplate()` will resolve to
 * 'plus' consistently across the UI (segmented control already treats them
 * as PLUS because `isPlus ? 'plus' : ...`).
 *
 * Decision: clear is_minimusikertag, keep is_plus=true.
 *  - Matches the tier the system already treats them as
 *  - Matches the UI segmented control (PLUS wins)
 *  - Preserves all is_schulsong add-on state untouched
 *
 * Usage:
 *   node scripts/fix-plus-mimu-mutex.js             # dry-run (default)
 *   node scripts/fix-plus-mimu-mutex.js --apply     # actually write
 *   node scripts/fix-plus-mimu-mutex.js --apply --include-deleted  # also fix Deleted
 */
const Airtable = require('airtable');
require('dotenv').config({ path: '.env.local' });
Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

const EVENTS_TABLE = 'tblVWx1RrsGRjsNn5';
const FIELD_IS_MINIMUSIKERTAG = 'fld2GuudFY4Rk6f8i';

const APPLY = process.argv.includes('--apply');
const INCLUDE_DELETED = process.argv.includes('--include-deleted');

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (writes will happen)' : 'DRY-RUN (no writes)'}`);
  console.log(`Deleted events: ${INCLUDE_DELETED ? 'included' : 'skipped'}\n`);

  const events = await base(EVENTS_TABLE).select({}).all();
  const affected = events.filter(
    (ev) => ev.get('is_plus') === true && ev.get('is_minimusikertag') === true
  );

  const rows = affected.map((ev) => ({
    record_id: ev.id,
    event_id: ev.get('event_id'),
    school: ev.get('school_name'),
    date: ev.get('event_date'),
    status: ev.get('status') || '—',
    is_plus_before: true,
    is_mimu_before: true,
    is_schulsong_before: ev.get('is_schulsong') === true,
    is_plus_after: true,
    is_mimu_after: false,
    is_schulsong_after: ev.get('is_schulsong') === true,
  })).sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  console.log(`Found ${rows.length} events with both flags set:\n`);
  console.table(rows);

  const toUpdate = rows.filter((r) => INCLUDE_DELETED || r.status !== 'Deleted');
  const skipped = rows.length - toUpdate.length;
  console.log(`\nWill update: ${toUpdate.length}   Skipped (Deleted): ${skipped}`);

  if (!APPLY) {
    console.log('\nDRY-RUN — no changes made. Re-run with --apply to write.');
    return;
  }

  console.log('\nApplying updates...');
  let updated = 0;
  let failed = 0;
  for (const row of toUpdate) {
    try {
      await base(EVENTS_TABLE).update(row.record_id, {
        [FIELD_IS_MINIMUSIKERTAG]: false,
      });
      console.log(`  ✓ ${row.school} (${row.event_id})`);
      updated++;
    } catch (err) {
      console.error(`  ✗ ${row.school} (${row.event_id}): ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone. Updated: ${updated}   Failed: ${failed}`);

  if (updated > 0) {
    console.log('\nVerify:');
    console.log('  node scripts/audit-plus-minimusikertag-both.js');
  }
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
