/**
 * READ-ONLY sizing for the audio_free_without_purchase migration.
 *
 * Run with: npx tsx scripts/size-audio-free-migration.ts
 *
 * Context: the parent audio gate previously treated an event with the
 * `minicard_order_enabled` checkbox UNSET as "free audio for everyone after release".
 * The fix flips this to opt-in (`audio_free_without_purchase`), so every event where
 * `minicard_order_enabled` is not TRUE now becomes purchase-required by default.
 *
 * This script reports the BEHAVIOR-CHANGE set so a human can decide which events were
 * *intentionally* free and should get the new flag ticked. It modifies NOTHING.
 *
 *   - "Behavior change" = events with minicard_order_enabled !== true.
 *   - Of those, "was actively free" = also past the full-release window (event_date +
 *     full_release_days). These are the events whose parents could download for free
 *     until this fix ships — review them and tick audio_free_without_purchase on any
 *     that should stay free.
 *   - Events with minicard_order_enabled === true were already purchase-gated; no change.
 */

import { config } from 'dotenv';
import Airtable from 'airtable';

config({ path: '.env.local' });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const DEFAULT_FULL_RELEASE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in .env.local');
  process.exit(1);
}

function releaseDaysFor(overridesRaw: unknown): number {
  if (typeof overridesRaw !== 'string' || !overridesRaw.trim()) return DEFAULT_FULL_RELEASE_DAYS;
  try {
    const o = JSON.parse(overridesRaw);
    const v = o?.full_release_days;
    return typeof v === 'number' && v > 0 ? v : DEFAULT_FULL_RELEASE_DAYS;
  } catch {
    return DEFAULT_FULL_RELEASE_DAYS;
  }
}

interface Row {
  eventId: string;
  schoolName: string;
  eventDate: string;
  minicardEnabled: boolean;
  releaseDays: number;
}

async function main() {
  const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID!);

  const records: Airtable.Record<Airtable.FieldSet>[] = [];
  // Unrestricted select => fields are keyed BY NAME (matches the app's getEventByEventId path).
  await base(EVENTS_TABLE_ID)
    .select({ pageSize: 100 })
    .eachPage((recs, next) => {
      records.push(...recs);
      next();
    });

  const rows: Row[] = records.map((r) => ({
    eventId: (r.get('event_id') as string) || r.id,
    schoolName: (r.get('school_name') as string) || '(no name)',
    eventDate: (r.get('event_date') as string) || '',
    minicardEnabled: r.get('minicard_order_enabled') === true,
    releaseDays: releaseDaysFor(r.get('timeline_overrides')),
  }));

  const now = Date.now();
  const alreadyGated = rows.filter((r) => r.minicardEnabled);
  const behaviorChange = rows.filter((r) => !r.minicardEnabled);

  const wasActivelyFree = behaviorChange.filter((r) => {
    if (!r.eventDate) return false;
    const releaseMs = new Date(r.eventDate).getTime() + r.releaseDays * DAY_MS;
    return Number.isFinite(releaseMs) && now >= releaseMs;
  });
  const notYetReleased = behaviorChange.length - wasActivelyFree.length;

  console.log('='.repeat(72));
  console.log('audio_free_without_purchase — migration sizing (READ-ONLY)');
  console.log('='.repeat(72));
  console.log();
  console.log(`Total events scanned:                         ${rows.length}`);
  console.log(`minicard_order_enabled = TRUE (no change):    ${alreadyGated.length}`);
  console.log(`minicard_order_enabled != true (FLIPS):       ${behaviorChange.length}`);
  console.log(`  ...of those, past release (WAS free):       ${wasActivelyFree.length}`);
  console.log(`  ...of those, not yet released (no impact):  ${notYetReleased}`);
  console.log();
  console.log('Events that WERE giving free audio (past release, minicard_order_enabled unset).');
  console.log('Review each — tick audio_free_without_purchase on any that should STAY free:');
  console.log('-'.repeat(72));

  if (wasActivelyFree.length === 0) {
    console.log('  (none)');
  } else {
    wasActivelyFree
      .sort((a, b) => (a.eventDate < b.eventDate ? 1 : -1))
      .forEach((r) => {
        console.log(`  ${r.eventDate || '????-??-??'}  ${r.eventId.padEnd(12)}  ${r.schoolName}`);
      });
  }

  console.log();
  console.log('Note: release window uses full_release_days from timeline_overrides when present,');
  console.log(`else the ${DEFAULT_FULL_RELEASE_DAYS}-day default. This is sizing only — it does not check whether audio`);
  console.log('actually exists/was approved for each event, so treat it as an upper bound.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
