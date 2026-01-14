#!/usr/bin/env node
/**
 * Test the orders-paid webhook locally with a sample order
 *
 * Usage: node scripts/test-orders-webhook.js [--prod]
 *   --prod: Test against production URL instead of localhost
 */

require('dotenv').config({ path: '.env.local' });

const crypto = require('crypto');

// Test data - customize as needed
const TEST_ORDER = {
  id: 123456789,
  admin_graphql_api_id: 'gid://shopify/Order/123456789',
  name: '#TEST-001',
  email: 'test@example.com',
  created_at: new Date().toISOString(),
  total_price: '49.99',
  subtotal_price: '45.00',
  total_tax: '4.99',
  currency: 'EUR',
  financial_status: 'paid',
  fulfillment_status: null,
  note_attributes: [
    { name: 'parentId', value: 'P-test-123' },
    { name: 'parentEmail', value: 'test@example.com' },
    { name: 'eventId', value: 'evt_test_school_minimusiker_20250115_abc123' },
    { name: 'classId', value: 'cls_test_school_20250115_3rdgrade_def456' },
    { name: 'schoolName', value: 'Test School' },
  ],
  line_items: [
    {
      id: 1,
      variant_id: 12345,
      title: 'MiniMusiker CD',
      variant_title: null,
      quantity: 1,
      price: '19.99',
    },
    {
      id: 2,
      variant_id: 67890,
      title: 'MiniMusiker T-Shirt',
      variant_title: 'Size 128',
      quantity: 1,
      price: '25.00',
    },
  ],
  shipping_lines: [
    { price: '0.00' }
  ],
};

async function testWebhook() {
  const isProd = process.argv.includes('--prod');
  const baseUrl = isProd
    ? process.env.NEXT_PUBLIC_APP_URL
    : 'http://localhost:3000';

  const webhookUrl = `${baseUrl}/api/webhooks/shopify/orders-paid`;
  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('❌ SHOPIFY_WEBHOOK_SECRET not found in .env.local');
    process.exit(1);
  }

  console.log('🧪 Testing orders-paid webhook');
  console.log(`   URL: ${webhookUrl}`);
  console.log(`   Order: ${TEST_ORDER.name}`);
  console.log(`   eventId: ${TEST_ORDER.note_attributes.find(a => a.name === 'eventId')?.value}`);
  console.log(`   classId: ${TEST_ORDER.note_attributes.find(a => a.name === 'classId')?.value}`);
  console.log('');

  // Create the payload
  const payload = JSON.stringify(TEST_ORDER);

  // Generate HMAC signature
  const hmac = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload, 'utf8')
    .digest('base64');

  console.log('📤 Sending webhook request...');

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Hmac-Sha256': hmac,
        'X-Shopify-Topic': 'orders/paid',
        'X-Shopify-Shop-Domain': process.env.SHOPIFY_SHOP_DOMAIN || 'test.myshopify.com',
        'X-Shopify-Event-Id': `test-${Date.now()}`,
      },
      body: payload,
    });

    console.log(`📥 Response: ${response.status} ${response.statusText}`);

    const text = await response.text();
    if (text) {
      try {
        const json = JSON.parse(text);
        console.log('   Body:', JSON.stringify(json, null, 2));
      } catch {
        console.log('   Body:', text);
      }
    }

    if (response.ok) {
      console.log('\n✅ Webhook processed successfully!');
      console.log('\nNext steps:');
      console.log('1. Check Airtable Orders table for new record');
      console.log('2. Verify event_id and class_id linked records');
      console.log('3. Check Shopify admin for tags (if prod)');
    } else {
      console.log('\n❌ Webhook returned error');
    }

  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    if (error.cause) {
      console.error('   Cause:', error.cause.message);
    }
    console.log('\nMake sure the dev server is running: npm run dev');
  }
}

testWebhook();
