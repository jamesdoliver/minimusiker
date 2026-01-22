require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

const GROUPS_TABLE_ID = 'tblAPwTzqYTHbaz2k';

const GROUPS_FIELD_IDS = {
  group_id: 'fld6BW3r6uAADjuMx',
  group_name: 'fldiqq6p37u8G6iGs',
  event_id: 'fld1wQzJMIA4uCNeQ',
  member_classes: 'fldyeuP6wYE3DRrXX',
};

async function main() {
  const groupName = process.argv[2] || 'Verification Test Group';

  console.log('Searching for group: "' + groupName + '"\n');

  const records = await base(GROUPS_TABLE_ID).select({
    filterByFormula: 'SEARCH("' + groupName + '", {' + GROUPS_FIELD_IDS.group_name + '}) > 0',
    returnFieldsByFieldId: true,
  }).all();

  if (records.length === 0) {
    console.log('Group not found!');
    return;
  }

  console.log('SUCCESS: Found ' + records.length + ' group(s)\n');

  for (const record of records) {
    console.log('Record ID: ' + record.id);
    console.log('  group_id: ' + record.fields[GROUPS_FIELD_IDS.group_id]);
    console.log('  group_name: ' + record.fields[GROUPS_FIELD_IDS.group_name]);
    console.log('  event_id (linked): ' + JSON.stringify(record.fields[GROUPS_FIELD_IDS.event_id]));
    console.log('  member_classes (linked): ' + JSON.stringify(record.fields[GROUPS_FIELD_IDS.member_classes]));
    console.log('---');
  }
}

main().catch(console.error);
