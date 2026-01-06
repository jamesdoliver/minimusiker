import { config } from 'dotenv';
import Airtable from 'airtable';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });

Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);
const registrationsTable = base(process.env.REGISTRATIONS_TABLE_ID);

const parentRecordId = 'recqwG8NHzTP2luT0';

async function debugFilter() {
  console.log('\n🔍 Debugging filter logic...\n');
  console.log(`Looking for parent: ${parentRecordId}\n`);

  // Fetch all registrations
  const allRegistrations = await registrationsTable.select().all();
  console.log(`Total registrations: ${allRegistrations.length}\n`);

  // Check each registration
  allRegistrations.forEach((reg, index) => {
    console.log(`--- Registration ${index + 1} (${reg.id}) ---`);
    console.log('All fields:', JSON.stringify(reg.fields, null, 2));

    // Try accessing parent_id different ways
    console.log('\nAccess tests:');
    console.log('  reg.fields.parent_id:', reg.fields.parent_id);
    console.log('  reg.fields["parent_id"]:', reg.fields["parent_id"]);

    // Check if it includes our parent
    const parentIds = reg.fields.parent_id;
    console.log('  parentIds:', parentIds);
    console.log('  Is array?', Array.isArray(parentIds));

    if (parentIds) {
      console.log('  Includes our parent?', parentIds.includes(parentRecordId));
    }
    console.log('');
  });

  // Now test the filter
  console.log('\n--- Testing Filter ---');
  const filtered = allRegistrations.filter(reg => {
    const parentIds = reg.fields.parent_id;
    console.log(`Checking ${reg.id}: parentIds =`, parentIds, ', includes =', parentIds && parentIds.includes(parentRecordId));
    return parentIds && parentIds.includes(parentRecordId);
  });

  console.log(`\n✅ Filter found ${filtered.length} registration(s)`);

  if (filtered.length > 0) {
    console.log('\nMatching registrations:');
    filtered.forEach(reg => {
      console.log('  -', reg.id, ':', JSON.stringify(reg.fields, null, 2));
    });
  }
}

debugFilter().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
