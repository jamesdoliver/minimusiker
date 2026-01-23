#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const ORDERS_TABLE_ID = 'tblu9AGaLSoEVwqq7';
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';

async function findUnaccounted() {
  console.log('=== SEARCHING FOR UNACCOUNTED ORDERS ===\n');

  // Fetch all orders and events
  const [orders, events] = await Promise.all([
    base(ORDERS_TABLE_ID).select().all(),
    base(EVENTS_TABLE_ID).select().all(),
  ]);

  // Build event lookup
  const eventById = new Map();
  for (const e of events) {
    eventById.set(e.id, {
      event_id: e.fields.event_id,
      school_name: e.fields.school_name,
      event_date: e.fields.event_date,
    });
  }

  // Search terms for "Schule an der Ruhr" variations
  const searchTerms = ['ruhr', 'schule an der'];

  console.log('Looking for orders with school_name containing:', searchTerms.join(' OR '), '\n');

  const matchingOrders = [];
  const allRuhrOrders = [];

  for (const order of orders) {
    const schoolName = (order.fields.school_name || '').toLowerCase();
    const bookingId = order.fields.booking_id || '';
    const eventIdLinks = order.fields.event_id || [];
    const orderNumber = order.fields.order_number;

    // Check if school_name matches any search term
    const matchesSchoolName = searchTerms.some(term => schoolName.includes(term));

    // Check if booking_id contains ruhr
    const matchesBookingId = bookingId.toLowerCase().includes('ruhr');

    if (matchesSchoolName || matchesBookingId) {
      // Get linked event details
      let linkedEventInfo = 'NOT LINKED';
      if (eventIdLinks.length > 0) {
        const eventInfo = eventById.get(eventIdLinks[0]);
        if (eventInfo) {
          linkedEventInfo = eventInfo.event_id + ' (' + eventInfo.school_name + ')';
        } else {
          linkedEventInfo = 'LINKED to unknown event: ' + eventIdLinks[0];
        }
      }

      allRuhrOrders.push({
        orderNumber,
        schoolName: order.fields.school_name,
        bookingId,
        linkedEvent: linkedEventInfo,
        hasLink: eventIdLinks.length > 0,
        matchedBy: matchesSchoolName ? 'school_name' : 'booking_id',
      });
    }
  }

  // Sort by order number
  allRuhrOrders.sort((a, b) => {
    const numA = parseInt((a.orderNumber || '').replace('#', '')) || 0;
    const numB = parseInt((b.orderNumber || '').replace('#', '')) || 0;
    return numA - numB;
  });

  console.log('Found', allRuhrOrders.length, 'orders related to "Ruhr"\n');
  console.log('-------------------------------------------------------------------');

  for (const o of allRuhrOrders) {
    console.log('Order:', o.orderNumber);
    console.log('  School Name:', o.schoolName || '(empty)');
    console.log('  Booking ID:', o.bookingId || '(empty)');
    console.log('  Linked Event:', o.linkedEvent);
    console.log('  Matched by:', o.matchedBy);
    console.log('');
  }

  // Summary
  const linked = allRuhrOrders.filter(o => o.hasLink).length;
  const unlinked = allRuhrOrders.filter(o => !o.hasLink).length;

  console.log('-------------------------------------------------------------------');
  console.log('SUMMARY:');
  console.log('  Total orders found:', allRuhrOrders.length);
  console.log('  Linked to event:', linked);
  console.log('  NOT linked:', unlinked);

  // Show any outliers (orders with mismatched school_name vs booking_id)
  console.log('\n=== POTENTIAL OUTLIERS ===\n');

  for (const o of allRuhrOrders) {
    const bookingIdHasRuhr = (o.bookingId || '').toLowerCase().includes('ruhr');
    const schoolNameHasRuhr = (o.schoolName || '').toLowerCase().includes('ruhr');

    if (bookingIdHasRuhr !== schoolNameHasRuhr) {
      console.log('MISMATCH:', o.orderNumber);
      console.log('  School Name:', o.schoolName || '(empty)');
      console.log('  Booking ID:', o.bookingId || '(empty)');
      console.log('');
    }
  }

  // Also show orders NOT linked
  if (unlinked > 0) {
    console.log('=== ORDERS NOT LINKED TO EVENT ===\n');
    for (const o of allRuhrOrders.filter(x => !x.hasLink)) {
      console.log(o.orderNumber + ':', o.schoolName, '|', o.bookingId);
    }
  }
}

findUnaccounted().catch(console.error);
