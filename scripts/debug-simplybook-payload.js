/**
 * Debug SimplyBook Booking Payload
 *
 * Diagnoses missing data in a SchoolBooking by comparing:
 * 1. What's in Airtable for this booking
 * 2. The raw SimplyBook API response
 * 3. What mapIntakeFields() would extract
 *
 * Usage:
 *   node scripts/debug-simplybook-payload.js <booking_hash>
 *
 * Example:
 *   node scripts/debug-simplybook-payload.js keh1c7525
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

// Validate environment
if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID');
  process.exit(1);
}
if (!SIMPLYBOOK_COMPANY || !SIMPLYBOOK_USER_LOGIN || !SIMPLYBOOK_USER_PASSWORD) {
  console.error('Missing SimplyBook credentials (SIMPLY_BOOK_ACCOUNT_NAME, SIMPLYBOOK_USER_LOGIN, SIMPLYBOOK_USER_PASSWORD)');
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
// Mapping Functions (mirrors simplybookService.ts)
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
        return { title, value: field.value || '', matched: true };
      }
    }
    return { title: null, value: '', matched: false };
  };

  // Track all field extractions
  const extractions = {
    schoolName: findField(['name', 'schule', 'school', 'einrichtung']),
    contactPerson: findField(['ansprechpartner', 'ansprechperson', 'contact person', 'contact', 'kontakt']),
    contactEmail: findField(['email', 'e-mail']),
    phone: findField(['telefon', 'phone', 'tel']),
    address: findField(['adresse', 'address', 'strasse', 'street']),
    postalCode: findField(['plz', 'postal', 'postleitzahl', 'postcode']),
    children: findField(['kinder', 'children', 'anzahl']),
    region: findField(['region', 'standort', 'location', 'gebiet', 'ort']),
    city: findField(['stadt', 'city']),
  };

  // Build final mapped data with fallbacks
  const numberOfChildren = parseInt(extractions.children.value, 10) || 0;

  return {
    extractions,
    mappedData: {
      schoolName: booking.client || extractions.schoolName.value || booking.client_name || '',
      contactPerson: extractions.contactPerson.value || booking.client_name || '',
      contactEmail: booking.client_email || extractions.contactEmail.value || '',
      phone: booking.client_phone || extractions.phone.value || undefined,
      address: extractions.address.value || booking.client_address1 || undefined,
      postalCode: extractions.postalCode.value || booking.client_zip || undefined,
      region: extractions.region.value || undefined,
      city: extractions.city.value || booking.client_city || undefined,
      numberOfChildren,
      costCategory: numberOfChildren > 150 ? '>150 children' : '<150 children',
    },
    fallbacks: {
      schoolName: { client: booking.client, client_name: booking.client_name },
      contactPerson: { client_name: booking.client_name },
      contactEmail: { client_email: booking.client_email },
      phone: { client_phone: booking.client_phone },
      address: { client_address1: booking.client_address1 },
      postalCode: { client_zip: booking.client_zip },
      city: { client_city: booking.client_city },
    },
  };
}

// ============================================
// Airtable Lookup
// ============================================

async function findSchoolBookingByHash(hash) {
  const records = await base(SCHOOL_BOOKINGS_TABLE_ID)
    .select({
      filterByFormula: `{simplybook_hash} = "${hash}"`,
      maxRecords: 1,
    })
    .firstPage();

  if (records.length === 0) {
    return null;
  }

  const record = records[0];
  return {
    id: record.id,
    fields: record.fields,
    simplybookId: record.get('simplybook_id'),
  };
}

// ============================================
// Main Diagnostic Function
// ============================================

async function debugSimplybookPayload(bookingHash) {
  console.log('\n========================================');
  console.log('  SimplyBook Booking Payload Diagnostic');
  console.log('========================================');
  console.log(`Booking Hash: ${bookingHash}`);
  console.log('========================================\n');

  // Step 1: Find booking in Airtable by hash
  console.log('Step 1: Looking up SchoolBooking in Airtable...\n');
  const airtableRecord = await findSchoolBookingByHash(bookingHash);

  if (!airtableRecord) {
    console.log(`No SchoolBooking found with hash: ${bookingHash}`);
    process.exit(1);
  }

  console.log(`Found SchoolBooking: ${airtableRecord.id}`);
  console.log(`SimplyBook ID: ${airtableRecord.simplybookId}\n`);

  // Step 2: Fetch raw booking from SimplyBook
  console.log('Step 2: Fetching raw booking from SimplyBook API...\n');
  const simplybookData = await getBookingById(airtableRecord.simplybookId);

  if (!simplybookData) {
    console.log(`No booking found in SimplyBook with ID: ${airtableRecord.simplybookId}`);
    process.exit(1);
  }

  // Step 3: Display raw additional_fields
  console.log('========================================');
  console.log('  Raw SimplyBook additional_fields');
  console.log('========================================\n');

  const additionalFields = simplybookData.additional_fields || [];
  if (Array.isArray(additionalFields) && additionalFields.length > 0) {
    additionalFields.forEach((field, index) => {
      console.log(`[${index}] Field Title: "${field.field_title || field.title || 'N/A'}"`);
      console.log(`    Value: "${field.value || ''}"`);
      console.log(`    Field ID: ${field.field_id || 'N/A'}`);
      console.log('');
    });
  } else if (typeof additionalFields === 'object' && Object.keys(additionalFields).length > 0) {
    Object.entries(additionalFields).forEach(([key, field]) => {
      console.log(`[${key}] Field Title: "${field.field_title || field.title || 'N/A'}"`);
      console.log(`       Value: "${field.value || ''}"`);
      console.log('');
    });
  } else {
    console.log('No additional_fields found in SimplyBook response.\n');
  }

  // Step 4: Display client_* fallback fields
  console.log('========================================');
  console.log('  SimplyBook client_* Fields (Fallbacks)');
  console.log('========================================\n');
  console.log(`client:          "${simplybookData.client || ''}"`);
  console.log(`client_name:     "${simplybookData.client_name || ''}"`);
  console.log(`client_email:    "${simplybookData.client_email || ''}"`);
  console.log(`client_phone:    "${simplybookData.client_phone || ''}"`);
  console.log(`client_address1: "${simplybookData.client_address1 || ''}"`);
  console.log(`client_address2: "${simplybookData.client_address2 || ''}"`);
  console.log(`client_city:     "${simplybookData.client_city || ''}"`);
  console.log(`client_zip:      "${simplybookData.client_zip || ''}"`);
  console.log('');

  // Step 5: Analyze extraction
  console.log('========================================');
  console.log('  mapIntakeFields() Extraction Analysis');
  console.log('========================================\n');

  const analysis = mapIntakeFields(simplybookData);

  const fields = [
    { name: 'School Name', extraction: analysis.extractions.schoolName, final: analysis.mappedData.schoolName, airtable: airtableRecord.fields.school_name },
    { name: 'Contact Person', extraction: analysis.extractions.contactPerson, final: analysis.mappedData.contactPerson, airtable: airtableRecord.fields.school_contact_name },
    { name: 'Contact Email', extraction: analysis.extractions.contactEmail, final: analysis.mappedData.contactEmail, airtable: airtableRecord.fields.school_contact_email },
    { name: 'Phone', extraction: analysis.extractions.phone, final: analysis.mappedData.phone, airtable: airtableRecord.fields.school_phone },
    { name: 'Address', extraction: analysis.extractions.address, final: analysis.mappedData.address, airtable: airtableRecord.fields.school_address },
    { name: 'Postal Code', extraction: analysis.extractions.postalCode, final: analysis.mappedData.postalCode, airtable: airtableRecord.fields.school_postal_code },
    { name: 'City', extraction: analysis.extractions.city, final: analysis.mappedData.city, airtable: airtableRecord.fields.city },
    { name: 'Children', extraction: analysis.extractions.children, final: analysis.mappedData.numberOfChildren, airtable: airtableRecord.fields.estimated_children },
  ];

  for (const field of fields) {
    const matchSymbol = field.extraction.matched ? '✓' : '✗';
    const matchedTitle = field.extraction.matched ? ` (matched: "${field.extraction.title}")` : '';
    const isMissing = !field.airtable || field.airtable === '' || field.airtable === 0;
    const status = isMissing ? ' ⚠️  MISSING IN AIRTABLE' : '';

    console.log(`${field.name}:`);
    console.log(`  Intake form extraction: ${matchSymbol}${matchedTitle}`);
    console.log(`  Extracted value:        "${field.extraction.value || ''}"`);
    console.log(`  Final (with fallback):  "${field.final || ''}"`);
    console.log(`  In Airtable:            "${field.airtable || ''}"${status}`);
    console.log('');
  }

  // Step 6: Provide recommendations
  console.log('========================================');
  console.log('  Recommendations');
  console.log('========================================\n');

  const missingFields = fields.filter(f =>
    (!f.airtable || f.airtable === '' || f.airtable === 0) &&
    (f.final || (f.name === 'Children' && f.final !== undefined))
  );

  const unmatchedWithData = fields.filter(f =>
    !f.extraction.matched && f.final
  );

  if (missingFields.length === 0) {
    console.log('No issues detected - all available data appears to be in Airtable.\n');
  } else {
    console.log('Issues found:\n');

    if (unmatchedWithData.length > 0) {
      console.log('Fields with data available via fallbacks but not from intake form:');
      unmatchedWithData.forEach(f => {
        console.log(`  - ${f.name}: Available in client_* fields, should be extracted`);
      });
      console.log('');
    }

    const canBackfill = missingFields.filter(f => f.final);
    if (canBackfill.length > 0) {
      console.log('Fields that can be backfilled from SimplyBook data:');
      canBackfill.forEach(f => {
        console.log(`  - ${f.name}: "${f.final}"`);
      });
      console.log('');
    }

    const missingEverywhere = missingFields.filter(f => !f.final && f.name !== 'Children');
    if (missingEverywhere.length > 0) {
      console.log('Fields missing in both SimplyBook and Airtable (intake form not completed?):');
      missingEverywhere.forEach(f => {
        console.log(`  - ${f.name}`);
      });
      console.log('');
    }
  }

  // Check if intake form field titles don't match our keywords
  console.log('========================================');
  console.log('  Unmatched Intake Form Fields');
  console.log('========================================\n');

  const matchedTitles = new Set(
    Object.values(analysis.extractions)
      .filter(e => e.matched)
      .map(e => e.title.toLowerCase())
  );

  const unmatchedFields = (Array.isArray(additionalFields) ? additionalFields : Object.values(additionalFields))
    .filter(f => f && (f.field_title || f.title))
    .filter(f => !matchedTitles.has((f.field_title || f.title).toLowerCase()));

  if (unmatchedFields.length > 0) {
    console.log('These intake form fields were NOT matched by mapIntakeFields():');
    console.log('(Consider adding these keywords to the mapping function)\n');
    unmatchedFields.forEach(field => {
      const title = field.field_title || field.title;
      const value = field.value || '';
      console.log(`  Field: "${title}"`);
      console.log(`  Value: "${value}"`);
      console.log('');
    });
  } else {
    console.log('All intake form fields were matched by the keyword search.\n');
  }

  // Output full SimplyBook response for reference
  console.log('========================================');
  console.log('  Full SimplyBook Response (for reference)');
  console.log('========================================\n');
  console.log(JSON.stringify(simplybookData, null, 2));
}

// ============================================
// Run
// ============================================

const bookingHash = process.argv[2];

if (!bookingHash) {
  console.error('Usage: node scripts/debug-simplybook-payload.js <booking_hash>');
  console.error('Example: node scripts/debug-simplybook-payload.js keh1c7525');
  process.exit(1);
}

debugSimplybookPayload(bookingHash)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Diagnostic failed:', error);
    process.exit(1);
  });
