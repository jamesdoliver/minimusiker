/**
 * Backfill: Create Teacher records from 2026 SimplyBook bookings
 *
 * This script fetches 2026 SchoolBookings, retrieves booking details from
 * SimplyBook API, and creates Teacher records for portal access.
 *
 * Usage:
 *   node scripts/backfill-teachers-from-simplybook.js --dry-run    # Preview changes
 *   node scripts/backfill-teachers-from-simplybook.js              # Execute backfill
 *   node scripts/backfill-teachers-from-simplybook.js --verbose    # Show detailed logs
 *
 * Environment variables required:
 *   AIRTABLE_API_KEY
 *   AIRTABLE_BASE_ID
 *   SIMPLYBOOK_COMPANY_LOGIN
 *   SIMPLYBOOK_USER_LOGIN
 *   SIMPLYBOOK_USER_PASSWORD
 */

require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');

// Table IDs
const SCHOOL_BOOKINGS_TABLE_ID = 'tblrktl5eLJEWE4M6';
const TEACHERS_TABLE_ID = 'tblLO2vXcgvNjrJ0T';
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';
const TEAMS_REGIONEN_TABLE_ID = 'tblQm2nyPKU7k2N2N';

// Field IDs (for Airtable API create/update - uses field IDs)
const FIELD_IDS = {
  // SchoolBookings (for filterByFormula)
  sb_simplybook_id: 'fldb5FI6ij00eICaT',
  sb_start_date: 'fldbCBy0CxsivACiZ',

  // Teachers (for creating records)
  t_email: 'fldkVlTMgLrLUrwlo',
  t_name: 'fld3GL8fRPSPhMw4J',
  t_phone: 'fld68dyMBRoE2rMX4',
  t_school_name: 'fldPWSqdRUVxzCOly',
  t_school_address: 'fldY8gUK35GlE7IAz',
  t_region: 'fldVHy77JMhWpfxKy',
  t_created_at: 'fldmnLMTKXgQFLh1W',
  t_simplybook_booking_id: 'fldoaHHkcyTgwaLO0',
  t_linked_events: 'fldJeROezAUX6zfA7',
};

// Field Names (for reading record values - Airtable returns field names, not IDs)
const FIELD_NAMES = {
  // SchoolBookings
  sb_simplybook_id: 'simplybook_id',
  sb_start_date: 'start_date',
  sb_school_name: 'school_name',

  // Events
  e_simplybook_booking: 'simplybook_booking',
};

// Initialize Airtable
const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

// SimplyBook API configuration
const SIMPLYBOOK_CONFIG = {
  companyLogin: process.env.SIMPLYBOOK_COMPANY_LOGIN || 'minimusiker',
  userLogin: process.env.SIMPLYBOOK_USER_LOGIN,
  userPassword: process.env.SIMPLYBOOK_USER_PASSWORD,
  jsonRpcEndpoint: process.env.SIMPLYBOOK_JSON_RCP_API_ENDPOINT || 'https://user-api.simplybook.it/',
};

let authToken = null;

// ============================================================================
// SimplyBook API Functions
// ============================================================================

/**
 * Get SimplyBook authentication token
 */
async function getSimplyBookToken() {
  if (authToken) return authToken;

  console.log('Authenticating with SimplyBook...');

  const response = await fetch(`${SIMPLYBOOK_CONFIG.jsonRpcEndpoint}login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'getUserToken',
      params: [
        SIMPLYBOOK_CONFIG.companyLogin,
        SIMPLYBOOK_CONFIG.userLogin,
        SIMPLYBOOK_CONFIG.userPassword,
      ],
      id: 1,
    }),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error('SimplyBook returned non-JSON response:', text.substring(0, 200));
    throw new Error('SimplyBook auth returned invalid response');
  }

  if (data.error) {
    throw new Error(`SimplyBook auth failed: ${data.error.message}`);
  }

  authToken = data.result;
  console.log('  Authentication successful!\n');
  return authToken;
}

/**
 * Fetch booking details from SimplyBook API
 */
async function fetchBookingFromSimplyBook(bookingId) {
  const token = await getSimplyBookToken();

  const response = await fetch(`${SIMPLYBOOK_CONFIG.jsonRpcEndpoint}admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Company-Login': SIMPLYBOOK_CONFIG.companyLogin,
      'X-User-Token': token,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'getBookingDetails',
      params: [bookingId],
      id: Date.now(),
    }),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`SimplyBook returned non-JSON: ${text.substring(0, 100)}`);
  }

  if (data.error) {
    throw new Error(`SimplyBook API error: ${data.error.message}`);
  }

  return data.result;
}

// ============================================================================
// Data Mapping Functions
// ============================================================================

/**
 * Map SimplyBook intake fields to our schema
 */
function mapIntakeFields(booking) {
  const rawFields = booking.additional_fields || [];

  // Normalize fields to array format
  const fieldsArray = Array.isArray(rawFields)
    ? rawFields
    : Object.values(rawFields);

  // Helper to find field by partial title match
  const findField = (keywords) => {
    for (const field of fieldsArray) {
      if (!field) continue;
      const title = field.field_title || field.title || '';
      if (!title) continue;
      const titleLower = title.toLowerCase();
      if (keywords.some((kw) => titleLower.includes(kw.toLowerCase()))) {
        return field.value || '';
      }
    }
    return '';
  };

  // Extract region from unit_name (e.g., "Minimusiker Köln/Bonn" -> "Köln/Bonn")
  let region;
  if (booking.unit_name) {
    region = booking.unit_name.replace(/^Minimusiker\s+/i, '').trim() || undefined;
  }

  // School name: prefer 'client' field, then additional_fields, then client_name
  const schoolNameFromFields = findField(['name', 'schule', 'school', 'einrichtung']);
  const schoolName = booking.client || schoolNameFromFields || booking.client_name || '';

  // Contact person: from intake form or client_name
  const contactPerson = findField(['ansprechpartner', 'ansprechperson', 'contact person', 'contact', 'kontakt']) || booking.client_name || '';

  // Address from intake form or client record
  const address = findField(['adresse', 'address', 'strasse', 'street']) || booking.client_address1 || undefined;

  // Phone from client record or intake form
  const phone = booking.client_phone || findField(['telefon', 'phone', 'tel']) || undefined;

  return {
    schoolName,
    contactPerson,
    contactEmail: booking.client_email || '',
    phone,
    address,
    region,
    recordDate: booking.record_date,
  };
}

/**
 * Normalize region name for matching
 */
function normalizeRegionName(name) {
  if (!name) return '';
  return name
    .replace(/[-\s]+/g, '/')
    .toLowerCase()
    .trim();
}

/**
 * Build a list of Teams/Regionen with normalized names
 */
async function buildRegionList() {
  console.log('Building Teams/Regionen list...');
  const regions = [];

  const records = await airtable
    .table(TEAMS_REGIONEN_TABLE_ID)
    .select({ fields: ['Name'] })
    .all();

  for (const record of records) {
    const name = record.get('Name');
    if (name) {
      const normalized = normalizeRegionName(name);
      regions.push({ id: record.id, name, normalized });
    }
  }

  console.log(`Found ${regions.length} regions\n`);
  return regions;
}

/**
 * Find best matching region using substring matching
 */
function findBestRegionMatch(regionList, inputRegion) {
  if (!inputRegion) return null;

  const normalizedInput = normalizeRegionName(inputRegion);
  if (!normalizedInput) return null;

  let bestMatch = null;

  for (const region of regionList) {
    // Exact match - return immediately
    if (region.normalized === normalizedInput) {
      return { id: region.id, name: region.name, matchType: 'exact' };
    }

    // Check if Airtable name is contained in SimplyBook input
    if (normalizedInput.includes(region.normalized)) {
      if (!bestMatch || region.normalized.length > bestMatch.normalized.length) {
        bestMatch = { ...region, matchType: 'substring' };
      }
    }
  }

  return bestMatch ? { id: bestMatch.id, name: bestMatch.name, matchType: bestMatch.matchType } : null;
}

// ============================================================================
// Airtable Query Functions
// ============================================================================

/**
 * Fetch all 2026 SchoolBookings with SimplyBook IDs
 */
async function get2026Bookings() {
  console.log('Fetching 2026 SchoolBookings with SimplyBook IDs...');

  const records = await airtable
    .table(SCHOOL_BOOKINGS_TABLE_ID)
    .select({
      filterByFormula: `AND(
        NOT({${FIELD_IDS.sb_simplybook_id}} = ""),
        IS_AFTER({${FIELD_IDS.sb_start_date}}, '2025-12-31'),
        IS_BEFORE({${FIELD_IDS.sb_start_date}}, '2027-01-01')
      )`,
      // Use field names for the fields parameter
      fields: [
        FIELD_NAMES.sb_simplybook_id,
        FIELD_NAMES.sb_start_date,
        FIELD_NAMES.sb_school_name,
      ],
    })
    .all();

  console.log(`Found ${records.length} bookings in 2026\n`);
  return records;
}

/**
 * Check if a teacher already exists by email
 */
async function teacherExistsByEmail(email) {
  if (!email) return null;

  const escapedEmail = email.replace(/"/g, '\\"');

  const records = await airtable
    .table(TEACHERS_TABLE_ID)
    .select({
      filterByFormula: `LOWER({${FIELD_IDS.t_email}}) = LOWER("${escapedEmail}")`,
      maxRecords: 1,
    })
    .firstPage();

  return records.length > 0 ? records[0] : null;
}

/**
 * Find Event record linked to a SchoolBooking
 */
async function findEventForBooking(bookingRecordId) {
  // Fetch all Events and find the one linked to this booking
  const records = await airtable
    .table(EVENTS_TABLE_ID)
    .select({
      fields: [FIELD_IDS.e_simplybook_booking],
    })
    .all();

  const matchingRecord = records.find((record) => {
    const bookings = record.get(FIELD_IDS.e_simplybook_booking) || [];
    return bookings.includes(bookingRecordId);
  });

  return matchingRecord || null;
}

/**
 * Create a new Teacher record
 */
async function createTeacher(data) {
  const fields = {
    [FIELD_IDS.t_email]: data.email,
    [FIELD_IDS.t_name]: data.name,
    [FIELD_IDS.t_school_name]: data.schoolName,
    [FIELD_IDS.t_simplybook_booking_id]: data.simplybookId,
    [FIELD_IDS.t_created_at]: data.createdAt,
  };

  if (data.phone) fields[FIELD_IDS.t_phone] = data.phone;
  if (data.schoolAddress) fields[FIELD_IDS.t_school_address] = data.schoolAddress;
  if (data.regionRecordId) fields[FIELD_IDS.t_region] = [data.regionRecordId];
  if (data.eventRecordId) fields[FIELD_IDS.t_linked_events] = [data.eventRecordId];

  return await airtable.table(TEACHERS_TABLE_ID).create(fields);
}

// ============================================================================
// Utility Functions
// ============================================================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Main Migration
// ============================================================================

async function runBackfill(dryRun = false, verbose = false) {
  console.log('\n=== Teacher Backfill (2026 Bookings) ===\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`Verbose: ${verbose}\n`);

  // Build region lookup
  const regionList = await buildRegionList();

  // Get 2026 bookings
  const bookings = await get2026Bookings();

  if (bookings.length === 0) {
    console.log('No bookings found to process.');
    return;
  }

  // Cache Events lookup (fetch once)
  console.log('Caching Events for lookup...');
  const allEvents = await airtable
    .table(EVENTS_TABLE_ID)
    .select({ fields: [FIELD_NAMES.e_simplybook_booking] })
    .all();
  console.log(`Found ${allEvents.length} events\n`);

  // Helper to find event from cache
  const findEventFromCache = (bookingRecordId) => {
    return allEvents.find((record) => {
      // Use field NAME for reading
      const bookings = record.get(FIELD_NAMES.e_simplybook_booking) || [];
      return bookings.includes(bookingRecordId);
    });
  };

  const results = {
    created: 0,
    skipped_exists: 0,
    skipped_no_email: 0,
    errors: [],
  };

  for (let i = 0; i < bookings.length; i++) {
    const booking = bookings[i];
    // Use field NAMES for reading (Airtable returns field names, not IDs)
    const simplybookId = booking.get(FIELD_NAMES.sb_simplybook_id);
    const schoolNameFromAirtable = booking.get(FIELD_NAMES.sb_school_name) || 'Unknown';

    console.log(`[${i + 1}/${bookings.length}] Processing: ${schoolNameFromAirtable} (SB ID: ${simplybookId})`);

    try {
      // Fetch from SimplyBook API
      const sbBooking = await fetchBookingFromSimplyBook(simplybookId);

      if (!sbBooking) {
        console.log(`  - Not found in SimplyBook, skipping`);
        results.errors.push({ simplybookId, schoolName: schoolNameFromAirtable, error: 'Not found in SimplyBook' });
        continue;
      }

      // Extract contact email
      const email = sbBooking.client_email;
      if (!email) {
        console.log(`  - No email in SimplyBook data, skipping`);
        results.skipped_no_email++;
        continue;
      }

      // Check if teacher already exists
      const existingTeacher = await teacherExistsByEmail(email);
      if (existingTeacher) {
        console.log(`  - Teacher already exists: ${email}`);
        results.skipped_exists++;
        continue;
      }

      // Map intake fields
      const mapped = mapIntakeFields(sbBooking);

      // Find region record
      const regionMatch = findBestRegionMatch(regionList, mapped.region);

      // Find linked Event
      const event = findEventFromCache(booking.id);

      // Determine best school name (SimplyBook sometimes returns client ID instead of name)
      const isNumericSchoolName = mapped.schoolName && /^\d+$/.test(mapped.schoolName);
      const bestSchoolName = isNumericSchoolName
        ? schoolNameFromAirtable
        : (mapped.schoolName || schoolNameFromAirtable);

      // Prepare teacher data
      const teacherData = {
        email: email,
        name: mapped.contactPerson || sbBooking.client_name || bestSchoolName || 'Unknown',
        phone: mapped.phone,
        schoolName: bestSchoolName,
        schoolAddress: mapped.address,
        regionRecordId: regionMatch?.id,
        createdAt: mapped.recordDate || new Date().toISOString(),
        simplybookId: simplybookId,
        eventRecordId: event?.id,
      };

      console.log(`  - Creating teacher: ${email}`);
      if (verbose) {
        console.log(`    Name: ${teacherData.name}`);
        console.log(`    School: ${teacherData.schoolName}`);
        console.log(`    Phone: ${teacherData.phone || '(none)'}`);
        console.log(`    Address: ${teacherData.schoolAddress || '(none)'}`);
        console.log(`    Region: ${regionMatch ? `${regionMatch.name} (${regionMatch.id})` : '(none)'}`);
        console.log(`    Event: ${event ? `linked (${event.id})` : 'not found'}`);
        console.log(`    Created At: ${teacherData.createdAt}`);
      }

      if (!dryRun) {
        await createTeacher(teacherData);
        console.log(`  - Created!`);
      } else {
        console.log(`  - Would create (dry run)`);
      }

      results.created++;

      // Rate limiting
      await sleep(200);

    } catch (error) {
      console.error(`  - ERROR: ${error.message}`);
      results.errors.push({ simplybookId, schoolName: schoolNameFromAirtable, error: error.message });
    }
  }

  // Summary
  console.log('\n\n=== Summary ===\n');
  console.log(`Total processed: ${bookings.length}`);
  console.log(`Created: ${results.created}`);
  console.log(`Skipped (exists): ${results.skipped_exists}`);
  console.log(`Skipped (no email): ${results.skipped_no_email}`);
  console.log(`Errors: ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log(`\nErrors (${results.errors.length}):`);
    results.errors.forEach((e) =>
      console.log(`  - ${e.schoolName}: ${e.error}`)
    );
  }

  if (dryRun) {
    console.log('\n[DRY RUN] No actual changes were made. Remove --dry-run to execute.');
  }
}

// Parse arguments and run
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');

runBackfill(dryRun, verbose).catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
