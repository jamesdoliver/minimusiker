/**
 * Script to discover Airtable field IDs
 * Run with: npx dotenvx run -- npx ts-node scripts/discover-field-ids.ts
 */

const AIRTABLE_PAT = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
  console.error('Missing required environment variables: AIRTABLE_API_KEY and AIRTABLE_BASE_ID');
  console.error('Run with: npx @dotenvx/dotenvx run -f .env.local -- npx ts-node scripts/discover-field-ids.ts');
  process.exit(1);
}

async function discoverFields() {
  console.log('Fetching Airtable table metadata...\n');

  // Use metadata API to get field IDs
  const response = await fetch(
    `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables`,
    { headers: { Authorization: `Bearer ${AIRTABLE_PAT}` } }
  );

  if (!response.ok) {
    console.error('Failed to fetch metadata:', response.statusText);
    process.exit(1);
  }

  const data = await response.json();

  // Find Events table
  const eventsTable = data.tables.find((t: { name: string }) => t.name === 'Events');

  if (!eventsTable) {
    console.error('Events table not found');
    process.exit(1);
  }

  console.log('=== Events Table Fields ===\n');

  // Sort fields alphabetically for easier searching
  const fields = eventsTable.fields.sort((a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name)
  );

  fields.forEach((f: { name: string; id: string; type: string }) => {
    console.log(`${f.name}: '${f.id}'  // ${f.type}`);
  });

  // Look for the specific field we need
  console.log('\n=== Looking for auto_assigned_engineers field ===\n');
  const autoAssignedField = fields.find((f: { name: string }) =>
    f.name.toLowerCase().includes('auto') && f.name.toLowerCase().includes('engineer')
  );

  if (autoAssignedField) {
    console.log(`Found: ${autoAssignedField.name}: '${autoAssignedField.id}'`);
  } else {
    console.log('Field not found. Looking for any engineer-related fields:');
    const engineerFields = fields.filter((f: { name: string }) =>
      f.name.toLowerCase().includes('engineer')
    );
    engineerFields.forEach((f: { name: string; id: string; type: string }) => {
      console.log(`  ${f.name}: '${f.id}'  // ${f.type}`);
    });
  }
}

discoverFields().catch(console.error);
