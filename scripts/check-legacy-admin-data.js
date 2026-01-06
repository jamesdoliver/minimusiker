/**
 * Check legacy parent_journey_table for admin@minimusiker.de
 */

import { config } from 'dotenv';
import Airtable from 'airtable';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });

// Initialize Airtable
Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

const parentJourneyTable = base('parent_journey_table');

async function checkLegacy() {
  console.log('\n🔍 Checking legacy parent_journey_table for admin@minimusiker.de...\n');

  const records = await parentJourneyTable.select({
    filterByFormula: `LOWER({parent_email}) = 'admin@minimusiker.de'`,
  }).all();

  console.log(`✅ Found ${records.length} record(s) in legacy table\n`);

  if (records.length === 0) {
    console.log('❌ No records found. admin@minimusiker.de may be an admin account without registrations.\n');
    console.log('💡 Try searching for a different parent email that has actual bookings.\n');

    // Show a few sample parent emails
    console.log('📋 Sample parent emails with bookings:\n');
    const sampleRecords = await parentJourneyTable.select({
      maxRecords: 5,
      filterByFormula: `AND({parent_email} != '', {booking_id} != '')`,
    }).firstPage();

    sampleRecords.forEach((r, i) => {
      console.log(`${i + 1}. ${r.fields.parent_email}`);
      console.log(`   School: ${r.fields.school_name || 'N/A'}`);
      console.log(`   Booking ID: ${r.fields.booking_id || 'N/A'}\n`);
    });

    return;
  }

  // Display results
  records.forEach((r, i) => {
    console.log(`Record ${i + 1}:`);
    console.log(`   School: ${r.fields.school_name || 'N/A'}`);
    console.log(`   Booking ID: ${r.fields.booking_id || 'N/A'}`);
    console.log(`   Event Date: ${r.fields.booking_date || 'N/A'}`);
    console.log(`   Class: ${r.fields.class || 'N/A'}`);
    console.log(`   Child: ${r.fields.registered_child || 'N/A'}`);
    console.log('');
  });

  console.log(`✅ ANSWER: Search for "${records[0].fields.school_name}"\n`);
}

checkLegacy().catch(error => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});
