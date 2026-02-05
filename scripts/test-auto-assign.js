// Test the auto-assign engineer logic directly
const Airtable = require('airtable');

const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const EVENTS_FIELD_IDS = {
  assigned_engineer: 'fldHK6sQA3jrU6O2H',
  auto_assigned_engineers: 'fldu8wnZ0MQ4k4KEg',
  is_schulsong: 'fld2ml1yiecD1a5ms'
};

const JAKOB_ID = 'recsl0R3cyVZp0cGm';
const MICHA_ID = 'recDl2SpoybZiB4GK';
const TEST_EVENT_ID = 'recpcsrfOEJjKRNe3';

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

async function addEngineerToEvent(eventRecordId, engineerId, isAutoAssigned) {
  const record = await base(EVENTS_TABLE_ID).find(eventRecordId);
  const currentEngineers = record.get('assigned_engineer') || [];
  const autoAssigned = record.get('auto_assigned_engineers') || [];

  if (!currentEngineers.includes(engineerId)) {
    const updates = {
      [EVENTS_FIELD_IDS.assigned_engineer]: [...currentEngineers, engineerId]
    };
    if (isAutoAssigned && !autoAssigned.includes(engineerId)) {
      updates[EVENTS_FIELD_IDS.auto_assigned_engineers] = [...autoAssigned, engineerId];
    }
    await base(EVENTS_TABLE_ID).update(eventRecordId, updates);
    console.log('  Added engineer', engineerId, '(auto:', isAutoAssigned, ')');
  } else {
    console.log('  Engineer', engineerId, 'already assigned');
  }
}

async function removeAutoAssignedEngineer(eventRecordId, engineerId) {
  const record = await base(EVENTS_TABLE_ID).find(eventRecordId);
  const currentEngineers = record.get('assigned_engineer') || [];
  const autoAssigned = record.get('auto_assigned_engineers') || [];

  if (autoAssigned.includes(engineerId)) {
    const newEngineers = currentEngineers.filter(id => id !== engineerId);
    const newAutoAssigned = autoAssigned.filter(id => id !== engineerId);
    await base(EVENTS_TABLE_ID).update(eventRecordId, {
      [EVENTS_FIELD_IDS.assigned_engineer]: newEngineers,
      [EVENTS_FIELD_IDS.auto_assigned_engineers]: newAutoAssigned
    });
    console.log('  Removed auto-assigned engineer', engineerId);
  } else {
    console.log('  Engineer', engineerId, 'not auto-assigned, preserving');
  }
}

async function ensureDefaultEngineers(eventRecordId, isSchulsong) {
  console.log('\n=== ensureDefaultEngineers(isSchulsong:', isSchulsong, ') ===');
  // Jakob always assigned
  await addEngineerToEvent(eventRecordId, JAKOB_ID, true);
  // Micha only if schulsong
  if (isSchulsong) {
    await addEngineerToEvent(eventRecordId, MICHA_ID, true);
  } else {
    await removeAutoAssignedEngineer(eventRecordId, MICHA_ID);
  }
}

async function showEventState(label) {
  const record = await base(EVENTS_TABLE_ID).find(TEST_EVENT_ID);
  console.log('\n[' + label + ']');
  console.log('  assigned_engineer:', JSON.stringify(record.get('assigned_engineer')));
  console.log('  auto_assigned_engineers:', JSON.stringify(record.get('auto_assigned_engineers')));
  console.log('  is_schulsong:', record.get('is_schulsong'));
}

async function test() {
  console.log('Testing auto-assign engineers on event:', TEST_EVENT_ID);
  console.log('Jakob ID:', JAKOB_ID);
  console.log('Micha ID:', MICHA_ID);

  await showEventState('BEFORE');

  // Test 1: Toggle schulsong ON
  console.log('\n>>> Setting is_schulsong = TRUE');
  await base(EVENTS_TABLE_ID).update(TEST_EVENT_ID, { [EVENTS_FIELD_IDS.is_schulsong]: true });
  await ensureDefaultEngineers(TEST_EVENT_ID, true);
  await showEventState('AFTER schulsong ON');

  // Test 2: Toggle schulsong OFF
  console.log('\n>>> Setting is_schulsong = FALSE');
  await base(EVENTS_TABLE_ID).update(TEST_EVENT_ID, { [EVENTS_FIELD_IDS.is_schulsong]: false });
  await ensureDefaultEngineers(TEST_EVENT_ID, false);
  await showEventState('AFTER schulsong OFF');

  // Test 3: Toggle schulsong ON again
  console.log('\n>>> Setting is_schulsong = TRUE again');
  await base(EVENTS_TABLE_ID).update(TEST_EVENT_ID, { [EVENTS_FIELD_IDS.is_schulsong]: true });
  await ensureDefaultEngineers(TEST_EVENT_ID, true);
  await showEventState('AFTER schulsong ON again');

  console.log('\n=== TEST COMPLETE ===');
}

test().catch(console.error);
