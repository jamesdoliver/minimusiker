/**
 * Test the Activity API endpoint directly
 */

import { config } from 'dotenv';
import Airtable from 'airtable';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });
config({ path: join(__dirname, '..', '.env') });

Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

const EVENT_ACTIVITY_TABLE_ID = 'tbljy6InuG4xMngQg';
const EVENTS_TABLE_ID = process.env.EVENTS_TABLE_ID;

// Field IDs for creating
const FIELD_IDS = {
  event_id: 'fldHXdy9XckysZkN5',
  activity_type: 'fldkq8kGUpN1EGMEm',
  description: 'flduPDeYq7N5JAhGm',
  actor_email: 'fld8BkhP9HrERtKdD',
  actor_type: 'flduzSRoFPcJZrjM8',
  metadata: 'fldkpYFQYLiv281jX',
};

async function testActivityApi() {
  console.log('🔍 Testing Activity API endpoint...\n');

  // 1. Get a test event
  const events = await base(EVENTS_TABLE_ID)
    .select({ maxRecords: 1 })
    .firstPage();

  const eventRecordId = events[0].id;
  const eventId = events[0].fields.event_id;
  console.log(`Test Event: ${events[0].fields.school_name}`);
  console.log(`Event ID: ${eventId}`);
  console.log(`Record ID: ${eventRecordId}\n`);

  // 2. Create a test activity
  console.log('Creating test activity...');
  const created = await base(EVENT_ACTIVITY_TABLE_ID).create([{
    fields: {
      [FIELD_IDS.event_id]: [eventRecordId],
      [FIELD_IDS.activity_type]: 'date_changed',
      [FIELD_IDS.description]: 'API Test - Event date changed from 2025-01-01 to 2025-01-02',
      [FIELD_IDS.actor_email]: 'test@minimusiker.de',
      [FIELD_IDS.actor_type]: 'admin',
      [FIELD_IDS.metadata]: JSON.stringify({ test: true, oldDate: '2025-01-01', newDate: '2025-01-02' }),
    }
  }]);
  const activityId = created[0].id;
  console.log(`Created activity: ${activityId}\n`);

  // 3. Create a mock admin token
  const mockAdminSession = {
    userId: 'test_user_id',
    email: 'test@minimusiker.de',
    role: 'admin',
    loginTimestamp: Date.now(),
  };
  const mockToken = jwt.sign(mockAdminSession, process.env.JWT_SECRET, { expiresIn: '1h' });

  // 4. Call the API endpoint
  console.log('Calling API endpoint...');
  const apiUrl = `http://localhost:3000/api/admin/events/${eventId}/activity`;
  console.log(`URL: ${apiUrl}\n`);

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Cookie: `admin_token=${mockToken}`,
      },
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(data, null, 2).slice(0, 500));

    if (data.success && data.data?.activities?.length > 0) {
      console.log('\n✅ API returned activities successfully!');
      console.log(`   Found ${data.data.activities.length} activities`);

      // Check if our test activity is there
      const testActivity = data.data.activities.find(a => a.id === activityId);
      if (testActivity) {
        console.log('   ✅ Test activity found in response');
      } else {
        console.log('   ⚠️ Test activity not found (might be on a different page)');
      }
    } else if (data.success && data.data?.activities?.length === 0) {
      console.log('\n⚠️ API returned 0 activities - might be filtering issue');
    } else {
      console.log('\n❌ API call failed:', data.error || 'Unknown error');
    }
  } catch (error) {
    console.log(`\n❌ Error calling API: ${error.message}`);
  }

  // 5. Cleanup
  console.log('\nCleaning up test activity...');
  await base(EVENT_ACTIVITY_TABLE_ID).destroy([activityId]);
  console.log('Done.');
}

testActivityApi().catch(console.error);
