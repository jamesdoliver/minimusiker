#!/usr/bin/env node
/**
 * Verify if orders have event_id linked record populated
 * This checks if malformed booking_id orders are missing the linked record
 */

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const ORDERS_TABLE_ID = 'tblu9AGaLSoEVwqq7';
const ORDERS_FIELD_IDS = {
  booking_id: 'fldF4eBUFu5NcRYjd',
  event_id: 'fldxJwmQCsx533oe0',  // Linked record to Events
  order_number: 'fldKVJtsO24WemkgA',
};

const MALFORMED_PATTERN = /^evt_(.+)__(\d{8})_([a-f0-9]{6})$/;

async function verify() {
  console.log('=== VERIFY ORDER EVENT LINKS ===\n');

  const allOrders = await base(ORDERS_TABLE_ID)
    .select({ returnFieldsByFieldId: true })
    .all();

  let malformedWithLink = 0;
  let malformedWithoutLink = 0;
  let correctWithLink = 0;
  let correctWithoutLink = 0;

  const ordersWithoutLink = [];

  for (const order of allOrders) {
    const bookingId = order.get(ORDERS_FIELD_IDS.booking_id);
    const eventIdLink = order.get(ORDERS_FIELD_IDS.event_id);  // Array of linked record IDs
    const orderNumber = order.get(ORDERS_FIELD_IDS.order_number);
    const hasLink = eventIdLink && eventIdLink.length > 0;
    const isMalformed = bookingId && MALFORMED_PATTERN.test(bookingId);

    if (isMalformed) {
      if (hasLink) malformedWithLink++;
      else {
        malformedWithoutLink++;
        ordersWithoutLink.push({ orderNumber, bookingId, type: 'malformed' });
      }
    } else {
      if (hasLink) correctWithLink++;
      else {
        correctWithoutLink++;
        ordersWithoutLink.push({ orderNumber, bookingId, type: 'correct' });
      }
    }
  }

  console.log('Summary:');
  console.log(`  Malformed booking_id WITH event link: ${malformedWithLink}`);
  console.log(`  Malformed booking_id WITHOUT event link: ${malformedWithoutLink} ← PROBLEM`);
  console.log(`  Correct booking_id WITH event link: ${correctWithLink}`);
  console.log(`  Correct booking_id WITHOUT event link: ${correctWithoutLink}`);
  console.log('');

  if (ordersWithoutLink.length > 0) {
    console.log('Orders missing event_id linked record:');
    for (const order of ordersWithoutLink) {
      console.log(`  ${order.orderNumber}: ${order.bookingId || '(no booking_id)'} [${order.type}]`);
    }
  }
}

verify().catch(console.error);
