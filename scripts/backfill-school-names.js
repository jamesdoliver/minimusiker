/**
 * Backfill Script: Populate school_name field for existing SchoolBookings
 *
 * This script:
 * 1. Fetches all SchoolBookings records that have empty school_name
 * 2. For each, fetches booking details from SimplyBook API
 * 3. Extracts school name from intake form fields
 * 4. Updates Airtable record with school_name
 *
 * Usage: node scripts/backfill-school-names.js
 *
 * Environment variables required:
 * - AIRTABLE_API_KEY
 * - AIRTABLE_BASE_ID
 * - SIMPLYBOOK_API_KEY (optional - for re-fetching from SimplyBook)
 * - SIMPLY_BOOK_ACCOUNT_NAME (optional)
 * - SIMPLYBOOK_USER_LOGIN (optional)
 * - SIMPLYBOOK_USER_PASSWORD (optional)
 */

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

// Field IDs for updating (Airtable accepts IDs for writes)
const SCHOOL_BOOKINGS_TABLE_ID = 'tblrktl5eLJEWE4M6';
const SCHOOL_BOOKINGS_FIELD_IDS = {
  school_name: 'fldVgEyfHufAuNovP', // Field ID for updating
};

// Field names for reading (Airtable returns field names in responses)
const FIELD_NAMES = {
  simplybook_id: 'simplybook_id',
  school_name: 'school_name',
  school_contact_name: 'school_contact_name',
};

// Initialize Airtable
const airtableApiKey = process.env.AIRTABLE_API_KEY;
const airtableBaseId = process.env.AIRTABLE_BASE_ID;

if (!airtableApiKey || !airtableBaseId) {
  console.error('Missing required environment variables: AIRTABLE_API_KEY, AIRTABLE_BASE_ID');
  process.exit(1);
}

const airtable = new Airtable({ apiKey: airtableApiKey }).base(airtableBaseId);

// SimplyBook credentials (optional - for re-fetching)
const SIMPLYBOOK_CONFIG = {
  apiKey: process.env.SIMPLYBOOK_API_KEY,
  companyLogin: process.env.SIMPLY_BOOK_ACCOUNT_NAME,
  userLogin: process.env.SIMPLYBOOK_USER_LOGIN,
  userPassword: process.env.SIMPLYBOOK_USER_PASSWORD,
  jsonRpcEndpoint: 'https://user-api.simplybook.it/',
};

let adminToken = null;

/**
 * Get admin token from SimplyBook
 */
async function getSimplyBookAdminToken() {
  if (adminToken) return adminToken;

  if (!SIMPLYBOOK_CONFIG.apiKey || !SIMPLYBOOK_CONFIG.userLogin) {
    console.log('SimplyBook credentials not configured - will use fallback strategy');
    return null;
  }

  try {
    // First get API token
    const tokenResponse = await fetch(`${SIMPLYBOOK_CONFIG.jsonRpcEndpoint}login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'getToken',
        params: [SIMPLYBOOK_CONFIG.companyLogin, SIMPLYBOOK_CONFIG.apiKey],
        id: 1,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.result) {
      throw new Error('Failed to get SimplyBook token');
    }

    // Then get user token
    const userTokenResponse = await fetch(`${SIMPLYBOOK_CONFIG.jsonRpcEndpoint}login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Company-Login': SIMPLYBOOK_CONFIG.companyLogin,
        'X-Token': tokenData.result,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'getUserToken',
        params: [SIMPLYBOOK_CONFIG.companyLogin, SIMPLYBOOK_CONFIG.userLogin, SIMPLYBOOK_CONFIG.userPassword],
        id: 2,
      }),
    });

    const userTokenData = await userTokenResponse.json();
    if (!userTokenData.result) {
      throw new Error('Failed to get SimplyBook user token');
    }

    adminToken = userTokenData.result;
    return adminToken;
  } catch (error) {
    console.error('SimplyBook auth error:', error.message);
    return null;
  }
}

/**
 * Fetch booking details from SimplyBook
 */
async function getBookingFromSimplyBook(bookingId) {
  const token = await getSimplyBookAdminToken();
  if (!token) return null;

  try {
    const response = await fetch(`${SIMPLYBOOK_CONFIG.jsonRpcEndpoint}admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Company-Login': SIMPLYBOOK_CONFIG.companyLogin,
        'X-Token': token,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'getBookingDetails',
        params: [bookingId],
        id: 3,
      }),
    });

    const data = await response.json();
    return data.result || null;
  } catch (error) {
    console.error(`Failed to fetch booking ${bookingId}:`, error.message);
    return null;
  }
}

/**
 * Extract school name from SimplyBook booking data
 * Mirrors the logic in simplybookService.mapIntakeFields
 */
function extractSchoolName(booking) {
  if (!booking) return null;

  const rawFields = booking.additional_fields || [];
  const fieldsArray = Array.isArray(rawFields) ? rawFields : Object.values(rawFields);

  // Helper to find field by partial title match
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

  // Look for school name field (same keywords as simplybookService)
  const schoolName = findField(['name', 'schule', 'school', 'einrichtung']);

  // Fall back to client_name if no school name found
  return schoolName || booking.client_name || null;
}

/**
 * Main backfill function
 */
async function backfillSchoolNames() {
  console.log('Starting school name backfill...\n');

  // Fetch all records - we'll check school_name in code
  console.log('Fetching all SchoolBookings records...');

  const records = [];
  await airtable
    .table(SCHOOL_BOOKINGS_TABLE_ID)
    .select({
      fields: [
        FIELD_NAMES.simplybook_id,
        FIELD_NAMES.school_contact_name,
        FIELD_NAMES.school_name,
      ],
    })
    .eachPage((pageRecords, fetchNextPage) => {
      records.push(...pageRecords);
      fetchNextPage();
    });

  // Filter to only records without school_name
  const recordsToUpdate = records.filter(r => {
    const schoolName = r.fields[FIELD_NAMES.school_name];
    return !schoolName || schoolName.trim() === '';
  });

  console.log(`Found ${records.length} total records, ${recordsToUpdate.length} need school_name\n`);

  if (recordsToUpdate.length === 0) {
    console.log('No records to update. Done!');
    return;
  }

  // Track results
  const results = {
    updated: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  // Process each record
  for (const record of recordsToUpdate) {
    const simplybookId = record.fields[FIELD_NAMES.simplybook_id];
    const contactName = record.fields[FIELD_NAMES.school_contact_name];

    console.log(`Processing record ${record.id} (SimplyBook ID: ${simplybookId})`);

    let schoolName = null;

    // Try to fetch from SimplyBook if we have credentials
    if (simplybookId && SIMPLYBOOK_CONFIG.apiKey) {
      const booking = await getBookingFromSimplyBook(simplybookId);
      schoolName = extractSchoolName(booking);
    }

    // If no school name from SimplyBook, use contact name as fallback
    // (You may want to manually review these later)
    if (!schoolName && contactName) {
      console.log(`  - Using contact name as fallback: ${contactName}`);
      schoolName = contactName;
      results.details.push({
        recordId: record.id,
        status: 'fallback',
        schoolName,
        note: 'Used contact name as fallback - may need manual review',
      });
    }

    if (schoolName) {
      try {
        await airtable.table(SCHOOL_BOOKINGS_TABLE_ID).update(record.id, {
          [SCHOOL_BOOKINGS_FIELD_IDS.school_name]: schoolName,
        });
        console.log(`  - Updated: ${schoolName}`);
        results.updated++;
      } catch (error) {
        console.error(`  - Failed to update: ${error.message}`);
        results.failed++;
      }
    } else {
      console.log(`  - Skipped: No school name found`);
      results.skipped++;
    }

    // Rate limiting - avoid hitting Airtable API limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Print summary
  console.log('\n=== Backfill Complete ===');
  console.log(`Updated: ${results.updated}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Failed: ${results.failed}`);

  if (results.details.length > 0) {
    console.log('\nRecords using fallback (may need manual review):');
    results.details.forEach(d => {
      console.log(`  - ${d.recordId}: ${d.schoolName}`);
    });
  }
}

// Run the script
backfillSchoolNames().catch(console.error);
