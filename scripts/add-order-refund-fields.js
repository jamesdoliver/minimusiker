/**
 * Script to add refund tracking fields to Orders table in Airtable
 * Run with: node scripts/add-order-refund-fields.js
 *
 * Creates:
 * - refund_amount (Number, currency EUR, precision 2)
 * - cancel_reason (Single Line Text)
 * - Adds 'partially_refunded' option to existing payment_status field
 */

require('dotenv').config({ path: '.env.local' });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

const ORDERS_TABLE_ID = 'tblu9AGaLSoEVwqq7';
const PAYMENT_STATUS_FIELD_ID = 'fld1zfZ9ouEPJv8ju';

async function createField(tableId, fieldName, fieldType, description, options = {}) {
  const url = `https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE_ID}/tables/${tableId}/fields`;

  const body = {
    name: fieldName,
    type: fieldType,
    description: description,
  };

  if (Object.keys(options).length > 0) {
    body.options = options;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create field ${fieldName}: ${JSON.stringify(error)}`);
  }

  return response.json();
}

async function addSelectOption(tableId, fieldId, optionName) {
  // Add a new select option by writing it to a record with typecast,
  // then restoring the original value
  const Airtable = require('airtable');
  const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

  const records = await base(tableId).select({ maxRecords: 1 }).firstPage();
  if (records.length === 0) {
    throw new Error('No records found to use for adding select option');
  }

  const recordId = records[0].id;
  const currentValue = records[0].fields[fieldId];

  // Set to new value with typecast to auto-create the option
  await base(tableId).update([{
    id: recordId,
    fields: { [fieldId]: optionName },
  }], { typecast: true });

  // Restore original value
  if (currentValue) {
    await base(tableId).update([{
      id: recordId,
      fields: { [fieldId]: currentValue },
    }]);
  }
}

async function main() {
  if (!AIRTABLE_API_KEY) {
    console.error('Error: AIRTABLE_API_KEY not found in environment');
    process.exit(1);
  }

  if (!AIRTABLE_BASE_ID) {
    console.error('Error: AIRTABLE_BASE_ID not found in environment');
    process.exit(1);
  }

  console.log('Creating Airtable fields for Order Refund tracking...\n');

  try {
    // 1. Create refund_amount field
    console.log('1. Creating "refund_amount" field in Orders table...');
    const refundAmountResult = await createField(
      ORDERS_TABLE_ID,
      'refund_amount',
      'number',
      'Amount refunded (EUR). For partial refunds, this is less than total_amount. Net revenue = total_amount - refund_amount.',
      { precision: 2 }
    );
    console.log(`   ✓ Created! Field ID: ${refundAmountResult.id}`);

    // 2. Create cancel_reason field
    console.log('2. Creating "cancel_reason" field in Orders table...');
    const cancelReasonResult = await createField(
      ORDERS_TABLE_ID,
      'cancel_reason',
      'singleLineText',
      'Shopify cancel reason: customer, fraud, inventory, declined, other'
    );
    console.log(`   ✓ Created! Field ID: ${cancelReasonResult.id}`);

    // 3. Add 'partially_refunded' option to existing payment_status field
    console.log('3. Adding "partially_refunded" option to payment_status field...');
    await addSelectOption(ORDERS_TABLE_ID, PAYMENT_STATUS_FIELD_ID, 'partially_refunded');
    console.log(`   ✓ Updated! payment_status now includes "partially_refunded"`);

    console.log('\n========================================');
    console.log('SUCCESS! Fields created. Now update the code:');
    console.log('========================================\n');

    console.log('In src/lib/types/airtable.ts, add to ORDERS_FIELD_IDS:');
    console.log(`  refund_amount: '${refundAmountResult.id}',`);
    console.log(`  cancel_reason: '${cancelReasonResult.id}',`);

  } catch (error) {
    console.error('\nError:', error.message);

    if (error.message.includes('FIELD_NAME_ALREADY_EXISTS')) {
      console.log('\nThe field already exists. You may need to look up the existing field ID in Airtable.');
    }

    process.exit(1);
  }
}

main();
