/**
 * Generate Shopify Storefront Access Token
 *
 * Uses the Admin API (via Client Credentials) to create a Storefront Access Token.
 * Run this once, then add the generated token to your .env.local file.
 *
 * Usage: node scripts/generate-storefront-token.js
 */

require('dotenv').config({ path: '.env.local' });

async function generateStorefrontToken() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║      Generate Shopify Storefront Access Token              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

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
    process.exit(1);
  }

  try {
    // Step 1: Get Admin API access token via Client Credentials Grant
    console.log('\n1. Getting Admin API access token...');

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
      process.exit(1);
    }

    const tokenData = await tokenResponse.json();
    console.log('   ✅ Admin API token obtained!');

    // Step 2: Create Storefront Access Token via Admin API
    console.log('\n2. Creating Storefront Access Token...');

    const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-01';
    const adminUrl = `https://${storeDomain}/admin/api/${apiVersion}/graphql.json`;

    const mutation = `
      mutation StorefrontAccessTokenCreate($input: StorefrontAccessTokenInput!) {
        storefrontAccessTokenCreate(input: $input) {
          storefrontAccessToken {
            accessToken
            title
            accessScopes {
              handle
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await fetch(adminUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': tokenData.access_token,
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: {
            title: 'MiniMusiker Storefront Token',
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`\n❌ GraphQL request failed: ${response.status}`);
      console.error('Response:', errorText);
      process.exit(1);
    }

    const data = await response.json();

    if (data.errors) {
      console.error('\n❌ GraphQL errors:', JSON.stringify(data.errors, null, 2));
      process.exit(1);
    }

    const result = data.data.storefrontAccessTokenCreate;

    if (result.userErrors && result.userErrors.length > 0) {
      console.error('\n❌ User errors:', JSON.stringify(result.userErrors, null, 2));
      process.exit(1);
    }

    const storefrontToken = result.storefrontAccessToken;

    console.log('   ✅ Storefront Access Token created!\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  YOUR STOREFRONT ACCESS TOKEN:');
    console.log(`  ${storefrontToken.accessToken}`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`\n  Title: ${storefrontToken.title}`);
    console.log(`  Scopes: ${storefrontToken.accessScopes?.map(s => s.handle).join(', ') || 'Default'}`);

    console.log('\n📝 Add this to your .env.local file:\n');
    console.log(`NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN=${storeDomain}`);
    console.log(`NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN=${storefrontToken.accessToken}`);
    console.log('');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

generateStorefrontToken();
