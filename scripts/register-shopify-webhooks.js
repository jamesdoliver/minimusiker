/**
 * Register Shopify Webhooks
 *
 * Registers webhook subscriptions for order events using the Admin API.
 * Run this once during setup, or after changing webhook endpoints.
 *
 * Usage: node scripts/register-shopify-webhooks.js
 *
 * Options:
 *   --list     List existing webhooks
 *   --delete   Delete all existing webhooks before registering
 */

require('dotenv').config({ path: '.env.local' });

const WEBHOOK_TOPICS = [
  { topic: 'ORDERS_CREATE', path: '/api/webhooks/shopify/orders-create' },
  { topic: 'ORDERS_PAID', path: '/api/webhooks/shopify/orders-paid' },
  { topic: 'ORDERS_FULFILLED', path: '/api/webhooks/shopify/orders-fulfilled' },
  { topic: 'ORDERS_CANCELLED', path: '/api/webhooks/shopify/orders-cancelled' },
  { topic: 'ORDERS_UPDATED', path: '/api/webhooks/shopify/orders-updated' },
];

async function getAccessToken() {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_SECRET;

  const tokenUrl = `https://${storeDomain}/admin/oauth/access_token`;
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function graphqlQuery(token, query, variables = {}) {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-01';
  const url = `https://${storeDomain}/admin/api/${apiVersion}/graphql.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GraphQL request failed: ${response.status} - ${text}`);
  }

  return response.json();
}

async function listWebhooks(token) {
  console.log('\n=== Existing Webhooks ===\n');

  const query = `
    query {
      webhookSubscriptions(first: 50) {
        edges {
          node {
            id
            topic
            endpoint {
              ... on WebhookHttpEndpoint {
                callbackUrl
              }
            }
            format
            createdAt
          }
        }
      }
    }
  `;

  const result = await graphqlQuery(token, query);

  if (result.errors) {
    console.error('Error fetching webhooks:', result.errors);
    return [];
  }

  const webhooks = result.data.webhookSubscriptions.edges;

  if (webhooks.length === 0) {
    console.log('No webhooks registered.');
    return [];
  }

  for (const { node } of webhooks) {
    console.log(`  ${node.topic}`);
    console.log(`    ID: ${node.id}`);
    console.log(`    URL: ${node.endpoint?.callbackUrl || 'N/A'}`);
    console.log(`    Created: ${node.createdAt}`);
    console.log('');
  }

  return webhooks.map(w => w.node);
}

async function deleteWebhook(token, webhookId) {
  const mutation = `
    mutation webhookSubscriptionDelete($id: ID!) {
      webhookSubscriptionDelete(id: $id) {
        userErrors {
          field
          message
        }
        deletedWebhookSubscriptionId
      }
    }
  `;

  const result = await graphqlQuery(token, mutation, { id: webhookId });

  if (result.data?.webhookSubscriptionDelete?.userErrors?.length > 0) {
    console.error('  Error:', result.data.webhookSubscriptionDelete.userErrors);
    return false;
  }

  return true;
}

async function registerWebhook(token, topic, callbackUrl) {
  const mutation = `
    mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
        webhookSubscription {
          id
          topic
          endpoint {
            ... on WebhookHttpEndpoint {
              callbackUrl
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    topic,
    webhookSubscription: {
      callbackUrl,
      format: 'JSON',
    },
  };

  const result = await graphqlQuery(token, mutation, variables);

  if (result.errors) {
    console.error(`  GraphQL Error:`, result.errors);
    return null;
  }

  const { webhookSubscription, userErrors } = result.data.webhookSubscriptionCreate;

  if (userErrors && userErrors.length > 0) {
    console.error(`  User Errors:`, userErrors);
    return null;
  }

  return webhookSubscription;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           Register Shopify Webhooks                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const args = process.argv.slice(2);
  const listOnly = args.includes('--list');
  const deleteFirst = args.includes('--delete');

  // Get app URL for webhook callbacks
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl && !listOnly) {
    console.error('❌ NEXT_PUBLIC_APP_URL not set. This is required for webhook callbacks.');
    console.error('   Set it to your production URL (e.g., https://minimusiker.de)');
    process.exit(1);
  }

  console.log(`App URL: ${appUrl || 'N/A'}`);
  console.log('');

  try {
    // Get access token
    console.log('Getting access token...');
    const token = await getAccessToken();
    console.log('✅ Token obtained\n');

    // List existing webhooks
    const existingWebhooks = await listWebhooks(token);

    if (listOnly) {
      process.exit(0);
    }

    // Delete existing webhooks if requested
    if (deleteFirst && existingWebhooks.length > 0) {
      console.log('\n=== Deleting Existing Webhooks ===\n');
      for (const webhook of existingWebhooks) {
        process.stdout.write(`  Deleting ${webhook.topic}... `);
        const success = await deleteWebhook(token, webhook.id);
        console.log(success ? '✅' : '❌');
      }
      console.log('');
    }

    // Register webhooks
    console.log('\n=== Registering Webhooks ===\n');

    let successCount = 0;
    let skipCount = 0;

    for (const { topic, path } of WEBHOOK_TOPICS) {
      const callbackUrl = `${appUrl}${path}`;

      // Check if already registered
      const existing = existingWebhooks.find(
        w => w.topic === topic && w.endpoint?.callbackUrl === callbackUrl
      );

      if (existing && !deleteFirst) {
        console.log(`  ${topic}: Already registered (skipping)`);
        skipCount++;
        continue;
      }

      process.stdout.write(`  ${topic}: Registering... `);

      const result = await registerWebhook(token, topic, callbackUrl);

      if (result) {
        console.log('✅');
        console.log(`    URL: ${callbackUrl}`);
        console.log(`    ID: ${result.id}`);
        successCount++;
      } else {
        console.log('❌');
      }
      console.log('');
    }

    // Summary
    console.log('\n=== Summary ===\n');
    console.log(`  Registered: ${successCount}`);
    console.log(`  Skipped: ${skipCount}`);
    console.log(`  Total: ${WEBHOOK_TOPICS.length}`);

    if (successCount + skipCount === WEBHOOK_TOPICS.length) {
      console.log('\n🎉 All webhooks configured successfully!\n');
    }

    // Reminder about webhook secret
    console.log('📝 Remember to set SHOPIFY_WEBHOOK_SECRET in your .env.local');
    console.log('   You can find this in your Shopify app settings.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
