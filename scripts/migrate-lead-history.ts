/**
 * One-time migration: Parse Lead History from admin_notes and create
 * phone_call activity records in the EVENT_ACTIVITY table.
 *
 * Usage: npx tsx scripts/migrate-lead-history.ts [--dry-run]
 */
import Airtable from 'airtable';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID!);

const EVENTS_TABLE = 'tblVWx1RrsGRjsNn5';
const EVENT_ACTIVITY_TABLE = 'tbljy6InuG4xMngQg';

const ACTIVITY_FIELDS = {
  event_id: 'fldHXdy9XckysZkN5',
  activity_type: 'fldkq8kGUpN1EGMEm',
  description: 'flduPDeYq7N5JAhGm',
  actor_email: 'fld8BkhP9HrERtKdD',
  actor_type: 'flduzSRoFPcJZrjM8',
  metadata: 'fldkpYFQYLiv281jX',
};

interface ParsedCall {
  callNumber: number;
  date: string;
  notes: string;
}

function parseLeadHistory(adminNotes: string): { calls: ParsedCall[]; cleanedNotes: string } {
  const separator = '--- Lead History ---';
  const idx = adminNotes.indexOf(separator);
  if (idx === -1) return { calls: [], cleanedNotes: adminNotes };

  const cleanedNotes = adminNotes.substring(0, idx).trim();
  const historyText = adminNotes.substring(idx + separator.length).trim();

  const calls: ParsedCall[] = [];
  const blocks = historyText.split(/\n\n/).filter(Boolean);

  for (const block of blocks) {
    const match = block.match(/^\[Call (\d+) - (.+)\]\n([\s\S]*)$/);
    if (match) {
      calls.push({
        callNumber: parseInt(match[1]),
        date: match[2],
        notes: match[3].trim(),
      });
    }
  }

  return { calls, cleanedNotes };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(dryRun ? '=== DRY RUN ===' : '=== LIVE MIGRATION ===');

  // Fetch all events with admin_notes containing Lead History
  const records = await base(EVENTS_TABLE)
    .select({
      filterByFormula: `FIND("--- Lead History ---", {admin_notes})`,
      fields: ['admin_notes', 'school_name'],
    })
    .all();

  console.log(`Found ${records.length} events with Lead History`);

  let migratedCalls = 0;
  let errors = 0;

  for (const record of records) {
    const adminNotes = record.get('admin_notes') as string;
    const schoolName = record.get('school_name') as string || 'Unknown School';

    if (!adminNotes) continue;

    const { calls, cleanedNotes } = parseLeadHistory(adminNotes);

    if (calls.length === 0) {
      console.log(`  [SKIP] ${record.id} (${schoolName}) - no parseable calls`);
      continue;
    }

    console.log(`  [PROCESS] ${record.id} (${schoolName}) - ${calls.length} calls`);

    for (const call of calls) {
      const description = `Call '${schoolName}': ${call.notes}`;

      if (dryRun) {
        console.log(`    [DRY] Would create: ${description.substring(0, 80)}...`);
        migratedCalls++;
        continue;
      }

      try {
        await base(EVENT_ACTIVITY_TABLE).create([{
          fields: {
            [ACTIVITY_FIELDS.event_id]: [record.id],
            [ACTIVITY_FIELDS.activity_type]: 'phone_call',
            [ACTIVITY_FIELDS.description]: description,
            [ACTIVITY_FIELDS.actor_email]: 'migrated@minimusiker.de',
            [ACTIVITY_FIELDS.actor_type]: 'admin',
            [ACTIVITY_FIELDS.metadata]: JSON.stringify({
              migrated: true,
              originalCallNumber: call.callNumber,
              originalDate: call.date,
            }),
          },
        }]);
        migratedCalls++;
      } catch (err) {
        console.error(`    [ERROR] Failed to create activity for call ${call.callNumber}:`, err);
        errors++;
      }
    }

    // Clean the admin_notes field
    if (!dryRun) {
      try {
        await base(EVENTS_TABLE).update(record.id, {
          admin_notes: cleanedNotes,
        });
        console.log(`    [CLEANED] admin_notes for ${schoolName}`);
      } catch (err) {
        console.error(`    [ERROR] Failed to clean admin_notes:`, err);
        errors++;
      }
    } else {
      console.log(`    [DRY] Would clean admin_notes, keeping: "${cleanedNotes.substring(0, 50)}..."`);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Events processed: ${records.length}`);
  console.log(`Calls migrated: ${migratedCalls}`);
  console.log(`Errors: ${errors}`);
  if (dryRun) console.log('(Dry run - no changes made)');
}

main().catch(console.error);
