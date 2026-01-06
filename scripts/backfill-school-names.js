/**
 * Backfill Script: Populate school_name field for existing SchoolBookings
 *
 * This script:
 * 1. Fetches all bookings from SimplyBook API (which includes the 'client' field with school names)
 * 2. Fetches all SchoolBookings records from Airtable
 * 3. Matches by simplybook_id and updates school_name from SimplyBook's 'client' field
 *
 * Usage: node scripts/backfill-school-names.js
 *
 * Environment variables required:
 * - AIRTABLE_API_KEY
 * - AIRTABLE_BASE_ID
 * - SIMPLYBOOK_API_KEY
 * - SIMPLY_BOOK_ACCOUNT_NAME
 * - SIMPLYBOOK_USER_LOGIN
 * - SIMPLYBOOK_USER_PASSWORD
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

// SimplyBook credentials
const SIMPLYBOOK_CONFIG = {
  apiKey: process.env.SIMPLYBOOK_API_KEY,
  companyLogin: process.env.SIMPLY_BOOK_ACCOUNT_NAME,
  userLogin: process.env.SIMPLYBOOK_USER_LOGIN,
  userPassword: process.env.SIMPLYBOOK_USER_PASSWORD,
  jsonRpcEndpoint: 'https://user-api.simplybook.it/',
};

/**
 * Get all bookings from SimplyBook API
 * Returns a map of booking ID -> school name (from 'client' field)
 */
async function getSimplyBookBookings() {
  if (!SIMPLYBOOK_CONFIG.apiKey || !SIMPLYBOOK_CONFIG.userLogin) {
    console.log('SimplyBook credentials not configured');
    return new Map();
  }

  try {
    // Get API token
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
    if (!tokenData.result) throw new Error('Failed to get SimplyBook token');

    // Get user token
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
    if (!userTokenData.result) throw new Error('Failed to get SimplyBook user token');

    // Fetch all bookings
    const response = await fetch(`${SIMPLYBOOK_CONFIG.jsonRpcEndpoint}admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Company-Login': SIMPLYBOOK_CONFIG.companyLogin,
        'X-User-Token': userTokenData.result,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'getBookings',
        params: [{}],
        id: 3,
      }),
    });
    const data = await response.json();

    if (!data.result) {
      console.log('No bookings returned from SimplyBook');
      return new Map();
    }

    // Create map of booking ID -> school name (from 'client' field)
    const bookingsMap = new Map();
    for (const booking of data.result) {
      // The 'client' field contains the school/institution name
      if (booking.id && booking.client) {
        bookingsMap.set(booking.id.toString(), booking.client);
      }
    }

    console.log(`Fetched ${bookingsMap.size} bookings from SimplyBook with school names`);
    return bookingsMap;
  } catch (error) {
    console.error('SimplyBook error:', error.message);
    return new Map();
  }
}

/**
 * Main backfill function
 */
async function backfillSchoolNames() {
  console.log('Starting school name backfill...\n');

  // Step 1: Fetch all bookings from SimplyBook
  console.log('Step 1: Fetching bookings from SimplyBook...');
  const simplybookData = await getSimplyBookBookings();

  // Step 2: Fetch all records from Airtable
  console.log('\nStep 2: Fetching SchoolBookings from Airtable...');
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

  console.log(`Found ${records.length} total records in Airtable\n`);

  // Track results
  const results = {
    updated: 0,
    skipped: 0,
    alreadySet: 0,
    noMatch: 0,
  };

  // Step 3: Process each record
  console.log('Step 3: Updating school names...\n');
  for (const record of records) {
    const simplybookId = record.fields[FIELD_NAMES.simplybook_id];
    const currentSchoolName = record.fields[FIELD_NAMES.school_name];
    const contactName = record.fields[FIELD_NAMES.school_contact_name];

    // Skip if already has a school name that's different from contact name
    if (currentSchoolName && currentSchoolName !== contactName) {
      results.alreadySet++;
      continue;
    }

    // Try to get school name from SimplyBook data
    let newSchoolName = null;
    if (simplybookId) {
      newSchoolName = simplybookData.get(simplybookId.toString());
    }

    if (newSchoolName && newSchoolName !== currentSchoolName) {
      try {
        await airtable.table(SCHOOL_BOOKINGS_TABLE_ID).update(record.id, {
          [SCHOOL_BOOKINGS_FIELD_IDS.school_name]: newSchoolName,
        });
        console.log(`✓ ${simplybookId}: "${newSchoolName}"`);
        results.updated++;
      } catch (error) {
        console.error(`✗ ${simplybookId}: Failed - ${error.message}`);
        results.skipped++;
      }
    } else if (!newSchoolName && simplybookId) {
      results.noMatch++;
    } else {
      results.skipped++;
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Print summary
  console.log('\n=== Backfill Complete ===');
  console.log(`Updated: ${results.updated}`);
  console.log(`Already set: ${results.alreadySet}`);
  console.log(`No SimplyBook match: ${results.noMatch}`);
  console.log(`Skipped: ${results.skipped}`);
}

// Run the script
backfillSchoolNames().catch(console.error);
