/**
 * Migration Script: Map old task template_ids to new v2 timeline IDs
 *
 * This script:
 * 1. Fetches all tasks from the Tasks table
 * 2. Updates template_id fields using the old-to-new mapping
 * 3. Recalculates timeline_offset and deadline based on new offsets
 * 4. For upcoming/pending events, creates missing tasks for new template types
 * 5. Processes in batches of 10 (Airtable rate limits)
 * 6. Logs all changes
 *
 * Usage:
 *   npx ts-node scripts/migrate-task-templates.ts
 *   npx ts-node scripts/migrate-task-templates.ts --dry-run
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import {
  TASK_TIMELINE,
  getTimelineEntry,
  calculateDeadline,
} from '../src/lib/config/taskTimeline';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID in .env.local');
  process.exit(1);
}

const TASKS_TABLE_ID = 'tblf59JyawJjgDqPJ';
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';

const TASKS_FIELD_IDS = {
  task_id: 'fldYwXmqYLHXmCd1B',
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
} as const;

const EVENTS_FIELD_IDS = {
  event_id: 'fldcNaHZyr6E5khDe',
  school_name: 'fld5QcpEsDFrLun6w',
  event_date: 'fld7pswBblm9jlOsS',
  status: 'fld636QqQuc5Uwyec',
} as const;

/** Mapping from old template_id to new template_id */
const TEMPLATE_MAPPING: Record<string, string> = {
  poster_letter: 'ship_poster',
  flyer1: 'ship_flyer_1',
  flyer2: 'ship_flyer_2',
  flyer3: 'ship_flyer_3',
  minicard: 'order_minicard',
  order_schul_shirts: 'order_schul_clothing',
};

/** New task IDs that have no old equivalent and must be created for existing events */
const NEW_TASK_IDS = [
  'order_schul_clothing_2',
  'shipment_welle_1',
  'shipment_welle_2',
  'audio_master_cd',
  'audio_cd_production',
];

/** Map timeline prefix to Airtable task_type single-select value */
function prefixToTaskType(prefix: string, taskId: string): string {
  switch (prefix) {
    case 'Ship':
      return 'paper_order';
    case 'Order':
      return 'clothing_order';
    case 'Shipment':
      return 'shipping';
    case 'Audio':
      return taskId.startsWith('audio_master') ? 'cd_master' : 'cd_production';
    default:
      return 'paper_order';
  }
}

/** Map timeline completion type to Airtable completion_type single-select value */
function mapCompletionType(completion: string): string {
  switch (completion) {
    case 'monetary':
      return 'monetary';
    case 'orchestrated':
      return 'checkbox';
    case 'tracklist':
      return 'submit_only';
    case 'quantity_checkbox':
      return 'checkbox';
    default:
      return 'submit_only';
  }
}

// ---------------------------------------------------------------------------
// Airtable API helpers
// ---------------------------------------------------------------------------

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

const BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;

const headers = {
  Authorization: `Bearer ${AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json',
};

async function fetchAllRecords(
  tableId: string,
  params: Record<string, string> = {}
): Promise<AirtableRecord[]> {
  const all: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const query = new URLSearchParams({
      ...params,
      returnFieldsByFieldId: 'true',
      ...(offset ? { offset } : {}),
    });

    const url = `${BASE_URL}/${tableId}?${query.toString()}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable fetch failed (${tableId}): ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as AirtableListResponse;
    all.push(...data.records);
    offset = data.offset;
  } while (offset);

  return all;
}

async function updateRecordsBatch(
  tableId: string,
  updates: Array<{ id: string; fields: Record<string, unknown> }>
): Promise<void> {
  // Airtable allows max 10 records per PATCH request
  for (let i = 0; i < updates.length; i += 10) {
    const batch = updates.slice(i, i + 10);

    const response = await fetch(`${BASE_URL}/${tableId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ records: batch }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable update failed: ${response.status} ${errorText}`);
    }

    // Respect rate limit: brief pause between batches
    if (i + 10 < updates.length) {
      await sleep(200);
    }
  }
}

async function createRecordsBatch(
  tableId: string,
  creates: Array<{ fields: Record<string, unknown> }>
): Promise<AirtableRecord[]> {
  const created: AirtableRecord[] = [];

  for (let i = 0; i < creates.length; i += 10) {
    const batch = creates.slice(i, i + 10);

    const response = await fetch(`${BASE_URL}/${tableId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ records: batch }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable create failed: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as { records: AirtableRecord[] };
    created.push(...data.records);

    // Respect rate limit
    if (i + 10 < creates.length) {
      await sleep(200);
    }
  }

  return created;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Migration logic
// ---------------------------------------------------------------------------

interface MigrationStats {
  tasksRenamed: number;
  tasksOffsetUpdated: number;
  tasksDeadlineRecalculated: number;
  newTasksCreated: number;
  eventsProcessed: number;
  skippedAlreadyMapped: number;
  skippedCompleted: number;
  errors: number;
}

async function migrate(dryRun: boolean) {
  const stats: MigrationStats = {
    tasksRenamed: 0,
    tasksOffsetUpdated: 0,
    tasksDeadlineRecalculated: 0,
    newTasksCreated: 0,
    eventsProcessed: 0,
    skippedAlreadyMapped: 0,
    skippedCompleted: 0,
    errors: 0,
  };

  console.log('\n' + '='.repeat(60));
  console.log('Task Template Migration: Old IDs -> New Timeline IDs');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE UPDATE'}`);
  console.log();

  // -----------------------------------------------------------------------
  // Step 1: Fetch all tasks
  // -----------------------------------------------------------------------
  console.log('Step 1: Fetching all tasks...');
  const allTasks = await fetchAllRecords(TASKS_TABLE_ID);
  console.log(`  Found ${allTasks.length} tasks\n`);

  // -----------------------------------------------------------------------
  // Step 2: Identify tasks that need template_id remapping
  // -----------------------------------------------------------------------
  console.log('Step 2: Identifying tasks to remap...');

  const oldTemplateIds = Object.keys(TEMPLATE_MAPPING);
  const newTemplateIds = TASK_TIMELINE.map((e) => e.id);

  const tasksToUpdate: Array<{ id: string; fields: Record<string, unknown> }> = [];
  // Track which events have which template_ids (using new IDs)
  const eventTemplateMap = new Map<string, Set<string>>();
  // Track event record IDs for linked record references
  const eventRecordIds = new Map<string, string>(); // eventRecordId -> eventRecordId (identity for lookup)

  for (const task of allTasks) {
    const templateId = task.fields[TASKS_FIELD_IDS.template_id] as string | undefined;
    const eventIds = task.fields[TASKS_FIELD_IDS.event_id] as string[] | undefined;
    const eventRecordId = eventIds?.[0];

    if (!templateId || !eventRecordId) continue;

    // Track existing templates per event (normalized to new IDs)
    const normalizedId = TEMPLATE_MAPPING[templateId] || templateId;
    if (!eventTemplateMap.has(eventRecordId)) {
      eventTemplateMap.set(eventRecordId, new Set());
    }
    eventTemplateMap.get(eventRecordId)!.add(normalizedId);

    // Check if this task uses an old template_id
    if (oldTemplateIds.includes(templateId)) {
      const newId = TEMPLATE_MAPPING[templateId];
      const entry = getTimelineEntry(newId);

      if (!entry) {
        console.log(`  WARNING: No timeline entry found for new ID "${newId}" (old: "${templateId}")`);
        stats.errors++;
        continue;
      }

      // Build the update payload
      const updateFields: Record<string, unknown> = {
        [TASKS_FIELD_IDS.template_id]: newId,
        [TASKS_FIELD_IDS.timeline_offset]: entry.offset,
        [TASKS_FIELD_IDS.task_name]: entry.displayName,
        [TASKS_FIELD_IDS.description]: entry.description,
        [TASKS_FIELD_IDS.completion_type]: mapCompletionType(entry.completion),
        [TASKS_FIELD_IDS.task_type]: prefixToTaskType(entry.prefix, entry.id),
      };

      console.log(`  REMAP: ${templateId} -> ${newId} (record ${task.id})`);
      console.log(`    offset: ${task.fields[TASKS_FIELD_IDS.timeline_offset]} -> ${entry.offset}`);

      tasksToUpdate.push({ id: task.id, fields: updateFields });
      stats.tasksRenamed++;
      stats.tasksOffsetUpdated++;
    } else if (newTemplateIds.includes(templateId)) {
      stats.skippedAlreadyMapped++;
    }
  }

  console.log(`\n  Tasks to remap: ${tasksToUpdate.length}`);
  console.log(`  Already using new IDs: ${stats.skippedAlreadyMapped}\n`);

  // -----------------------------------------------------------------------
  // Step 3: Apply updates (remap template_ids)
  // -----------------------------------------------------------------------
  if (tasksToUpdate.length > 0) {
    console.log(`Step 3: ${dryRun ? 'Would update' : 'Updating'} ${tasksToUpdate.length} tasks...`);

    if (!dryRun) {
      try {
        await updateRecordsBatch(TASKS_TABLE_ID, tasksToUpdate);
        console.log(`  Updated ${tasksToUpdate.length} tasks\n`);
      } catch (error) {
        console.error(`  ERROR updating tasks:`, error);
        stats.errors++;
      }
    } else {
      console.log(`  Would update ${tasksToUpdate.length} tasks (dry run)\n`);
    }
  } else {
    console.log('Step 3: No tasks need template_id remapping.\n');
  }

  // -----------------------------------------------------------------------
  // Step 4: Recalculate deadlines for all tasks (old and new)
  // -----------------------------------------------------------------------
  console.log('Step 4: Fetching events for deadline recalculation...');

  // Collect unique event record IDs from tasks
  const uniqueEventRecordIds = new Set<string>();
  for (const task of allTasks) {
    const eventIds = task.fields[TASKS_FIELD_IDS.event_id] as string[] | undefined;
    if (eventIds?.[0]) {
      uniqueEventRecordIds.add(eventIds[0]);
    }
  }

  // Fetch events to get their dates
  const allEvents = await fetchAllRecords(EVENTS_TABLE_ID);
  const eventDateMap = new Map<string, string>(); // eventRecordId -> event_date
  const eventStatusMap = new Map<string, string>(); // eventRecordId -> status
  const eventNameMap = new Map<string, string>(); // eventRecordId -> school_name

  for (const event of allEvents) {
    const eventDate = event.fields[EVENTS_FIELD_IDS.event_date] as string | undefined;
    const eventStatus = event.fields[EVENTS_FIELD_IDS.status] as string | undefined;
    const schoolName = event.fields[EVENTS_FIELD_IDS.school_name] as string | undefined;

    if (eventDate) {
      eventDateMap.set(event.id, eventDate);
    }
    if (eventStatus) {
      eventStatusMap.set(event.id, eventStatus);
    }
    if (schoolName) {
      eventNameMap.set(event.id, schoolName);
    }
  }

  console.log(`  Found ${allEvents.length} events, ${eventDateMap.size} with dates\n`);

  // Now recalculate deadlines for ALL tasks that have a valid template_id
  console.log('  Recalculating deadlines...');
  const deadlineUpdates: Array<{ id: string; fields: Record<string, unknown> }> = [];

  for (const task of allTasks) {
    const templateId = task.fields[TASKS_FIELD_IDS.template_id] as string | undefined;
    const eventIds = task.fields[TASKS_FIELD_IDS.event_id] as string[] | undefined;
    const eventRecordId = eventIds?.[0];
    const currentDeadline = task.fields[TASKS_FIELD_IDS.deadline] as string | undefined;

    if (!templateId || !eventRecordId) continue;

    // Normalize old template_id to new one
    const normalizedId = TEMPLATE_MAPPING[templateId] || templateId;
    const entry = getTimelineEntry(normalizedId);
    if (!entry) continue;

    const eventDate = eventDateMap.get(eventRecordId);
    if (!eventDate) continue;

    const newDeadline = calculateDeadline(eventDate, entry.offset);
    const newDeadlineStr = newDeadline.toISOString().split('T')[0];

    // Only update if deadline actually changed
    const currentDeadlineStr = currentDeadline?.split('T')[0];
    if (currentDeadlineStr !== newDeadlineStr) {
      deadlineUpdates.push({
        id: task.id,
        fields: {
          [TASKS_FIELD_IDS.deadline]: newDeadlineStr,
        },
      });
      stats.tasksDeadlineRecalculated++;
    }
  }

  console.log(`  ${deadlineUpdates.length} tasks need deadline recalculation`);

  if (deadlineUpdates.length > 0) {
    if (!dryRun) {
      try {
        await updateRecordsBatch(TASKS_TABLE_ID, deadlineUpdates);
        console.log(`  Updated ${deadlineUpdates.length} deadlines\n`);
      } catch (error) {
        console.error(`  ERROR updating deadlines:`, error);
        stats.errors++;
      }
    } else {
      // Show a sample in dry run
      const sample = deadlineUpdates.slice(0, 5);
      for (const u of sample) {
        const task = allTasks.find((t) => t.id === u.id);
        const templateId = task?.fields[TASKS_FIELD_IDS.template_id] as string;
        const oldDeadline = (task?.fields[TASKS_FIELD_IDS.deadline] as string)?.split('T')[0] || 'none';
        console.log(`    ${templateId}: ${oldDeadline} -> ${u.fields[TASKS_FIELD_IDS.deadline]}`);
      }
      if (deadlineUpdates.length > 5) {
        console.log(`    ... and ${deadlineUpdates.length - 5} more`);
      }
      console.log();
    }
  }

  // -----------------------------------------------------------------------
  // Step 5: Create missing tasks for upcoming/pending events
  // -----------------------------------------------------------------------
  console.log('Step 5: Creating missing tasks for upcoming events...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const newTaskCreates: Array<{ fields: Record<string, unknown> }> = [];

  for (const [eventRecordId, existingTemplates] of eventTemplateMap) {
    const eventDate = eventDateMap.get(eventRecordId);
    const eventStatus = eventStatusMap.get(eventRecordId);
    const schoolName = eventNameMap.get(eventRecordId) || 'Unknown';

    if (!eventDate) continue;

    const eventDateObj = new Date(eventDate);

    // Only create new tasks for upcoming events (event date in the future)
    // and not cancelled events
    if (eventDateObj < today) continue;
    if (eventStatus === 'Cancelled') continue;

    stats.eventsProcessed++;

    for (const newTaskId of NEW_TASK_IDS) {
      // Skip if this event already has this task
      if (existingTemplates.has(newTaskId)) continue;

      const entry = getTimelineEntry(newTaskId);
      if (!entry) {
        console.log(`  WARNING: No timeline entry for "${newTaskId}"`);
        continue;
      }

      const deadline = calculateDeadline(eventDate, entry.offset);
      const deadlineStr = deadline.toISOString().split('T')[0];

      console.log(`  CREATE: ${entry.displayName} for ${schoolName} (${eventDate}) -> deadline ${deadlineStr}`);

      newTaskCreates.push({
        fields: {
          [TASKS_FIELD_IDS.template_id]: entry.id,
          [TASKS_FIELD_IDS.event_id]: [eventRecordId],
          [TASKS_FIELD_IDS.task_type]: prefixToTaskType(entry.prefix, entry.id),
          [TASKS_FIELD_IDS.task_name]: entry.displayName,
          [TASKS_FIELD_IDS.description]: entry.description,
          [TASKS_FIELD_IDS.completion_type]: mapCompletionType(entry.completion),
          [TASKS_FIELD_IDS.timeline_offset]: entry.offset,
          [TASKS_FIELD_IDS.deadline]: deadlineStr,
          [TASKS_FIELD_IDS.status]: 'pending',
          [TASKS_FIELD_IDS.created_at]: new Date().toISOString().split('T')[0],
        },
      });

      stats.newTasksCreated++;
    }
  }

  console.log(`\n  Events eligible for new tasks: ${stats.eventsProcessed}`);
  console.log(`  New tasks to create: ${newTaskCreates.length}`);

  if (newTaskCreates.length > 0) {
    if (!dryRun) {
      try {
        const created = await createRecordsBatch(TASKS_TABLE_ID, newTaskCreates);
        console.log(`  Created ${created.length} new tasks\n`);
      } catch (error) {
        console.error(`  ERROR creating tasks:`, error);
        stats.errors++;
      }
    } else {
      console.log(`  Would create ${newTaskCreates.length} tasks (dry run)\n`);
    }
  } else {
    console.log('  No new tasks to create.\n');
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log('='.repeat(60));
  console.log('Migration Summary');
  console.log('='.repeat(60));
  console.log(`  Tasks remapped (template_id):     ${stats.tasksRenamed}`);
  console.log(`  Tasks offset updated:             ${stats.tasksOffsetUpdated}`);
  console.log(`  Tasks deadline recalculated:      ${stats.tasksDeadlineRecalculated}`);
  console.log(`  New tasks created:                ${stats.newTasksCreated}`);
  console.log(`  Events processed for new tasks:   ${stats.eventsProcessed}`);
  console.log(`  Already using new IDs (skipped):  ${stats.skippedAlreadyMapped}`);
  console.log(`  Errors:                           ${stats.errors}`);
  if (dryRun) {
    console.log('\n  (Dry run -- no changes were made)');
    console.log('  Run without --dry-run to apply changes.');
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const dryRun = process.argv.includes('--dry-run');

migrate(dryRun)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
