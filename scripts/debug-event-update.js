// debug-event-update.js
// Debug why the link isn't being created

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const EVENT_ID = 'evt_grundschule_unterharmersbach_minimusiker_20260306_583f43';
const BOOKING_RECORD_ID = 'rec8wISalF0vhtiAW';
const EVENT_RECORD_ID = 'recxAML5oEjXBfDQ6';

const TABLES = {
  EVENTS: 'tblVWx1RrsGRjsNn5',
};

async function debug() {
  console.log('=== DEBUG EVENT UPDATE ===\n');

  // 1. Get the current event record with all fields
  console.log('--- Current Event State ---');
  const event = await base(TABLES.EVENTS).find(EVENT_RECORD_ID);
  console.log('All fields:', JSON.stringify(event.fields, null, 2));

  // 2. Try updating using field name instead of field ID
  console.log('\n--- Attempting Update with Field Name ---');
  try {
    const updated = await base(TABLES.EVENTS).update(EVENT_RECORD_ID, {
      'simplybook_booking': [BOOKING_RECORD_ID],
    });
    console.log('Update successful!');
    console.log('Updated fields:', JSON.stringify(updated.fields, null, 2));
  } catch (error) {
    console.log('Error with field name "simplybook_booking":', error.message);

    // Try alternative field names
    console.log('\n--- Trying alternative field names ---');

    // Get all field names from the record
    console.log('Available field names:', Object.keys(event.fields));
  }

  // 3. Verify final state
  console.log('\n--- Final Event State ---');
  const finalEvent = await base(TABLES.EVENTS).find(EVENT_RECORD_ID);
  console.log('simplybook_booking:', finalEvent.fields.simplybook_booking);
  console.log('All fields:', JSON.stringify(finalEvent.fields, null, 2));

  console.log('\n=== END DEBUG ===');
}

debug().catch(console.error);
