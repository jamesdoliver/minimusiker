/**
 * SimplyBook → Airtable Full Sync Script
 *
 * Syncs all 2026 bookings from SimplyBook to Airtable, creating both
 * SchoolBookings AND Events records where they don't exist.
 *
 * Usage:
 *   node scripts/sync-simplybook-full.js --dry-run    # Preview only
 *   node scripts/sync-simplybook-full.js              # Execute sync
 */

require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');
const crypto = require('crypto');

// ============================================
// Configuration
// ============================================

const DATE_FROM = '2026-01-01';  // Sync from start of 2026

// Table IDs
const SCHOOL_BOOKINGS_TABLE_ID = 'tblrktl5eLJEWE4M6';
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const PERSONEN_TABLE_ID = 'tblSjIkHOK7FQZUO2';
const EINRICHTUNGEN_TABLE_ID = 'tblqBJXPTjKpAWJVm';

// Field IDs for SchoolBookings
const SCHOOL_BOOKINGS_FIELD_IDS = {
  simplybook_id: 'fldwdmQgR5hYnHSGb',
  simplybook_hash: 'fldkz0WPSKd2uWJb4',
  school_name: 'fldFxHq2l3AJJPXGE',
  school_contact_name: 'fldOqjrBFIBvdJh64',
  school_contact_email: 'fldNDT18TyLf8s8Rq',
  school_phone: 'fldu3JbZGaFGCBhRO',
  school_address: 'fldjJTRLJrGR1P1FX',
  school_postal_code: 'fldA5x7IXDRlYHbO5',
  city: 'fldV3yD2JqDZCIRhO',
  estimated_children: 'fldNsKVt7LTJ0LLxI',
  school_size_category: 'fldFy8hfO5XZvQD05',
  simplybook_status: 'fldh4CKC1HLkuLPBx',
  start_date: 'fldTsT8dblh0FuLvM',
  end_date: 'fldSIWzCtA9qMNtlz',
  start_time: 'fld3aCGOKBZFVAcFt',
  end_time: 'fldc3djKUKUEhFOAQ',
  main_contact_person: 'fldXIUdMJYZMvLl7g',
  einrichtung: 'fldGNqJhvlcwpISLs',
};

// Field names for Events
const EVENTS_FIELDS = {
  event_id: 'event_id',
  school_name: 'school_name',
  event_date: 'event_date',
  assigned_staff: 'assigned_staff',
  simplybook_booking: 'simplybook_booking',
};

// Environment variables
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const SIMPLYBOOK_API_KEY = process.env.SIMPLYBOOK_API_KEY;
const SIMPLYBOOK_COMPANY = process.env.SIMPLY_BOOK_ACCOUNT_NAME;
const SIMPLYBOOK_USER_LOGIN = process.env.SIMPLYBOOK_USER_LOGIN;
const SIMPLYBOOK_USER_PASSWORD = process.env.SIMPLYBOOK_USER_PASSWORD;
const SIMPLYBOOK_JSON_RPC_ENDPOINT = process.env.SIMPLYBOOK_JSON_RCP_API_ENDPOINT || 'https://user-api.simplybook.it/';

// Parse arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

// Validate environment
if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('❌ Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID');
  process.exit(1);
}
if (!SIMPLYBOOK_COMPANY || !SIMPLYBOOK_USER_LOGIN || !SIMPLYBOOK_USER_PASSWORD) {
  console.error('❌ Missing SimplyBook credentials (SIMPLY_BOOK_ACCOUNT_NAME, SIMPLYBOOK_USER_LOGIN, SIMPLYBOOK_USER_PASSWORD)');
  process.exit(1);
}

// Initialize Airtable
const airtable = new Airtable({ apiKey: AIRTABLE_API_KEY });
const base = airtable.base(AIRTABLE_BASE_ID);

// ============================================
// SimplyBook API Functions
// ============================================

let adminToken = null;

async function getAdminToken() {
  if (adminToken) return adminToken;

  const request = {
    jsonrpc: '2.0',
    method: 'getUserToken',
    params: [SIMPLYBOOK_COMPANY, SIMPLYBOOK_USER_LOGIN, SIMPLYBOOK_USER_PASSWORD],
    id: 1,
  };

  const response = await fetch(`${SIMPLYBOOK_JSON_RPC_ENDPOINT}login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`SimplyBook auth error: ${data.error.message}`);
  }

  adminToken = data.result;
  return adminToken;
}

async function getBookings(dateFrom) {
  const token = await getAdminToken();

  const request = {
    jsonrpc: '2.0',
    method: 'getBookings',
    params: [{ date_from: dateFrom, order: 'date_start' }],
    id: Date.now(),
  };

  const response = await fetch(`${SIMPLYBOOK_JSON_RPC_ENDPOINT}admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Company-Login': SIMPLYBOOK_COMPANY,
      'X-User-Token': token,
    },
    body: JSON.stringify(request),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`SimplyBook getBookings error: ${data.error.message}`);
  }

  return data.result || [];
}

// ============================================
// Mapping Functions
// ============================================

function mapIntakeFields(booking) {
  const rawFields = booking.additional_fields || [];
  const fieldsArray = Array.isArray(rawFields) ? rawFields : Object.values(rawFields);

  const findField = (keywords) => {
    for (const field of fieldsArray) {
      if (!field) continue;
      const title = field.field_title || field.title || '';
      if (!title) continue;
      const titleLower = title.toLowerCase();
      if (keywords.some(kw => titleLower.includes(kw.toLowerCase()))) {
        return field.value || '';
      }
    }
    return '';
  };

  const childrenStr = findField(['kinder', 'children', 'anzahl']);
  const numberOfChildren = parseInt(childrenStr, 10) || 0;
  const costCategory = numberOfChildren > 150 ? '>150 children' : '<150 children';

  const schoolNameFromFields = findField(['name', 'schule', 'school', 'einrichtung']);
  const schoolName = booking.client || schoolNameFromFields || booking.client_name || '';

  return {
    schoolName,
    contactPerson: findField(['ansprechpartner', 'ansprechperson', 'contact person', 'contact', 'kontakt']) || booking.client_name || '',
    contactEmail: booking.client_email || findField(['email', 'e-mail']) || '',
    phone: booking.client_phone || findField(['telefon', 'phone', 'tel']) || undefined,
    address: findField(['adresse', 'address', 'strasse', 'street']) || undefined,
    postalCode: findField(['plz', 'postal', 'postleitzahl', 'postcode']) || undefined,
    region: findField(['region', 'standort', 'location', 'gebiet', 'ort']) || undefined,
    city: findField(['stadt', 'city']) || undefined,
    numberOfChildren,
    costCategory,
  };
}

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
    const dateOnly = bookingDate.split('T')[0].split(' ')[0];
    dateStr = dateOnly.replace(/-/g, '');
  }

  // Hash must use normalized event type for consistency
  const hashInput = `${schoolName}|${normalizedEventType}|${bookingDate || ''}`;
  const hash = crypto.createHash('md5').update(hashInput).digest('hex').substring(0, 6);

  return dateStr ? `evt_${schoolSlug}_${eventSlug}_${dateStr}_${hash}` : `evt_${schoolSlug}_${eventSlug}_${hash}`;
}

function parseDateTime(dateTimeStr) {
  if (!dateTimeStr) return { date: '', time: '' };
  const parts = dateTimeStr.split(' ');
  return { date: parts[0] || '', time: parts[1] || '' };
}

// ============================================
// Airtable Lookup Functions
// ============================================

async function findSchoolBookingBySimplybookId(simplybookId) {
  const records = await base(SCHOOL_BOOKINGS_TABLE_ID)
    .select({
      filterByFormula: `{simplybook_id} = "${simplybookId}"`,
      maxRecords: 1,
    })
    .firstPage();
  return records[0] || null;
}

// Cache for Events with booking links (populated once at start)
let eventsWithBookingLinks = null;

async function loadEventsWithBookingLinks() {
  if (eventsWithBookingLinks) return eventsWithBookingLinks;

  eventsWithBookingLinks = new Map();

  await base(EVENTS_TABLE_ID)
    .select({ fields: ['event_id', 'simplybook_booking', 'school_name'] })
    .eachPage((records, fetchNextPage) => {
      for (const record of records) {
        const bookingLinks = record.get('simplybook_booking') || [];
        for (const bookingId of bookingLinks) {
          eventsWithBookingLinks.set(bookingId, {
            id: record.id,
            event_id: record.get('event_id'),
            school_name: record.get('school_name'),
          });
        }
      }
      fetchNextPage();
    });

  console.log(`Loaded ${eventsWithBookingLinks.size} Event-to-Booking links\n`);
  return eventsWithBookingLinks;
}

function findEventByBookingLink(schoolBookingRecordId) {
  return eventsWithBookingLinks?.get(schoolBookingRecordId) || null;
}

async function findStaffByRegion(region) {
  if (!region) return null;
  try {
    const records = await base(PERSONEN_TABLE_ID)
      .select({
        filterByFormula: `FIND("${region}", {Teams/Regionen})`,
        maxRecords: 1,
      })
      .firstPage();
    return records[0]?.id || null;
  } catch {
    return null;
  }
}

async function findEinrichtungByName(schoolName, postalCode) {
  if (!schoolName) return null;
  try {
    const escapedName = schoolName.replace(/"/g, '\\"');
    const records = await base(EINRICHTUNGEN_TABLE_ID)
      .select({
        filterByFormula: `LOWER({customer_name}) = LOWER("${escapedName}")`,
        maxRecords: 1,
      })
      .firstPage();
    return records[0]?.id || null;
  } catch {
    return null;
  }
}

// ============================================
// Create Functions
// ============================================

async function createSchoolBooking(booking, mappedData, staffId, einrichtungId) {
  const startParsed = parseDateTime(booking.start_date);
  const endParsed = parseDateTime(booking.end_date);
  const isConfirmed = booking.is_confirmed === true;

  // Use field names, not field IDs (Airtable SDK requirement)
  const fields = {
    'simplybook_id': booking.id,
    'simplybook_hash': booking.hash || booking.code || '',
    'school_name': mappedData.schoolName || booking.client_name || '',
    'school_contact_name': mappedData.contactPerson || booking.client_name || '',
    'school_contact_email': mappedData.contactEmail || booking.client_email || '',
    'school_phone': mappedData.phone || booking.client_phone || '',
    'school_address': mappedData.address || '',
    'school_postal_code': mappedData.postalCode || '',
    'city': mappedData.city || '',
    'estimated_children': mappedData.numberOfChildren,
    'school_size_category': mappedData.costCategory,
    'simplybook_status': isConfirmed ? 'confirmed' : 'pending',
    'start_date': startParsed.date,
    'end_date': endParsed.date,
    'start_time': startParsed.time,
    'end_time': endParsed.time,
  };

  if (staffId) fields['assigned_staff'] = [staffId];
  if (einrichtungId) fields['einrichtung'] = [einrichtungId];

  const records = await base(SCHOOL_BOOKINGS_TABLE_ID).create([{ fields }]);
  return records[0];
}

async function createEvent(eventId, schoolBookingId, schoolName, eventDate, staffId) {
  const fields = {
    [EVENTS_FIELDS.event_id]: eventId,
    [EVENTS_FIELDS.school_name]: schoolName,
    [EVENTS_FIELDS.event_date]: eventDate,
    [EVENTS_FIELDS.simplybook_booking]: [schoolBookingId],
  };

  if (staffId) fields[EVENTS_FIELDS.assigned_staff] = [staffId];

  const records = await base(EVENTS_TABLE_ID).create([{ fields }]);
  return records[0];
}

// ============================================
// Main Sync Function
// ============================================

async function syncSimplyBookFull() {
  console.log('\n========================================');
  console.log('  SimplyBook → Airtable Full Sync');
  console.log('========================================');
  console.log(`Date from: ${DATE_FROM}`);
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '⚡ EXECUTE'}`);
  console.log('========================================\n');

  // Load existing Events with booking links (for duplicate detection)
  console.log('Loading existing Events...');
  await loadEventsWithBookingLinks();

  // Fetch all bookings from SimplyBook
  console.log('Fetching bookings from SimplyBook...');
  const bookings = await getBookings(DATE_FROM);
  console.log(`Found ${bookings.length} bookings in SimplyBook\n`);

  if (bookings.length === 0) {
    console.log('No bookings to sync.');
    return;
  }

  // Stats
  const stats = {
    total: bookings.length,
    schoolBookingsCreated: 0,
    schoolBookingsSkipped: 0,
    eventsCreated: 0,
    eventsSkipped: 0,
    errors: 0,
  };

  // Process each booking
  for (let i = 0; i < bookings.length; i++) {
    const booking = bookings[i];
    const mappedData = mapIntakeFields(booking);
    const schoolName = mappedData.schoolName || booking.client_name || `Booking ${booking.id}`;
    const startDate = parseDateTime(booking.start_date).date;

    console.log(`[${i + 1}/${bookings.length}] ${schoolName} (${startDate})`);

    try {
      // Step 1: Check if SchoolBooking exists
      let schoolBookingRecord = await findSchoolBookingBySimplybookId(booking.id);

      if (schoolBookingRecord) {
        console.log(`  └─ SchoolBooking: EXISTS (${schoolBookingRecord.id})`);
        stats.schoolBookingsSkipped++;
      } else {
        // Create SchoolBooking
        if (DRY_RUN) {
          console.log(`  └─ SchoolBooking: WOULD CREATE`);
        } else {
          const staffId = await findStaffByRegion(mappedData.region);
          const einrichtungId = await findEinrichtungByName(mappedData.schoolName, mappedData.postalCode);
          schoolBookingRecord = await createSchoolBooking(booking, mappedData, staffId, einrichtungId);
          console.log(`  └─ SchoolBooking: CREATED (${schoolBookingRecord.id})`);
        }
        stats.schoolBookingsCreated++;
      }

      // Step 2: Check if Event exists (only if we have a SchoolBooking record)
      if (schoolBookingRecord) {
        const existingEvent = await findEventByBookingLink(schoolBookingRecord.id);

        if (existingEvent) {
          console.log(`  └─ Event: EXISTS (${existingEvent.id})`);
          stats.eventsSkipped++;
        } else {
          // Create Event
          const eventId = generateEventId(schoolName, 'MiniMusiker', startDate);

          if (DRY_RUN) {
            console.log(`  └─ Event: WOULD CREATE (${eventId})`);
          } else {
            const staffId = schoolBookingRecord.get(SCHOOL_BOOKINGS_FIELD_IDS.main_contact_person)?.[0] || null;
            const eventRecord = await createEvent(eventId, schoolBookingRecord.id, schoolName, startDate, staffId);
            console.log(`  └─ Event: CREATED (${eventRecord.id}, ${eventId})`);
          }
          stats.eventsCreated++;
        }
      } else if (DRY_RUN) {
        // In dry-run, we'd create the Event too
        const eventId = generateEventId(schoolName, 'MiniMusiker', startDate);
        console.log(`  └─ Event: WOULD CREATE (${eventId})`);
        stats.eventsCreated++;
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.log(`  └─ ERROR: ${error.message}`);
      stats.errors++;
    }
  }

  // Summary
  console.log('\n========================================');
  console.log('  Sync Complete');
  console.log('========================================');
  console.log(`Total SimplyBook bookings: ${stats.total}`);
  console.log(`SchoolBookings created:    ${stats.schoolBookingsCreated}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`SchoolBookings skipped:    ${stats.schoolBookingsSkipped} (already exist)`);
  console.log(`Events created:            ${stats.eventsCreated}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`Events skipped:            ${stats.eventsSkipped} (already exist)`);
  console.log(`Errors:                    ${stats.errors}`);

  if (DRY_RUN) {
    console.log('\n⚠️  This was a DRY RUN - no changes were made.');
    console.log('Run without --dry-run to execute the sync.\n');
  } else {
    console.log('\n✅ Sync complete. Short URLs: minimusiker.app/e/{access_code}\n');
  }
}

// Run
syncSimplyBookFull()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Sync failed:', error);
    process.exit(1);
  });
