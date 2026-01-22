/**
 * Verify registration data in Airtable
 */

import { config } from 'dotenv';
import Airtable from 'airtable';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });
config({ path: join(__dirname, '..', '.env') });

Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

const REGISTRATIONS_TABLE_ID = process.env.REGISTRATIONS_TABLE_ID;
const PARENTS_TABLE_ID = process.env.PARENTS_TABLE_ID;

const registrationRecordId = 'recRfkBzRB4kuho4u';

async function verifyRegistration() {
  console.log('🔍 Fetching Registration record:', registrationRecordId, '\n');

  try {
    const registration = await base(REGISTRATIONS_TABLE_ID).find(registrationRecordId);

    console.log('='.repeat(60));
    console.log('REGISTRATION RECORD FOUND');
    console.log('='.repeat(60));
    console.log('\nRecord ID:', registration.id);
    console.log('\nAll Fields:');

    const fields = registration.fields;
    for (const [key, value] of Object.entries(fields)) {
      const isEmpty = value === '' || value === null || value === undefined || (Array.isArray(value) && value.length === 0);
      const displayValue = Array.isArray(value) ? JSON.stringify(value) : value;
      const status = isEmpty ? '⚠️ EMPTY' : '✅';
      console.log(`  ${status} ${key}: ${displayValue}`);
    }

    // Check for expected fields
    console.log('\n' + '='.repeat(60));
    console.log('FIELD VERIFICATION');
    console.log('='.repeat(60));

    const expectedFields = [
      'registered_child',
      'parent_id',
      'class_id',
      'event_id',
      'registration_date'
    ];

    for (const field of expectedFields) {
      const value = fields[field];
      const isEmpty = value === '' || value === null || value === undefined || (Array.isArray(value) && value.length === 0);
      if (isEmpty) {
        console.log(`❌ ${field}: MISSING OR EMPTY`);
      } else {
        console.log(`✅ ${field}: ${Array.isArray(value) ? JSON.stringify(value) : value}`);
      }
    }

  } catch (error) {
    console.log('❌ Error fetching registration:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('VERIFICATION COMPLETE');
  console.log('='.repeat(60));
}

verifyRegistration().catch(console.error);
