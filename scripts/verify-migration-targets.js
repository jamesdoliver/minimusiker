#!/usr/bin/env node
/**
 * Verify that Event records exist for the migration target IDs
 */

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const EVENTS_FIELD_IDS = {
  event_id: 'fldz4RcnxiF9etFqb',
  school_name: 'fldXO2qLqXkT5z1vH',
  event_date: 'fld1bOOYDLLAP4CMC',
};

// Target event IDs from the migration
const TARGET_EVENT_IDS = [
  'evt_schule_an_der_ruhr_minimusiker_20260205_33c3a0',
  'evt_grundschule_st_nikolaus_herzla_minimusiker_20260211_0c85ab',
  'evt_grundschule_am_r_merbad_zunzwe_minimusiker_20260302_423bbd',
];

async function verify() {
  console.log('=== VERIFY MIGRATION TARGET EVENTS ===\n');

  const allEvents = await base(EVENTS_TABLE_ID)
    .select()
    .all();

  console.log(`Total Events in database: ${allEvents.length}\n`);

  for (const targetId of TARGET_EVENT_IDS) {
    const event = allEvents.find(e => e.fields.event_id === targetId);

    if (event) {
      console.log(`✓ FOUND: ${targetId}`);
      console.log(`    School: ${event.fields.school_name}`);
      console.log(`    Date: ${event.fields.event_date}`);
      console.log(`    Record ID: ${event.id}`);
    } else {
      console.log(`✗ NOT FOUND: ${targetId}`);
    }
    console.log('');
  }

  // Also show any events with similar names for debugging
  console.log('--- Events with "ruhr" in school name ---');
  const ruhrEvents = allEvents.filter(e =>
    e.fields.school_name?.toLowerCase().includes('ruhr')
  );
  for (const e of ruhrEvents) {
    console.log(`  ${e.fields.event_id} (${e.fields.school_name})`);
  }
}

verify().catch(console.error);
