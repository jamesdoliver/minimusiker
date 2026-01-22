/**
 * Backfill SchoolBooking Record from SimplyBook
 *
 * Updates a SchoolBooking record with data extracted from SimplyBook API.
 * Use this when a record has missing fields that are available in SimplyBook.
 *
 * Usage:
 *   node scripts/backfill-booking-from-simplybook.js <booking_hash> --dry-run    # Preview changes
 *   node scripts/backfill-booking-from-simplybook.js <booking_hash>              # Apply changes
 *
 * Example:
 *   node scripts/backfill-booking-from-simplybook.js keh1c7525
 */

require('dotenv').config({ path: '.env.local' });

const Airtable = require('airtable');

// ============================================
// Configuration
// ============================================

const SCHOOL_BOOKINGS_TABLE_ID = 'tblrktl5eLJEWE4M6';

// Environment variables
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const SIMPLYBOOK_COMPANY = process.env.SIMPLY_BOOK_ACCOUNT_NAME;
const SIMPLYBOOK_USER_LOGIN = process.env.SIMPLYBOOK_USER_LOGIN;
const SIMPLYBOOK_USER_PASSWORD = process.env.SIMPLYBOOK_USER_PASSWORD;
const SIMPLYBOOK_JSON_RPC_ENDPOINT = process.env.SIMPLYBOOK_JSON_RCP_API_ENDPOINT || 'https://user-api.simplybook.it/';

// Parse arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const bookingHash = args.find(a => !a.startsWith('--'));

if (!bookingHash) {
  console.error('Usage: node scripts/backfill-booking-from-simplybook.js <booking_hash> [--dry-run]');
  console.error('Example: node scripts/backfill-booking-from-simplybook.js keh1c7525');
  process.exit(1);
}

// Validate environment
if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID');
  process.exit(1);
}
if (!SIMPLYBOOK_COMPANY || !SIMPLYBOOK_USER_LOGIN || !SIMPLYBOOK_USER_PASSWORD) {
  console.error('Missing SimplyBook credentials');
  process.exit(1);
}

// Initialize Airtable
const airtable = new Airtable({ apiKey: AIRTABLE_API_KEY });
const base = airtable.base(AIRTABLE_BASE_ID);

// ============================================
// SimplyBook API
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

async function getBookingById(bookingId) {
  const token = await getAdminToken();

  const request = {
    jsonrpc: '2.0',
    method: 'getBookingDetails',
    params: [bookingId],
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
    throw new Error(`SimplyBook getBookingDetails error: ${data.error.message}`);
  }

  return data.result;
}

// ============================================
// Mapping Function
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

  const schoolNameFromFields = findField(['name', 'schule', 'school', 'einrichtung']);
  const schoolName = booking.client || schoolNameFromFields || booking.client_name || '';

  return {
    schoolName,
    contactPerson: findField(['ansprechpartner', 'ansprechperson', 'contact person', 'contact', 'kontakt']) || booking.client_name || '',
    contactEmail: booking.client_email || findField(['email', 'e-mail']) || '',
    phone: booking.client_phone || findField(['telefon', 'phone', 'tel']) || undefined,
    address: findField(['adresse', 'address', 'strasse', 'street']) || booking.client_address1 || undefined,
    postalCode: findField(['plz', 'postal', 'postleitzahl', 'postcode']) || booking.client_zip || undefined,
    city: findField(['stadt', 'city', 'ort']) || booking.client_city || undefined,
    numberOfChildren,
    costCategory: numberOfChildren > 150 ? '>150 children' : '<150 children',
  };
}

// ============================================
// Airtable Operations
// ============================================

async function findSchoolBookingByHash(hash) {
  const records = await base(SCHOOL_BOOKINGS_TABLE_ID)
    .select({
      filterByFormula: `{simplybook_hash} = "${hash}"`,
      maxRecords: 1,
    })
    .firstPage();

  return records[0] || null;
}

async function updateSchoolBooking(recordId, fields) {
  return base(SCHOOL_BOOKINGS_TABLE_ID).update(recordId, fields);
}

// ============================================
// Main
// ============================================

async function backfillBooking() {
  console.log('\n========================================');
  console.log('  Backfill SchoolBooking from SimplyBook');
  console.log('========================================');
  console.log(`Booking Hash: ${bookingHash}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (preview only)' : 'EXECUTE'}`);
  console.log('========================================\n');

  // Step 1: Find Airtable record
  console.log('Finding SchoolBooking in Airtable...');
  const record = await findSchoolBookingByHash(bookingHash);

  if (!record) {
    console.error(`No SchoolBooking found with hash: ${bookingHash}`);
    process.exit(1);
  }

  console.log(`Found: ${record.id}`);
  console.log(`SimplyBook ID: ${record.get('simplybook_id')}\n`);

  // Step 2: Fetch SimplyBook data
  console.log('Fetching data from SimplyBook...');
  const simplybookData = await getBookingById(record.get('simplybook_id'));

  if (!simplybookData) {
    console.error('Failed to fetch SimplyBook data');
    process.exit(1);
  }

  // Step 3: Extract mapped data
  const mappedData = mapIntakeFields(simplybookData);

  // Step 4: Determine what needs updating
  const updates = {};
  const currentFields = record.fields;

  const fieldMappings = [
    { airtable: 'school_name', mapped: 'schoolName', label: 'School Name' },
    { airtable: 'school_contact_name', mapped: 'contactPerson', label: 'Contact Person' },
    { airtable: 'school_contact_email', mapped: 'contactEmail', label: 'Contact Email' },
    { airtable: 'school_phone', mapped: 'phone', label: 'Phone' },
    { airtable: 'school_address', mapped: 'address', label: 'Address' },
    { airtable: 'school_postal_code', mapped: 'postalCode', label: 'Postal Code' },
    { airtable: 'city', mapped: 'city', label: 'City' },
    { airtable: 'estimated_children', mapped: 'numberOfChildren', label: 'Estimated Children' },
    { airtable: 'school_size_category', mapped: 'costCategory', label: 'Size Category' },
  ];

  console.log('Comparing fields:\n');

  for (const mapping of fieldMappings) {
    const currentValue = currentFields[mapping.airtable];
    const newValue = mappedData[mapping.mapped];
    const isEmpty = !currentValue || currentValue === '' || currentValue === 0;
    const hasNewValue = newValue !== undefined && newValue !== '' && newValue !== 0;

    if (isEmpty && hasNewValue) {
      updates[mapping.airtable] = newValue;
      console.log(`  ${mapping.label}:`);
      console.log(`    Current: "${currentValue || ''}"`);
      console.log(`    Update:  "${newValue}" [WILL UPDATE]`);
      console.log('');
    } else if (isEmpty && !hasNewValue) {
      console.log(`  ${mapping.label}:`);
      console.log(`    Current: "${currentValue || ''}" [MISSING - no data in SimplyBook]`);
      console.log('');
    }
  }

  // Step 5: Apply updates
  if (Object.keys(updates).length === 0) {
    console.log('\nNo updates needed - all available data is already in Airtable.');
    return;
  }

  console.log(`\nFields to update: ${Object.keys(updates).length}`);

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Would update with:');
    console.log(JSON.stringify(updates, null, 2));
    console.log('\nRun without --dry-run to apply changes.');
  } else {
    console.log('\nApplying updates...');
    await updateSchoolBooking(record.id, updates);
    console.log('Record updated successfully.');
  }
}

backfillBooking()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Backfill failed:', error);
    process.exit(1);
  });
