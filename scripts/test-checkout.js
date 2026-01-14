#!/usr/bin/env node
/**
 * Test creating a Shopify checkout
 */

require('dotenv').config({ path: '.env.local' });

async function main() {
  const baseUrl = 'http://localhost:3000';

  const payload = {
    lineItems: [
      { variantId: 'gid://shopify/ProductVariant/53258099720538', quantity: 1 }, // Minicard
    ],
    customAttributes: {
      parentId: 'PAR-a1b2c3d4',
      parentEmail: 'test@example.com',
      eventId: 'evt_testschool_minimusiker_20250115_abc123',
      classId: 'cls_testschool_20250115_3rdgrade_def456',
      schoolName: 'Test School',
    },
  };

  console.log('Creating checkout with payload:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');

  try {
    const response = await fetch(`${baseUrl}/api/shopify/create-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    console.log(`Response status: ${response.status}`);
    console.log('Response body:');
    console.log(JSON.stringify(data, null, 2));

    if (data.checkoutUrl && !data.message?.includes('mock')) {
      console.log('\nCheckout URL:');
      console.log(data.checkoutUrl);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
