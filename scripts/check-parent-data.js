import { config } from 'dotenv';
import Airtable from 'airtable';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });

Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);
const parentsTable = base(process.env.PARENTS_TABLE_ID);

async function checkParentData() {
  console.log('\n📋 Checking admin parent data...\n');

  const parentRecords = await parentsTable.select({
    filterByFormula: `LOWER({parent_email}) = 'admin@minimusiker.de'`,
  }).firstPage();

  if (parentRecords.length === 0) {
    console.log('❌ No parent found');
    return;
  }

  const parent = parentRecords[0];
  console.log('Parent Record ID:', parent.id);
  console.log('\nAll fields:');
  console.log(JSON.stringify(parent.fields, null, 2));
}

checkParentData();
