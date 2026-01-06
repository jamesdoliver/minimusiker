/**
 * Clear all records from new tables before retrying migration
 */

import { config } from 'dotenv';
import Airtable from 'airtable';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });

Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

const TABLES = {
  EVENTS: process.env.EVENTS_TABLE_ID,
  CLASSES: process.env.CLASSES_TABLE_ID,
  PARENTS: process.env.PARENTS_TABLE_ID,
  REGISTRATIONS: process.env.REGISTRATIONS_TABLE_ID,
};

async function clearTable(tableName, tableId) {
  console.log(`🗑️  Clearing ${tableName}...`);

  const records = await base(tableId).select().all();

  if (records.length === 0) {
    console.log(`   ✓ Already empty (0 records)\n`);
    return;
  }

  console.log(`   Found ${records.length} records to delete`);

  // Delete in batches of 10
  const batchSize = 10;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const ids = batch.map(r => r.id);
    await base(tableId).destroy(ids);
    console.log(`   ✓ Deleted ${Math.min(i + batchSize, records.length)}/${records.length}`);

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`   ✅ Cleared ${tableName}\n`);
}

async function main() {
  console.log('\n🧹 Clearing new tables for migration retry...\n');

  await clearTable('Registrations', TABLES.REGISTRATIONS);
  await clearTable('Classes', TABLES.CLASSES);
  await clearTable('Parents', TABLES.PARENTS);
  await clearTable('Events', TABLES.EVENTS);

  console.log('✅ All tables cleared! Ready to retry migration.\n');
}

main().catch(console.error);
