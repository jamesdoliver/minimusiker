/**
 * Debug script to check teacher access issues
 * Run with: npx tsx scripts/debug-teacher-access.ts <email>
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import Airtable from 'airtable';
import {
  SCHOOL_BOOKINGS_TABLE_ID,
  SCHOOL_BOOKINGS_FIELD_IDS,
  CLASSES_TABLE_ID,
  CLASSES_FIELD_IDS,
  EVENTS_TABLE_ID,
  EVENTS_FIELD_IDS,
} from '../src/lib/types/airtable';
import { TEACHERS_TABLE_ID, TEACHERS_FIELD_IDS } from '../src/lib/types/teacher';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

Airtable.configure({ apiKey: AIRTABLE_API_KEY });
const base = Airtable.base(AIRTABLE_BASE_ID);

async function debugTeacherAccess(email: string) {
  console.log(`\n🔍 Debugging access for: ${email}\n`);
  console.log('='.repeat(60));

  // 1. Check SchoolBookings (using field names, not IDs)
  console.log('\n📋 1. SCHOOL BOOKINGS (where email matches school_contact_email):');
  try {
    const bookings = await base(SCHOOL_BOOKINGS_TABLE_ID)
      .select({
        filterByFormula: `LOWER({school_contact_email}) = LOWER('${email.replace(/'/g, "\\'")}')`,
      })
      .all();

    if (bookings.length === 0) {
      console.log('   ❌ No bookings found for this email');
    } else {
      for (const b of bookings) {
        // Use field names (Airtable returns field names by default)
        const fields = b.fields as Record<string, unknown>;
        console.log(`\n   📅 Booking: ${b.id}`);
        console.log(`      SimplyBook ID: ${fields.simplybook_id}`);
        console.log(`      School: ${fields.school_name || fields.school_contact_name}`);
        console.log(`      Contact Email: ${fields.school_contact_email}`);
        console.log(`      Start Date: ${fields.start_date}`);
        console.log(`      Portal Status: ${fields.portal_status || 'NOT SET'}`);

        // Check linked event via SimplyBook booking field in Events table
        const simplybookId = fields.simplybook_id as string;
        if (simplybookId) {
          // Find the event linked to this booking
          const events = await base(EVENTS_TABLE_ID)
            .select({
              filterByFormula: `{legacy_booking_id} = '${simplybookId.replace(/'/g, "\\'")}'`,
            })
            .all();

          if (events.length > 0) {
            for (const e of events) {
              const eventFields = e.fields as Record<string, unknown>;
              console.log(`      Linked Event Record: ${e.id}`);
              console.log(`         Event ID: ${eventFields.event_id}`);
              console.log(`         Access Code: ${eventFields.access_code}`);
            }
          }
        }
      }
    }
  } catch (err) {
    console.log('   ❌ Error querying bookings:', err);
  }

  // 2. Check Teachers table
  console.log('\n\n👤 2. TEACHERS TABLE:');
  try {
    const teachers = await base(TEACHERS_TABLE_ID)
      .select({
        filterByFormula: `LOWER({email}) = LOWER('${email.replace(/'/g, "\\'")}')`,
      })
      .all();

    if (teachers.length === 0) {
      console.log('   ❌ No teacher record found for this email');
    } else {
      for (const t of teachers) {
        const fields = t.fields as Record<string, unknown>;
        console.log(`\n   👤 Teacher: ${t.id}`);
        console.log(`      Name: ${fields.name}`);
        console.log(`      Email: ${fields.email}`);
        console.log(`      School: ${fields.school_name}`);

        const linkedEvents = fields.linked_events as string[] | undefined;
        if (linkedEvents && Array.isArray(linkedEvents) && linkedEvents.length > 0) {
          console.log(`      Linked Events (via Teachers.linked_events): ${linkedEvents.join(', ')}`);

          // Fetch details about linked events
          for (const eventRecordId of linkedEvents) {
            try {
              const eventRecord = await base(EVENTS_TABLE_ID).find(eventRecordId);
              const eventFields = eventRecord.fields as Record<string, unknown>;
              console.log(`\n         📅 Event: ${eventRecord.id}`);
              console.log(`            Event ID: ${eventFields.event_id}`);
              console.log(`            School: ${eventFields.school_name}`);
              console.log(`            Date: ${eventFields.event_date}`);
              console.log(`            Access Code: ${eventFields.access_code}`);
            } catch (err) {
              console.log(`         ❌ Could not fetch event ${eventRecordId}`);
            }
          }
        } else {
          console.log('      Linked Events: NONE (teacher not directly linked to events)');
        }
      }
    }
  } catch (err) {
    console.log('   ❌ Error querying teachers:', err);
  }

  // 3. Check Classes for this teacher's events
  console.log('\n\n📚 3. CLASSES CREATED:');
  try {
    // Get linked events from the teacher record
    const teachers = await base(TEACHERS_TABLE_ID)
      .select({
        filterByFormula: `LOWER({email}) = LOWER('${email.replace(/'/g, "\\'")}')`,
      })
      .all();

    const linkedEventRecordIds: string[] = [];
    for (const t of teachers) {
      const fields = t.fields as Record<string, unknown>;
      const events = fields.linked_events as string[] | undefined;
      if (events) {
        linkedEventRecordIds.push(...events);
      }
    }

    // Also get event IDs from bookings
    const bookings = await base(SCHOOL_BOOKINGS_TABLE_ID)
      .select({
        filterByFormula: `LOWER({school_contact_email}) = LOWER('${email.replace(/'/g, "\\'")}')`,
      })
      .all();

    const simplybookIds = bookings.map(b => (b.fields as Record<string, unknown>).simplybook_id as string).filter(Boolean);

    // Check classes for events linked via Teachers.linked_events
    if (linkedEventRecordIds.length > 0) {
      console.log('\n   Classes via Teachers.linked_events:');
      for (const eventRecordId of linkedEventRecordIds) {
        try {
          const eventRecord = await base(EVENTS_TABLE_ID).find(eventRecordId);
          const eventFields = eventRecord.fields as Record<string, unknown>;
          const eventId = eventFields.event_id as string;
          const legacyBookingId = eventFields.legacy_booking_id as string;
          console.log(`\n   Event: ${eventId || legacyBookingId} (Record: ${eventRecordId})`);

          // Find classes for this event using linked record lookup
          const classes = await base(CLASSES_TABLE_ID)
            .select({
              filterByFormula: `FIND('${eventRecordId}', ARRAYJOIN({event_id}))`,
            })
            .all();

          if (classes.length === 0) {
            console.log('      No classes created yet');
          } else {
            for (const c of classes) {
              const classFields = c.fields as Record<string, unknown>;
              console.log(`      📖 Class: ${classFields.class_name} (ID: ${classFields.class_id})`);
              console.log(`         Type: ${classFields.class_type || 'regular'}`);
              console.log(`         Children: ${classFields.total_children || 'not set'}`);
            }
          }
        } catch (err) {
          console.log(`      ❌ Error fetching event ${eventRecordId}:`, err);
        }
      }
    }

    // Check classes for events from SchoolBookings
    if (simplybookIds.length > 0) {
      console.log('\n   Classes via SchoolBookings (by legacy_booking_id):');
      for (const simplybookId of simplybookIds) {
        console.log(`\n   SimplyBook ID: ${simplybookId}`);

        const classes = await base(CLASSES_TABLE_ID)
          .select({
            filterByFormula: `{legacy_booking_id} = '${simplybookId.replace(/'/g, "\\'")}'`,
          })
          .all();

        if (classes.length === 0) {
          console.log('      No classes found');
        } else {
          for (const c of classes) {
            const classFields = c.fields as Record<string, unknown>;
            console.log(`      📖 Class: ${classFields.class_name} (ID: ${classFields.class_id})`);
            console.log(`         Type: ${classFields.class_type || 'regular'}`);
            console.log(`         Children: ${classFields.total_children || 'not set'}`);
          }
        }
      }
    }

    if (linkedEventRecordIds.length === 0 && simplybookIds.length === 0) {
      console.log('   No events found for this teacher');
    }
  } catch (err) {
    console.log('   ❌ Error querying classes:', err);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Debug complete!\n');
}

// Get email from command line
const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx scripts/debug-teacher-access.ts <email>');
  process.exit(1);
}

debugTeacherAccess(email);
