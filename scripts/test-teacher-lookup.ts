/**
 * Integration test for teacher event lookup fix
 * Run with: npx tsx scripts/test-teacher-lookup.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { getTeacherService } from '../src/lib/services/teacherService';

async function testTeacherAccess() {
  const teacherService = getTeacherService();

  const email = 'kita.stbruno-luenten@bistum-muenster.de';

  console.log('Testing teacher event access for:', email);
  console.log('='.repeat(60));

  // Get all events for the teacher
  const events = await teacherService.getTeacherEvents(email);
  console.log('\n1. getTeacherEvents() returned', events.length, 'event(s)');

  if (events.length > 0) {
    const event = events[0];
    console.log('   First event:');
    console.log('     eventId:', event.eventId);
    console.log('     simplybookId:', event.simplybookId);
    console.log('     schoolName:', event.schoolName);
    console.log('     status:', event.status);
  }

  // Test lookup by canonical eventId
  console.log('\n2. Testing getTeacherEventDetail by canonical eventId...');
  const byEventId = await teacherService.getTeacherEventDetail(
    'evt_kindergarten_st_bruno_minimusiker_20260324_25e789',
    email
  );
  console.log('   Result:', byEventId ? 'FOUND - ' + byEventId.schoolName : 'NOT FOUND');

  // Test lookup by simplybookId (the fix)
  console.log('\n3. Testing getTeacherEventDetail by simplybookId (1727)...');
  const bySimplybookId = await teacherService.getTeacherEventDetail('1727', email);
  console.log('   Result:', bySimplybookId ? 'FOUND - ' + bySimplybookId.schoolName : 'NOT FOUND');

  // Verify both lookups return the same event
  if (byEventId && bySimplybookId) {
    console.log('\n4. Verification:');
    console.log('   Both lookups return same event:', byEventId.eventId === bySimplybookId.eventId ? 'YES' : 'NO');
  }

  console.log('\n' + '='.repeat(60));

  // Summary
  const allPassed = events.length > 0 && byEventId !== null && bySimplybookId !== null;
  if (allPassed) {
    console.log('✅ ALL TESTS PASSED');
    console.log('   - Teacher can access events');
    console.log('   - Event lookup by eventId works');
    console.log('   - Event lookup by simplybookId works (the fix)');
  } else {
    console.log('❌ TESTS FAILED');
    if (events.length === 0) console.log('   - No events found for teacher');
    if (!byEventId) console.log('   - Lookup by eventId failed');
    if (!bySimplybookId) console.log('   - Lookup by simplybookId failed');
  }
}

testTeacherAccess().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
