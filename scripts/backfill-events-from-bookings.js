/**
 * Backfill Events from SchoolBookings
 *
 * This script creates Events records for all existing SchoolBookings that
 * don't have corresponding Events. The access_code field will auto-populate
 * (it's an Airtable Autonumber field).
 *
 * Usage: node scripts/backfill-events-from-bookings.js
 */

// Load environment variables first
require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');
const cryptoLib = require('crypto');

// Table IDs
const SCHOOL_BOOKINGS_TABLE_ID = 'tblrktl5eLJEWE4M6';
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';

// Field names (Airtable SDK uses names, not IDs)
const SCHOOL_BOOKINGS_FIELDS = {
  school_name: 'school_name',
  school_contact_name: 'school_contact_name',
  start_date: 'start_date',
  assigned_staff: 'assigned_staff',
};

const EVENTS_FIELDS = {
  event_id: 'event_id',
  school_name: 'school_name',
  event_date: 'event_date',
  event_type: 'event_type',
  assigned_staff: 'assigned_staff',
  simplybook_booking: 'simplybook_booking',
};

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID environment variables');
  process.exit(1);
}

const airtable = new Airtable({ apiKey: AIRTABLE_API_KEY });
const base = airtable.base(AIRTABLE_BASE_ID);

/**
 * Normalize event type for consistent event ID generation.
 * All MiniMusiker variations map to canonical "minimusiker".
 */
function normalizeEventTypeForId(eventType) {
  if (!eventType) return 'minimusiker';

  const normalized = eventType.toLowerCase().trim();

  // All MiniMusiker variants normalize to same canonical value
  if (
    normalized.includes('minimusik') ||
    normalized.includes('mini musik') ||
    normalized === 'concert'
  ) {
    return 'minimusiker';
  }

  // Default for safety - all current events are MiniMusiker variants
  return 'minimusiker';
}

/**
 * Generate a unique event ID from school name, event type, and booking date
 */
function generateEventId(schoolName, eventType, bookingDate) {
  // CRITICAL: Normalize event type for consistent ID generation
  const normalizedEventType = normalizeEventTypeForId(eventType);

  const schoolSlug = schoolName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 30);

  const eventSlug = normalizedEventType
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 20);

  let dateStr = '';
  if (bookingDate) {
    const dateOnly = bookingDate.split('T')[0];
    dateStr = dateOnly.replace(/-/g, '');
  }

  // Hash must use normalized event type for consistency
  const hashInput = `${schoolName}|${normalizedEventType}|${bookingDate || ''}`;
  const hash = cryptoLib.createHash('md5').update(hashInput).digest('hex').substring(0, 6);

  if (dateStr) {
    return `evt_${schoolSlug}_${eventSlug}_${dateStr}_${hash}`;
  }
  return `evt_${schoolSlug}_${eventSlug}_${hash}`;
}

/**
 * Get all SchoolBookings from Airtable
 */
async function getSchoolBookings() {
  console.log('Fetching SchoolBookings...');

  const bookings = [];

  await base(SCHOOL_BOOKINGS_TABLE_ID)
    .select({
      fields: [
        SCHOOL_BOOKINGS_FIELDS.school_name,
        SCHOOL_BOOKINGS_FIELDS.school_contact_name,
        SCHOOL_BOOKINGS_FIELDS.start_date,
        SCHOOL_BOOKINGS_FIELDS.assigned_staff,
      ],
    })
    .eachPage((records, fetchNextPage) => {
      for (const record of records) {
        bookings.push({
          id: record.id,
          schoolName: record.get(SCHOOL_BOOKINGS_FIELDS.school_name),
          schoolContactName: record.get(SCHOOL_BOOKINGS_FIELDS.school_contact_name),
          startDate: record.get(SCHOOL_BOOKINGS_FIELDS.start_date),
          assignedStaff: record.get(SCHOOL_BOOKINGS_FIELDS.assigned_staff),
        });
      }
      fetchNextPage();
    });

  console.log(`Found ${bookings.length} SchoolBookings`);
  return bookings;
}

/**
 * Get all existing Events that have simplybook_booking links
 */
async function getExistingEventsWithBookingLinks() {
  console.log('Fetching existing Events...');

  const eventsMap = new Map();

  await base(EVENTS_TABLE_ID)
    .select({
      fields: [
        EVENTS_FIELDS.event_id,
        EVENTS_FIELDS.simplybook_booking,
      ],
    })
    .eachPage((records, fetchNextPage) => {
      for (const record of records) {
        const simplybookBooking = record.get(EVENTS_FIELDS.simplybook_booking);
        if (simplybookBooking && simplybookBooking.length > 0) {
          for (const bookingId of simplybookBooking) {
            eventsMap.set(bookingId, {
              id: record.id,
              event_id: record.get(EVENTS_FIELDS.event_id),
              simplybookBooking,
            });
          }
        }
      }
      fetchNextPage();
    });

  console.log(`Found ${eventsMap.size} Events with booking links`);
  return eventsMap;
}

/**
 * Check if an Event with the given event_id already exists
 */
async function findEventByEventId(eventId) {
  const records = await base(EVENTS_TABLE_ID)
    .select({
      filterByFormula: `{${EVENTS_FIELDS.event_id}} = "${eventId}"`,
      maxRecords: 1,
    })
    .firstPage();

  if (records.length === 0) {
    return null;
  }

  return {
    id: records[0].id,
    event_id: records[0].get(EVENTS_FIELDS.event_id),
    simplybookBooking: records[0].get(EVENTS_FIELDS.simplybook_booking),
  };
}

/**
 * Create a new Event from a SchoolBooking
 */
async function createEventFromBooking(eventId, bookingId, schoolName, eventDate, assignedStaff) {
  const fields = {
    [EVENTS_FIELDS.event_id]: eventId,
    [EVENTS_FIELDS.school_name]: schoolName,
    [EVENTS_FIELDS.event_date]: eventDate,
    // Skip event_type since it's a single select with limited options
    [EVENTS_FIELDS.simplybook_booking]: [bookingId],
  };

  if (assignedStaff && assignedStaff.length > 0) {
    fields[EVENTS_FIELDS.assigned_staff] = assignedStaff;
  }

  const records = await base(EVENTS_TABLE_ID).create([{ fields }]);
  return records[0].id;
}

/**
 * Update an existing Event to link to a SchoolBooking
 */
async function updateEventWithBookingLink(eventRecordId, bookingId) {
  await base(EVENTS_TABLE_ID).update(eventRecordId, {
    [EVENTS_FIELDS.simplybook_booking]: [bookingId],
  });
}

/**
 * Main backfill function
 */
async function backfillEventsFromBookings() {
  console.log('\n========================================');
  console.log('  SchoolBookings -> Events Backfill');
  console.log('========================================\n');

  const bookings = await getSchoolBookings();
  const existingEventsMap = await getExistingEventsWithBookingLinks();

  let created = 0;
  let skipped = 0;
  let linked = 0;
  let errors = 0;

  for (const booking of bookings) {
    try {
      const schoolName = booking.schoolName || booking.schoolContactName;

      if (!schoolName) {
        console.log(`[SKIP] Booking ${booking.id}: No school name or contact name`);
        skipped++;
        continue;
      }

      if (!booking.startDate) {
        console.log(`[SKIP] Booking ${booking.id} (${schoolName}): No start date`);
        skipped++;
        continue;
      }

      if (existingEventsMap.has(booking.id)) {
        console.log(`[EXISTS] Event already exists for booking ${booking.id} (${schoolName})`);
        skipped++;
        continue;
      }

      const eventId = generateEventId(schoolName, 'MiniMusiker', booking.startDate);

      const existingEvent = await findEventByEventId(eventId);

      if (existingEvent) {
        console.log(`[LINK] Linking existing Event ${eventId} to booking ${booking.id}`);
        await updateEventWithBookingLink(existingEvent.id, booking.id);
        linked++;
        continue;
      }

      console.log(`[CREATE] Creating Event for ${schoolName} (${booking.startDate})`);
      await createEventFromBooking(
        eventId,
        booking.id,
        schoolName,
        booking.startDate,
        booking.assignedStaff
      );
      created++;

    } catch (error) {
      console.error(`[ERROR] Processing booking ${booking.id}:`, error);
      errors++;
    }
  }

  console.log('\n========================================');
  console.log('  Backfill Complete');
  console.log('========================================');
  console.log(`Created: ${created} Events`);
  console.log(`Linked:  ${linked} Events to bookings`);
  console.log(`Skipped: ${skipped} (already exist or missing data)`);
  console.log(`Errors:  ${errors}`);
  console.log('\nEach created Event now has an auto-generated access_code');
  console.log('Short URLs will work: minimusiker.app/e/{access_code}\n');
}

// Run the backfill
backfillEventsFromBookings()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  });
