import { NextRequest } from 'next/server';
import {
  verifyShopifyWebhook,
  extractCustomAttributes,
  webhookSuccess,
  webhookError,
  ShopifyWebhookOrder,
} from '@/lib/utils/shopifyWebhook';
import {
  ORDERS_TABLE_ID,
  ORDERS_FIELD_IDS,
} from '@/lib/types/airtable';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/shopify/orders-fulfilled
 *
 * Shopify webhook handler for orders/fulfilled topic.
 * Triggered when all items in an order are fulfilled (shipped).
 *
 * Actions:
 * 1. Verify webhook signature
 * 2. Update order status in Airtable
 * 3. Optionally send shipping notification
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature
    const hmacHeader = request.headers.get('X-Shopify-Hmac-Sha256');
    if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
      console.error('[orders-fulfilled] Webhook signature verification failed');
      return webhookError('Unauthorized', 401);
    }

    // Parse order data
    const order: ShopifyWebhookOrder = JSON.parse(rawBody);

    // Extract custom attributes
    const attributes = extractCustomAttributes(order.note_attributes);

    console.log('[orders-fulfilled] Order fulfilled:', {
      orderId: order.id,
      orderNumber: order.name,
      email: order.email,
      fulfillmentStatus: order.fulfillment_status,
      parentId: attributes.parentId || attributes.parent_id || 'N/A',
    });

    // Update order status in Airtable
    try {
      await updateOrderFulfillmentStatus(order.admin_graphql_api_id, 'fulfilled');
      console.log('[orders-fulfilled] Airtable updated');
    } catch (airtableError) {
      console.error('[orders-fulfilled] Failed to update Airtable:', airtableError);
      // Don't fail webhook - continue
    }

    // TODO: Send shipping notification email to customer
    // Could include tracking information from order.fulfillments

    const processingTime = Date.now() - startTime;
    console.log(`[orders-fulfilled] Order ${order.name} processed in ${processingTime}ms`);

    return webhookSuccess();
  } catch (error) {
    console.error('[orders-fulfilled] Error processing webhook:', error);
    return webhookSuccess(); // Return 200 to prevent retries
  }
}

/**
 * Update fulfillment status in Airtable
 */
async function updateOrderFulfillmentStatus(
  shopifyOrderId: string,
  status: 'pending' | 'fulfilled' | 'partial' | 'restocked'
): Promise<void> {
  const Airtable = require('airtable');

  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
    .base(process.env.AIRTABLE_BASE_ID!);

  // Find the order by Shopify order ID
  const records = await base(ORDERS_TABLE_ID)
    .select({
      filterByFormula: `{${ORDERS_FIELD_IDS.order_id}} = "${shopifyOrderId}"`,
      maxRecords: 1,
    })
    .firstPage();

  if (records.length === 0) {
    console.log('[orders-fulfilled] Order not found in Airtable:', shopifyOrderId);
    return;
  }

  // Update the record
  await base(ORDERS_TABLE_ID).update(records[0].id, {
    [ORDERS_FIELD_IDS.fulfillment_status]: status,
    [ORDERS_FIELD_IDS.updated_at]: new Date().toISOString(),
  });
}
