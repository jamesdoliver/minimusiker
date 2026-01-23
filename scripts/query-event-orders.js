#!/usr/bin/env node
/**
 * Query Airtable Orders for a specific event
 *
 * Usage: node scripts/query-event-orders.js [event_id]
 * Default event: evt_schule_an_der_ruhr_minimusiker_20260205_33c3a0
 */

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const ORDERS_TABLE_ID = 'tblu9AGaLSoEVwqq7';
const DEFAULT_EVENT_ID = 'evt_schule_an_der_ruhr_minimusiker_20260205_33c3a0';

async function queryEventOrders(eventId) {
  console.log('=== EVENT ORDERS REPORT ===\n');
  console.log(`Event ID: ${eventId}\n`);

  // Query orders by booking_id (using field ID in formula)
  const orders = await base(ORDERS_TABLE_ID)
    .select({
      filterByFormula: `{booking_id} = "${eventId}"`,
    })
    .all();

  if (orders.length === 0) {
    console.log('No orders found for this event.');
    return;
  }

  console.log(`Total Orders: ${orders.length}\n`);

  // Aggregate quantities by product/variant
  const itemSummary = new Map();
  let totalRevenue = 0;

  for (const order of orders) {
    const orderNumber = order.fields.order_number;
    const orderDate = order.fields.order_date;
    const totalAmount = order.fields.total_amount || 0;
    const lineItemsJson = order.fields.line_items;

    console.log(`--- Order ${orderNumber} ---`);
    console.log(`  Date: ${new Date(orderDate).toLocaleDateString('de-DE')}`);
    console.log(`  Total: €${totalAmount}`);

    totalRevenue += Number(totalAmount);

    if (!lineItemsJson) {
      console.log('  (No line items)\n');
      continue;
    }

    let lineItems;
    try {
      lineItems = JSON.parse(lineItemsJson);
    } catch (e) {
      console.log(`  (Error parsing line items: ${e.message})\n`);
      continue;
    }

    console.log('  Items:');
    for (const item of lineItems) {
      const key = item.variant_title
        ? `${item.product_title} - ${item.variant_title}`
        : item.product_title;

      console.log(`    - ${item.quantity}x ${key} @ €${item.price}`);

      // Aggregate
      const current = itemSummary.get(key) || { quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += item.total || (item.quantity * item.price);
      itemSummary.set(key, current);
    }
    console.log('');
  }

  // Print summary
  console.log('=== SUMMARY ===\n');
  console.log(`Total Orders: ${orders.length}`);
  console.log(`Total Revenue: €${totalRevenue.toFixed(2)}\n`);

  console.log('Items Breakdown:');
  console.log('-'.repeat(60));

  // Sort by quantity descending
  const sortedItems = [...itemSummary.entries()].sort((a, b) => b[1].quantity - a[1].quantity);

  let totalQuantity = 0;
  for (const [name, data] of sortedItems) {
    console.log(`  ${data.quantity.toString().padStart(3)}x  ${name}`);
    console.log(`        Revenue: €${data.revenue.toFixed(2)}`);
    totalQuantity += data.quantity;
  }

  console.log('-'.repeat(60));
  console.log(`Total Items: ${totalQuantity}`);
  console.log(`Total Revenue: €${totalRevenue.toFixed(2)}`);
  console.log('\n=== END REPORT ===');
}

const eventId = process.argv[2] || DEFAULT_EVENT_ID;
queryEventOrders(eventId).catch(console.error);
