/**
 * Migration: Re-sync SchoolBookings region and city from SimplyBook
 *
 * This script fetches fresh booking data from SimplyBook API and updates
 * the SchoolBookings table with:
 * - Correct linked region (Teams/Regionen record ID)
 * - Correct city (without fallback to region)
 *
 * Usage:
 *   node scripts/resync-regions-from-simplybook.js --dry-run    # Preview changes
 *   node scripts/resync-regions-from-simplybook.js              # Execute migration
 *   node scripts/resync-regions-from-simplybook.js --verbose    # Show detailed logs
 *
 * Environment variables required:
 *   AIRTABLE_API_KEY
 *   AIRTABLE_BASE_ID
 *   SIMPLYBOOK_COMPANY_LOGIN
 *   SIMPLYBOOK_API_KEY
 *   SIMPLYBOOK_SECRET_KEY
 */

require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');

// Table and field IDs
const SCHOOL_BOOKINGS_TABLE_ID = 'tblrktl5eLJEWE4M6';
const TEAMS_REGIONEN_TABLE_ID = 'tblQm2nyPKU7k2N2N';

// Field IDs for updates (Airtable API)
const FIELD_IDS = {
  simplybook_id: 'fldb5FI6ij00eICaT',
  region: 'fldWhJSIkeC3V5Dmz',
  city: 'fldiVb8duhKGIzDkD',
  school_name: 'fldVgEyfHufAuNovP',
};

// Field names for reading (Airtable returns values by name)
const FIELD_NAMES = {
  simplybook_id: 'Simplybook ID',
  region: 'Region',
  city: 'City',
  school_name: 'School Name',
};

// Initialize Airtable
const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

// SimplyBook API configuration (matching simplybookService.ts)
const SIMPLYBOOK_CONFIG = {
  companyLogin: process.env.SIMPLYBOOK_COMPANY_LOGIN || 'minimusiker',
  apiKey: process.env.SIMPLYBOOK_API_KEY,
  secretKey: process.env.SIMPLYBOOK_API_SECRET,
  userLogin: process.env.SIMPLYBOOK_USER_LOGIN,
  userPassword: process.env.SIMPLYBOOK_USER_PASSWORD,
  // Base endpoint - append 'login' or 'admin' as needed
  jsonRpcEndpoint: process.env.SIMPLYBOOK_JSON_RCP_API_ENDPOINT || 'https://user-api.simplybook.it/',
};

let authToken = null;

/**
 * Get SimplyBook authentication token
 */
async function getSimplyBookToken() {
  if (authToken) return authToken;

  console.log('Authenticating with SimplyBook...');
  console.log(`  Company: ${SIMPLYBOOK_CONFIG.companyLogin}`);
  console.log(`  User: ${SIMPLYBOOK_CONFIG.userLogin}`);
  console.log(`  Endpoint: ${SIMPLYBOOK_CONFIG.jsonRpcEndpoint}login`);

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
  console.log('  Authentication successful!');
  return authToken;
}

/**
 * Fetch booking details from SimplyBook API
 */
async function fetchBookingFromSimplyBook(bookingId) {
  const token = await getSimplyBookToken();

  // Use X-User-Token for admin auth (matching simplybookService.ts)
  const response = await fetch(`${SIMPLYBOOK_CONFIG.jsonRpcEndpoint}admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Company-Login': SIMPLYBOOK_CONFIG.companyLogin,
      'X-User-Token': token,  // Admin auth uses X-User-Token
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

/**
 * Extract region and city from SimplyBook booking
 * Region comes from unit_name (e.g., "Minimusiker Köln/Bonn" -> "Köln/Bonn")
 * City comes from client_city or "Ort" intake field
 */
function mapIntakeFields(booking) {
  const rawFields = booking.additional_fields || [];

  // Normalize fields to array format
  const fieldsArray = Array.isArray(rawFields)
    ? rawFields
    : Object.values(rawFields);

  // Helper to find field by partial title match (case-insensitive)
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

  // City: prefer client_city, then "Ort" from intake form
  const city = booking.client_city || findField(['ort', 'stadt', 'city']) || undefined;

  return {
    region,
    city,
  };
}

/**
 * Build a map of Teams/Regionen names to record IDs
 */
async function buildRegionMap() {
  console.log('Building Teams/Regionen name -> ID map...');
  const regionMap = new Map();

  const records = await airtable
    .table(TEAMS_REGIONEN_TABLE_ID)
    .select({ fields: ['Name'] })
    .all();

  for (const record of records) {
    const name = record.get('Name');
    if (name) {
      regionMap.set(name.toLowerCase(), record.id);
    }
  }

  console.log(`Found ${records.length} regions: ${[...regionMap.keys()].join(', ')}`);
  return regionMap;
}

/**
 * Fetch all SchoolBookings with a simplybook_id
 */
async function getBookingsToMigrate() {
  console.log('Fetching SchoolBookings with SimplyBook IDs...');

  const records = await airtable
    .table(SCHOOL_BOOKINGS_TABLE_ID)
    .select({
      filterByFormula: `NOT({${FIELD_IDS.simplybook_id}} = "")`,
      fields: [
        FIELD_IDS.simplybook_id,
        FIELD_IDS.region,
        FIELD_IDS.city,
        FIELD_IDS.school_name,
      ],
    })
    .all();

  console.log(`Found ${records.length} bookings with SimplyBook IDs`);
  return records;
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main migration function
 */
async function runMigration(dryRun = false, verbose = false) {
  console.log('\n=== SimplyBook Region Re-sync Migration ===\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`Verbose: ${verbose}\n`);

  // Build region lookup map
  const regionMap = await buildRegionMap();

  // Get all bookings with SimplyBook IDs
  const bookings = await getBookingsToMigrate();

  if (bookings.length === 0) {
    console.log('No bookings found to migrate.');
    return;
  }

  const results = {
    updated: 0,
    skipped: 0,
    notFoundInSimplyBook: [],
    regionNotMatched: [],
    errors: [],
  };

  for (let i = 0; i < bookings.length; i++) {
    const booking = bookings[i];
    // Try both field ID and common field names
    const simplybookId = booking.get(FIELD_IDS.simplybook_id) || booking.get('Simplybook ID') || booking.get('simplybook_id');
    const schoolName = booking.get(FIELD_IDS.school_name) || booking.get('School Name') || booking.get('school_name') || 'Unknown';
    const currentRegion = booking.get(FIELD_IDS.region) || booking.get('Region');
    const currentCity = booking.get(FIELD_IDS.city) || booking.get('City');

    console.log(`\n[${i + 1}/${bookings.length}] Processing: ${schoolName} (SB ID: ${simplybookId})`);

    try {
      // Fetch fresh data from SimplyBook
      const sbBooking = await fetchBookingFromSimplyBook(simplybookId);

      if (!sbBooking) {
        console.log(`  - Not found in SimplyBook, skipping`);
        results.notFoundInSimplyBook.push({ simplybookId, schoolName });
        results.skipped++;
        continue;
      }

      // Extract region and city
      const mapped = mapIntakeFields(sbBooking);

      if (verbose) {
        console.log(`  - SimplyBook data: region="${mapped.region}", city="${mapped.city}"`);
        console.log(`  - Current Airtable: region="${currentRegion}", city="${currentCity}"`);
      }

      // Look up region record ID
      let regionRecordId = null;
      if (mapped.region) {
        regionRecordId = regionMap.get(mapped.region.toLowerCase());
        if (!regionRecordId) {
          console.log(`  - WARNING: Region "${mapped.region}" not found in Teams/Regionen`);
          results.regionNotMatched.push({ simplybookId, schoolName, region: mapped.region });
        }
      }

      // Prepare update
      const updateFields = {};

      // Update region (linked field format)
      if (regionRecordId) {
        updateFields[FIELD_IDS.region] = [regionRecordId];
        console.log(`  - Region: "${mapped.region}" -> linked record ${regionRecordId}`);
      } else {
        updateFields[FIELD_IDS.region] = [];
        console.log(`  - Region: (none or not matched)`);
      }

      // Update city (without fallback to region!)
      const newCity = mapped.city || '';
      updateFields[FIELD_IDS.city] = newCity;
      console.log(`  - City: "${newCity}"`);

      // Apply update
      if (!dryRun) {
        await airtable.table(SCHOOL_BOOKINGS_TABLE_ID).update(booking.id, updateFields);
        console.log(`  - Updated!`);
      } else {
        console.log(`  - Would update (dry run)`);
      }

      results.updated++;

      // Rate limiting: pause between API calls
      await sleep(200);
    } catch (error) {
      console.error(`  - ERROR: ${error.message}`);
      results.errors.push({ simplybookId, schoolName, error: error.message });
    }
  }

  // Summary
  console.log('\n\n=== Migration Summary ===\n');
  console.log(`Total processed: ${bookings.length}`);
  console.log(`Updated: ${results.updated}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Errors: ${results.errors.length}`);

  if (results.notFoundInSimplyBook.length > 0) {
    console.log(`\nNot found in SimplyBook (${results.notFoundInSimplyBook.length}):`);
    results.notFoundInSimplyBook.forEach((b) =>
      console.log(`  - ${b.schoolName} (ID: ${b.simplybookId})`)
    );
  }

  if (results.regionNotMatched.length > 0) {
    console.log(`\nRegions not found in Teams/Regionen (${results.regionNotMatched.length}):`);
    const uniqueRegions = [...new Set(results.regionNotMatched.map((b) => b.region))];
    uniqueRegions.forEach((r) => console.log(`  - "${r}"`));
  }

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

runMigration(dryRun, verbose).catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
