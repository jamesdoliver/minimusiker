#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const ORDERS_TABLE_ID = 'tblu9AGaLSoEVwqq7';

async function check() {
  const orders = await base(ORDERS_TABLE_ID).select().all();

  // Find all orders with booking_id containing "schule_an_der_ruhr"
  const ruhrOrders = orders.filter(o =>
    o.fields.booking_id && o.fields.booking_id.includes('schule_an_der_ruhr')
  );

  console.log('=== ALL ORDERS WITH "schule_an_der_ruhr" IN booking_id ===\n');
  console.log('Total:', ruhrOrders.length, '\n');

  let linkedCount = 0;
  let unlinkedCount = 0;

  for (const o of ruhrOrders) {
    const hasLink = o.fields.event_id && o.fields.event_id.length > 0;
    if (hasLink) linkedCount++;
    else unlinkedCount++;
    console.log(o.fields.order_number + ': ' + o.fields.booking_id + ' [' + (hasLink ? 'LINKED' : 'NOT LINKED') + ']');
  }

  console.log('\nLinked:', linkedCount);
  console.log('Not linked:', unlinkedCount);
}

check().catch(console.error);
