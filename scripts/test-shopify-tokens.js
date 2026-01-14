#!/usr/bin/env node
/**
 * Test Shopify token configuration
 * Verifies which tokens work with which APIs
 */

require('dotenv').config({ path: '.env.local' });

const storeDomain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
const storefrontToken = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN;
const publicAccessToken = process.env.NEXT_PUBLIC_ACCESS_TOKEN;
const clientId = process.env.SHOPIFY_CLIENT_ID;
const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

console.log('Shopify Configuration:');
console.log('======================');
console.log(`Store Domain: ${storeDomain}`);
console.log(`STOREFRONT_ACCESS_TOKEN: ${storefrontToken?.substring(0, 10)}...`);
console.log(`PUBLIC_ACCESS_TOKEN: ${publicAccessToken?.substring(0, 10)}...`);
console.log(`CLIENT_ID: ${clientId?.substring(0, 10)}...`);
console.log(`CLIENT_SECRET: ${clientSecret?.substring(0, 10)}...`);
console.log('');

async function testStorefrontQuery(token, tokenName) {
  console.log(`\nTesting ${tokenName}...`);

  const query = `
    query {
      shop {
        name
      }
    }
  `;

  try {
    const response = await fetch(
      `https://${storeDomain}/api/2025-01/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Shopify-Storefront-Private-Token': token,
        },
        body: JSON.stringify({ query }),
      }
    );

    const json = await response.json();

    if (json.errors) {
      console.log(`  ❌ Failed: ${json.errors[0]?.message}`);
      return false;
    }

    if (json.data?.shop?.name) {
      console.log(`  ✅ Success! Shop name: ${json.data.shop.name}`);
      return true;
    }

    console.log(`  ❌ Unexpected response:`, JSON.stringify(json));
    return false;
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return false;
  }
}

async function testPublicAccessToken(token, tokenName) {
  console.log(`\nTesting ${tokenName} with X-Shopify-Storefront-Access-Token header...`);

  const query = `
    query {
      shop {
        name
      }
    }
  `;

  try {
    const response = await fetch(
      `https://${storeDomain}/api/2025-01/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': token,
        },
        body: JSON.stringify({ query }),
      }
    );

    const json = await response.json();

    if (json.errors) {
      console.log(`  ❌ Failed: ${json.errors[0]?.message}`);
      return false;
    }

    if (json.data?.shop?.name) {
      console.log(`  ✅ Success! Shop name: ${json.data.shop.name}`);
      return true;
    }

    console.log(`  ❌ Unexpected response:`, JSON.stringify(json));
    return false;
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  // Test with Private Token header (for private apps)
  if (storefrontToken) {
    await testStorefrontQuery(storefrontToken, 'STOREFRONT_ACCESS_TOKEN (Private header)');
  }

  if (publicAccessToken) {
    await testStorefrontQuery(publicAccessToken, 'PUBLIC_ACCESS_TOKEN (Private header)');
  }

  // Test with Public Token header (for public access)
  if (storefrontToken) {
    await testPublicAccessToken(storefrontToken, 'STOREFRONT_ACCESS_TOKEN (Public header)');
  }

  if (publicAccessToken) {
    await testPublicAccessToken(publicAccessToken, 'PUBLIC_ACCESS_TOKEN (Public header)');
  }

  console.log('\n');
  console.log('Token format analysis:');
  console.log('======================');
  if (storefrontToken?.startsWith('shpat_')) {
    console.log('⚠️  STOREFRONT_ACCESS_TOKEN has "shpat_" prefix - this is typically an Admin API token!');
    console.log('   Storefront tokens usually don\'t have a prefix or start with a different pattern.');
  }
  if (publicAccessToken && !publicAccessToken.startsWith('shp')) {
    console.log('✅  PUBLIC_ACCESS_TOKEN looks like a Storefront access token (no shp* prefix)');
  }
}

main();
