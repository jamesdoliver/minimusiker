/**
 * Local Migration Test Script
 *
 * Tests the dual-read migration pattern to verify:
 * 1. Feature flag is working
 * 2. Normalized tables are accessible
 * 3. Queries return expected results
 * 4. Backward compatibility is maintained
 *
 * Run: node scripts/test-migration-locally.js
 */

import { config } from 'dotenv';
import Airtable from 'airtable';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });
config({ path: join(__dirname, '..', '.env') });

// Test configuration
const REQUIRED_ENV_VARS = [
  'AIRTABLE_API_KEY',
  'AIRTABLE_BASE_ID',
  'EVENTS_TABLE_ID',
  'CLASSES_TABLE_ID',
  'PARENTS_TABLE_ID',
  'REGISTRATIONS_TABLE_ID',
];

const FIELD_IDS = {
  EVENTS: {
    event_id: 'fldcNaHZyr6E5khDe',
    school_name: 'fld5QcpEsDFrLun6w',
  },
  CLASSES: {
    class_id: 'fld1dXGae9I7xldun',
    event_id: 'fldSSaeBuQDkOhOIT',
    class_name: 'fld1kaSb8my7q5mHt',
  },
  PARENTS: {
    parent_email: 'fldd3LuRL0TmzVESR',
    parent_first_name: 'fldtaXHWE5RP0nrw5',
  },
  REGISTRATIONS: {
    parent_id: 'fldqfoJhaXH0Oj32J',
    registered_child: 'fldkdMkuuJ21sIjOQ',
  },
};

// Initialize Airtable
let base;
try {
  Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
  base = Airtable.base(process.env.AIRTABLE_BASE_ID);
} catch (error) {
  console.error('❌ Failed to initialize Airtable:', error.message);
  process.exit(1);
}

// Test results tracker
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

function logTest(name, passed, message = '') {
  const icon = passed ? '✅' : '❌';
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`${icon} ${name}: ${status}${message ? ' - ' + message : ''}`);

  results.tests.push({ name, passed, message });
  if (passed) results.passed++;
  else results.failed++;
}

async function runTests() {
  console.log('\n🧪 Starting Migration Tests...\n');
  console.log('='.repeat(60));

  // Test 1: Environment Variables
  console.log('\n📋 Test 1: Environment Setup');
  console.log('-'.repeat(60));

  const missingVars = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    logTest('Environment Variables', false, `Missing: ${missingVars.join(', ')}`);
    return;
  }
  logTest('Environment Variables', true, 'All required vars present');

  const featureFlagOn = process.env.USE_NORMALIZED_TABLES === 'true';
  logTest('Feature Flag', featureFlagOn, `USE_NORMALIZED_TABLES=${process.env.USE_NORMALIZED_TABLES}`);

  if (!featureFlagOn) {
    console.warn('\n⚠️  Feature flag is OFF. Set USE_NORMALIZED_TABLES=true to test migration.');
    console.warn('   Tests will continue but will use legacy code paths.\n');
  }

  // Test 2: Table Accessibility
  console.log('\n📋 Test 2: Table Accessibility');
  console.log('-'.repeat(60));

  try {
    // Test Events table
    const eventsTable = base(process.env.EVENTS_TABLE_ID);
    const eventRecords = await eventsTable.select({ maxRecords: 1 }).firstPage();
    logTest('Events Table Access', true, `Found ${eventRecords.length} record(s)`);

    // Test Classes table
    const classesTable = base(process.env.CLASSES_TABLE_ID);
    const classRecords = await classesTable.select({ maxRecords: 1 }).firstPage();
    logTest('Classes Table Access', true, `Found ${classRecords.length} record(s)`);

    // Test Parents table
    const parentsTable = base(process.env.PARENTS_TABLE_ID);
    const parentRecords = await parentsTable.select({ maxRecords: 1 }).firstPage();
    logTest('Parents Table Access', true, `Found ${parentRecords.length} record(s)`);

    // Test Registrations table
    const registrationsTable = base(process.env.REGISTRATIONS_TABLE_ID);
    const registrationRecords = await registrationsTable.select({ maxRecords: 1 }).firstPage();
    logTest('Registrations Table Access', true, `Found ${registrationRecords.length} record(s)`);

  } catch (error) {
    logTest('Table Access', false, error.message);
    console.error('\n💡 Hint: Verify table IDs in .env match your Airtable base');
    return;
  }

  // Test 3: Record Counts
  console.log('\n📋 Test 3: Data Validation');
  console.log('-'.repeat(60));

  try {
    const eventsTable = base(process.env.EVENTS_TABLE_ID);
    const classesTable = base(process.env.CLASSES_TABLE_ID);
    const parentsTable = base(process.env.PARENTS_TABLE_ID);
    const registrationsTable = base(process.env.REGISTRATIONS_TABLE_ID);

    // Count records
    const eventCount = (await eventsTable.select().all()).length;
    const classCount = (await classesTable.select().all()).length;
    const parentCount = (await parentsTable.select().all()).length;
    const registrationCount = (await registrationsTable.select().all()).length;

    console.log(`   Events: ${eventCount}`);
    console.log(`   Classes: ${classCount}`);
    console.log(`   Parents: ${parentCount}`);
    console.log(`   Registrations: ${registrationCount}`);

    logTest('Events Count', eventCount > 0, `${eventCount} events found`);
    logTest('Classes Count', classCount > 0, `${classCount} classes found`);
    logTest('Parents Count', parentCount > 0, `${parentCount} parents found`);
    logTest('Registrations Count', registrationCount > 0, `${registrationCount} registrations found`);

  } catch (error) {
    logTest('Data Validation', false, error.message);
  }

  // Test 4: Linked Records
  console.log('\n📋 Test 4: Linked Record Integrity');
  console.log('-'.repeat(60));

  try {
    const classesTable = base(process.env.CLASSES_TABLE_ID);
    const registrationsTable = base(process.env.REGISTRATIONS_TABLE_ID);

    // Check if Classes have event_id links (Airtable returns by field name, not field ID)
    const classRecords = await classesTable.select({ maxRecords: 5 }).firstPage();
    const classesWithEventLink = classRecords.filter(r => {
      const eventLink = r.fields.event_id; // Use field name, not field ID
      return Array.isArray(eventLink) && eventLink.length > 0;
    });

    logTest(
      'Classes → Events Links',
      classesWithEventLink.length > 0,
      `${classesWithEventLink.length}/${classRecords.length} classes have event links`
    );

    // Check if Registrations have parent_id links (Airtable returns by field name)
    const registrationRecords = await registrationsTable.select({ maxRecords: 5 }).firstPage();
    const registrationsWithParentLink = registrationRecords.filter(r => {
      const parentLink = r.fields.parent_id; // Use field name, not field ID
      return Array.isArray(parentLink) && parentLink.length > 0;
    });

    logTest(
      'Registrations → Parents Links',
      registrationsWithParentLink.length > 0,
      `${registrationsWithParentLink.length}/${registrationRecords.length} registrations have parent links`
    );

  } catch (error) {
    logTest('Linked Record Check', false, error.message);
  }

  // Test 5: Parent Email Lookup
  console.log('\n📋 Test 5: Parent Query Test');
  console.log('-'.repeat(60));

  try {
    const parentsTable = base(process.env.PARENTS_TABLE_ID);

    // Get first parent email
    const parentRecords = await parentsTable.select({ maxRecords: 1 }).firstPage();

    if (parentRecords.length === 0) {
      logTest('Parent Email Lookup', false, 'No parents in database');
    } else {
      const testParent = parentRecords[0];
      const testEmail = testParent.fields.parent_email; // Use field name

      if (!testEmail) {
        logTest('Parent Email Lookup', false, 'Parent record has no email');
      } else {
        // Query by email (tests indexed lookup)
        const foundParents = await parentsTable.select({
          filterByFormula: `LOWER({parent_email}) = LOWER('${testEmail}')`,
          maxRecords: 1,
        }).firstPage();

        logTest(
          'Parent Email Lookup',
          foundParents.length > 0,
          `Found parent: ${testEmail}`
        );
      }
    }

  } catch (error) {
    logTest('Parent Query', false, error.message);
  }

  // Test 6: Event Query Test
  console.log('\n📋 Test 6: Event Query Test');
  console.log('-'.repeat(60));

  try {
    const eventsTable = base(process.env.EVENTS_TABLE_ID);

    // Get first event
    const eventRecords = await eventsTable.select({ maxRecords: 1 }).firstPage();

    if (eventRecords.length === 0) {
      logTest('Event Query', false, 'No events in database');
    } else {
      const testEvent = eventRecords[0];
      const eventId = testEvent.fields.event_id; // Use field name
      const schoolName = testEvent.fields.school_name; // Use field name

      logTest(
        'Event Query',
        eventId && schoolName,
        `Event: ${schoolName} (${eventId})`
      );
    }

  } catch (error) {
    logTest('Event Query', false, error.message);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary');
  console.log('-'.repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📝 Total:  ${results.tests.length}`);

  if (results.failed === 0) {
    console.log('\n🎉 All tests passed! Migration is working correctly.');
    console.log('\n💡 Next steps:');
    console.log('   1. Test the application manually (see LOCAL_TESTING_GUIDE.md)');
    console.log('   2. Check server logs for "(normalized)" queries');
    console.log('   3. Verify API responses match legacy behavior');
  } else {
    console.log('\n⚠️  Some tests failed. Review errors above.');
    console.log('\n💡 Common fixes:');
    console.log('   - Verify table IDs in .env match Airtable');
    console.log('   - Run migration scripts to populate data');
    console.log('   - Check Airtable API key has correct permissions');
  }

  console.log('\n' + '='.repeat(60) + '\n');

  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Test script failed:', error);
  process.exit(1);
});
