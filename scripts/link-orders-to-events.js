#!/usr/bin/env node
/**
 * Link Orders to Events by booking_id
 * Finds orders without event_id linked record and links them to the correct Event
 */

require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const ORDERS_TABLE_ID = 'tblu9AGaLSoEVwqq7';
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';

async function linkOrders(applyChanges = false) {
  console.log('=== LINK ORDERS TO EVENTS ===\n');
  console.log(`Mode: ${applyChanges ? 'APPLY CHANGES' : 'DRY RUN'}\n`);

  // Fetch all events and build lookup by event_id (field name, not ID)
  console.log('Fetching Events...');
  const allEvents = await base(EVENTS_TABLE_ID).select().all();
  const eventsByEventId = new Map();
  for (const event of allEvents) {
    const eventId = event.fields.event_id;  // field name
    if (eventId) {
      eventsByEventId.set(eventId, event.id);  // map event_id string -> Airtable record ID
    }
  }
  console.log(`Found ${eventsByEventId.size} Events\n`);

  // Fetch all orders
  console.log('Fetching Orders...');
  const allOrders = await base(ORDERS_TABLE_ID).select().all();
  console.log(`Found ${allOrders.length} Orders\n`);

  // Find orders without event_id linked record
  const ordersToLink = [];
  for (const order of allOrders) {
    const bookingId = order.fields.booking_id;
    const eventIdLink = order.fields.event_id;  // This is the linked record field (array)
    const hasLink = eventIdLink && eventIdLink.length > 0;

    if (!hasLink && bookingId) {
      const eventRecordId = eventsByEventId.get(bookingId);
      if (eventRecordId) {
        ordersToLink.push({
          recordId: order.id,
          orderNumber: order.fields.order_number,
          bookingId,
          eventRecordId,
        });
      }
    }
  }

  if (ordersToLink.length === 0) {
    console.log('No orders need linking. All orders with booking_id have event links.');
    return;
  }

  console.log(`Orders to link: ${ordersToLink.length}\n`);
  for (const order of ordersToLink) {
    console.log(`  ${order.orderNumber}: ${order.bookingId} → ${order.eventRecordId}`);
  }
  console.log('');

  if (!applyChanges) {
    console.log('=== DRY RUN COMPLETE ===');
    console.log('Run with --apply to actually link the records:');
    console.log('  node scripts/link-orders-to-events.js --apply\n');
    return;
  }

  // Apply changes
  console.log('=== APPLYING CHANGES ===\n');
  let successCount = 0;
  let errorCount = 0;

  for (const order of ordersToLink) {
    try {
      await base(ORDERS_TABLE_ID).update(order.recordId, {
        event_id: [order.eventRecordId],  // field name for linked record
      });
      console.log(`✓ Linked ${order.orderNumber} → ${order.eventRecordId}`);
      successCount++;
    } catch (error) {
      console.error(`✗ Failed to link ${order.orderNumber}: ${error.message}`);
      errorCount++;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  console.log('\n=== LINKING COMPLETE ===');
  console.log(`Successfully linked: ${successCount}`);
  console.log(`Failed: ${errorCount}`);
}

const applyChanges = process.argv.includes('--apply');
linkOrders(applyChanges).catch(console.error);
