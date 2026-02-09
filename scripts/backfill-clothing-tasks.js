#!/usr/bin/env node
/**
 * Backfill script: Create pending clothing order tasks for upcoming events
 *
 * For events within the next 60 days that don't already have a pending or completed
 * order_schul_shirts task, this script creates one with the calculated deadline.
 *
 * Run once after deployment:
 *   node scripts/backfill-clothing-tasks.js
 *
 * Use --dry-run to preview without creating tasks:
 *   node scripts/backfill-clothing-tasks.js --dry-run
 */

const Airtable = require('airtable');
require('dotenv').config({ path: '.env.local' });

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const TASKS_TABLE_ID = 'tblf59JyawJjgDqPJ';

const EVENTS_FIELD_IDS = {
  event_id: 'fldcNaHZyr6E5khDe',
  school_name: 'fld5QcpEsDFrLun6w',
  event_date: 'fld7pswBblm9jlOsS',
};

const TASKS_FIELD_IDS = {
  template_id: 'fldVXRwHmCbmRwAoe',
  event_id: 'fldsyDbcBy1yzjbdI',
  task_type: 'fld1BhaWmhl0opQBU',
  task_name: 'fldKx1kQZX571SlUG',
  description: 'fldOBfsp7Ahso72rJ',
  completion_type: 'fldLgArrpofS6dlHk',
  timeline_offset: 'flddNjbhxVtoKvzeE',
  deadline: 'fld3KdpL5s6HKYm6t',
  status: 'fldTlA0kywaIji0BL',
  created_at: 'fldt32Ff4DXY8ax47',
};

const TIMELINE_OFFSET = -18; // 18 days before event
const DRY_RUN = process.argv.includes('--dry-run');

function calculateDeadline(eventDate, offset) {
  const d = new Date(eventDate);
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

async function main() {
  if (DRY_RUN) {
    console.log('=== DRY RUN MODE - No changes will be made ===\n');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + 60);

  console.log(`Looking for events between ${today.toISOString().split('T')[0]} and ${futureDate.toISOString().split('T')[0]}...\n`);

  // Fetch upcoming events
  const events = await base(EVENTS_TABLE_ID)
    .select({
      filterByFormula: `AND(
        IS_AFTER({${EVENTS_FIELD_IDS.event_date}}, '${today.toISOString().split('T')[0]}'),
        IS_BEFORE({${EVENTS_FIELD_IDS.event_date}}, '${futureDate.toISOString().split('T')[0]}')
      )`,
      returnFieldsByFieldId: true,
    })
    .all();

  console.log(`Found ${events.length} upcoming events\n`);

  // Fetch all existing clothing order tasks (pending or completed)
  const existingTasks = await base(TASKS_TABLE_ID)
    .select({
      filterByFormula: `{${TASKS_FIELD_IDS.template_id}} = 'order_schul_shirts'`,
      returnFieldsByFieldId: true,
    })
    .all();

  const eventsWithClothingTask = new Set(
    existingTasks.map((t) => {
      const eventIds = t.fields[TASKS_FIELD_IDS.event_id];
      return eventIds?.[0];
    }).filter(Boolean)
  );

  console.log(`Found ${existingTasks.length} existing clothing tasks covering ${eventsWithClothingTask.size} events\n`);

  let created = 0;
  let skipped = 0;

  for (const event of events) {
    const eventRecordId = event.id;
    const schoolName = event.fields[EVENTS_FIELD_IDS.school_name] || 'Unknown';
    const eventDate = event.fields[EVENTS_FIELD_IDS.event_date];

    if (eventsWithClothingTask.has(eventRecordId)) {
      console.log(`  SKIP: ${schoolName} (${eventDate}) - already has clothing task`);
      skipped++;
      continue;
    }

    const deadline = calculateDeadline(eventDate, TIMELINE_OFFSET);

    if (DRY_RUN) {
      console.log(`  WOULD CREATE: ${schoolName} (${eventDate}) -> deadline ${deadline}`);
    } else {
      await base(TASKS_TABLE_ID).create({
        [TASKS_FIELD_IDS.template_id]: 'order_schul_shirts',
        [TASKS_FIELD_IDS.event_id]: [eventRecordId],
        [TASKS_FIELD_IDS.task_type]: 'clothing_order',
        [TASKS_FIELD_IDS.task_name]: 'Order School T-Shirts & Hoodies',
        [TASKS_FIELD_IDS.description]: 'Place supplier order for school-branded clothing items',
        [TASKS_FIELD_IDS.completion_type]: 'monetary',
        [TASKS_FIELD_IDS.timeline_offset]: TIMELINE_OFFSET,
        [TASKS_FIELD_IDS.deadline]: deadline,
        [TASKS_FIELD_IDS.status]: 'pending',
        [TASKS_FIELD_IDS.created_at]: new Date().toISOString(),
      });
      console.log(`  CREATED: ${schoolName} (${eventDate}) -> deadline ${deadline}`);
    }

    created++;
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}`);
  if (DRY_RUN) {
    console.log('\nRun without --dry-run to actually create the tasks.');
  }
}

main().catch(console.error);
