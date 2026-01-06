/**
 * Test Shopify Connection
 *
 * Tests both the Client Credentials Grant (Admin API) and Storefront API connections.
 *
 * Usage: node scripts/test-shopify-connection.js
 */

require('dotenv').config({ path: '.env.local' });

async function testClientCredentials() {
  console.log('\n=== Testing Client Credentials Grant (Admin API) ===\n');

  // Support both naming conventions
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_SECRET;

  console.log('Configuration:');
  console.log(`  Store Domain: ${storeDomain || 'NOT SET'}`);
  console.log(`  Client ID: ${clientId ? clientId.substring(0, 10) + '...' : 'NOT SET'}`);
  console.log(`  Client Secret: ${clientSecret ? '***' + clientSecret.slice(-4) : 'NOT SET'}`);

  if (!storeDomain || !clientId || !clientSecret) {
    console.error('\n❌ Missing required credentials. Please check your .env.local file.');
    return false;
  }

  try {
    // Step 1: Get access token
    console.log('\n1. Requesting access token...');

    const tokenUrl = `https://${storeDomain}/admin/oauth/access_token`;
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`\n❌ Token request failed: ${tokenResponse.status} ${tokenResponse.statusText}`);
      console.error('Response:', errorText);
      return false;
    }

    const tokenData = await tokenResponse.json();
    console.log('   ✅ Access token obtained!');
    console.log(`   Token expires in: ${tokenData.expires_in} seconds (${Math.round(tokenData.expires_in / 3600)} hours)`);
    console.log(`   Scopes: ${tokenData.scope || 'not specified'}`);

    // Step 2: Test Admin API with the token
    console.log('\n2. Testing Admin API connection...');

    const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-01';
    const adminUrl = `https://${storeDomain}/admin/api/${apiVersion}/graphql.json`;

    const shopQuery = `
      query {
        shop {
          name
          email
          primaryDomain {
            url
          }
          plan {
            displayName
          }
        }
      }
    `;

    const adminResponse = await fetch(adminUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': tokenData.access_token,
      },
      body: JSON.stringify({ query: shopQuery }),
    });

    if (!adminResponse.ok) {
      const errorText = await adminResponse.text();
      console.error(`\n❌ Admin API request failed: ${adminResponse.status}`);
      console.error('Response:', errorText);
      return false;
    }

    const adminData = await adminResponse.json();

    if (adminData.errors) {
      console.error('\n❌ GraphQL errors:', adminData.errors);
      return false;
    }

    console.log('   ✅ Admin API connected successfully!');
    console.log(`\n   Shop Info:`);
    console.log(`     Name: ${adminData.data.shop.name}`);
    console.log(`     Email: ${adminData.data.shop.email}`);
    console.log(`     Domain: ${adminData.data.shop.primaryDomain?.url || 'N/A'}`);
    console.log(`     Plan: ${adminData.data.shop.plan?.displayName || 'N/A'}`);

    // Step 3: Test orders query
    console.log('\n3. Testing orders query...');

    const ordersQuery = `
      query {
        orders(first: 5) {
          edges {
            node {
              id
              name
              createdAt
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    `;

    const ordersResponse = await fetch(adminUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': tokenData.access_token,
      },
      body: JSON.stringify({ query: ordersQuery }),
    });

    const ordersData = await ordersResponse.json();

    if (ordersData.errors) {
      console.error('   ⚠️ Orders query failed (may need read_orders scope):', ordersData.errors[0]?.message);
    } else {
      const orderCount = ordersData.data.orders.edges.length;
      console.log(`   ✅ Orders query successful! Found ${orderCount} recent orders.`);

      if (orderCount > 0) {
        console.log('\n   Recent Orders:');
        for (const { node: order } of ordersData.data.orders.edges) {
          console.log(`     ${order.name}: ${order.totalPriceSet.shopMoney.amount} ${order.totalPriceSet.shopMoney.currencyCode}`);
        }
      }
    }

    return true;
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    return false;
  }
}

async function testStorefrontAPI() {
  console.log('\n\n=== Testing Storefront API ===\n');

  const storeDomain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_STORE_DOMAIN;
  // Support both naming conventions
  const storefrontToken = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN || process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;

  console.log('Configuration:');
  console.log(`  Store Domain: ${storeDomain || 'NOT SET'}`);
  console.log(`  Storefront Token: ${storefrontToken ? storefrontToken.substring(0, 10) + '...' : 'NOT SET'}`);

  if (!storeDomain || !storefrontToken) {
    console.error('\n❌ Missing Storefront API credentials. Skipping...');
    return false;
  }

  try {
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-01';
    const storefrontUrl = `https://${storeDomain}/api/${apiVersion}/graphql.json`;

    const productsQuery = `
      query {
        products(first: 5) {
          edges {
            node {
              id
              title
              availableForSale
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(storefrontUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': storefrontToken,
      },
      body: JSON.stringify({ query: productsQuery }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`\n❌ Storefront API request failed: ${response.status}`);
      console.error('Response:', errorText);
      return false;
    }

    const data = await response.json();

    if (data.errors) {
      console.error('\n❌ GraphQL errors:', data.errors);
      return false;
    }

    const productCount = data.data.products.edges.length;
    console.log(`✅ Storefront API connected! Found ${productCount} products.`);

    if (productCount > 0) {
      console.log('\nProducts:');
      for (const { node: product } of data.data.products.edges) {
        const price = product.priceRange.minVariantPrice;
        console.log(`  - ${product.title}: ${price.amount} ${price.currencyCode} (${product.availableForSale ? 'Available' : 'Unavailable'})`);
      }
    }

    return true;
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          MiniMusiker Shopify Connection Test               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const adminSuccess = await testClientCredentials();
  const storefrontSuccess = await testStorefrontAPI();

  console.log('\n\n=== Summary ===\n');
  console.log(`Admin API (Client Credentials): ${adminSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Storefront API:                 ${storefrontSuccess ? '✅ PASS' : '❌ FAIL'}`);

  if (adminSuccess && storefrontSuccess) {
    console.log('\n🎉 All connections successful! Your Shopify integration is ready.\n');
  } else if (adminSuccess) {
    console.log('\n⚠️ Admin API works, but Storefront API needs attention.\n');
  } else if (storefrontSuccess) {
    console.log('\n⚠️ Storefront API works, but Admin API (Client Credentials) needs attention.\n');
  } else {
    console.log('\n❌ Both connections failed. Please check your credentials.\n');
  }

  process.exit(adminSuccess && storefrontSuccess ? 0 : 1);
}

main();
