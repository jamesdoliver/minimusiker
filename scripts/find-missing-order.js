#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const Airtable = require('airtable');

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

const ORDERS_TABLE_ID = 'tblu9AGaLSoEVwqq7';

async function findMissing() {
  console.log('=== SEARCHING FOR MISSING ORDER ===\n');

  const orders = await base(ORDERS_TABLE_ID).select().all();

  console.log('Total orders in database:', orders.length, '\n');

  // Show orders without booking_id or with unusual booking_ids
  console.log('=== ORDERS WITHOUT BOOKING_ID ===\n');
  const noBookingId = orders.filter(o => !o.fields.booking_id);
  for (const o of noBookingId) {
    console.log(o.fields.order_number + ':', 'school_name=' + (o.fields.school_name || '(empty)'));
  }

  console.log('\n=== ORDERS WITH UNUSUAL BOOKING_ID (not evt_ format) ===\n');
  const unusualBookingId = orders.filter(o => {
    const bid = o.fields.booking_id || '';
    return bid && !bid.startsWith('evt_');
  });
  for (const o of unusualBookingId) {
    console.log(o.fields.order_number + ':', o.fields.booking_id, '| school:', o.fields.school_name || '(empty)');
  }

  // Check for any order with date around 2026-02-05 that might be Ruhr
  console.log('\n=== ALL ORDERS SORTED BY NUMBER ===\n');
  const sorted = [...orders].sort((a, b) => {
    const numA = parseInt((a.fields.order_number || '').replace('#', '')) || 0;
    const numB = parseInt((b.fields.order_number || '').replace('#', '')) || 0;
    return numA - numB;
  });

  for (const o of sorted) {
    const num = o.fields.order_number || '?';
    const school = o.fields.school_name || '(no school)';
    const bid = o.fields.booking_id || '(no booking_id)';
    const hasLink = o.fields.event_id && o.fields.event_id.length > 0;

    // Truncate for display
    const bidShort = bid.length > 50 ? bid.substring(0, 47) + '...' : bid;
    console.log(num.padEnd(8) + school.substring(0, 30).padEnd(32) + (hasLink ? '✓' : '✗') + ' ' + bidShort);
  }
}

findMissing().catch(console.error);
