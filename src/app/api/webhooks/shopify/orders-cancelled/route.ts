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

/**
 * POST /api/webhooks/shopify/orders-cancelled
 *
 * Shopify webhook handler for orders/cancelled topic.
 * Triggered when an order is cancelled or refunded.
 *
 * Actions:
 * 1. Verify webhook signature
 * 2. Update order status in Airtable
 * 3. Revoke digital access if applicable
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature
    const hmacHeader = request.headers.get('X-Shopify-Hmac-Sha256');
    if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
      console.error('[orders-cancelled] Webhook signature verification failed');
      return webhookError('Unauthorized', 401);
    }

    // Parse order data
    const order: ShopifyWebhookOrder = JSON.parse(rawBody);

    // Extract custom attributes
    const attributes = extractCustomAttributes(order.note_attributes);

    console.log('[orders-cancelled] Order cancelled:', {
      orderId: order.id,
      orderNumber: order.name,
      email: order.email,
      cancelReason: order.cancel_reason,
      financialStatus: order.financial_status,
      parentId: attributes.parentId || attributes.parent_id || 'N/A',
    });

    // Update order status in Airtable
    try {
      await updateOrderCancelledStatus(order);
      console.log('[orders-cancelled] Airtable updated');
    } catch (airtableError) {
      console.error('[orders-cancelled] Failed to update Airtable:', airtableError);
      // Don't fail webhook - continue
    }

    // Revoke digital access if this was a digital order
    const parentId = attributes.parentId || attributes.parent_id;
    if (parentId) {
      try {
        await revokeDigitalAccess(parentId, order);
        console.log('[orders-cancelled] Digital access revoked for parent:', parentId);
      } catch (revokeError) {
        console.error('[orders-cancelled] Failed to revoke digital access:', revokeError);
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`[orders-cancelled] Order ${order.name} processed in ${processingTime}ms`);

    return webhookSuccess();
  } catch (error) {
    console.error('[orders-cancelled] Error processing webhook:', error);
    return webhookSuccess(); // Return 200 to prevent retries
  }
}

/**
 * Update order cancelled status in Airtable
 */
async function updateOrderCancelledStatus(order: ShopifyWebhookOrder): Promise<void> {
  const Airtable = require('airtable');

  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
    .base(process.env.AIRTABLE_BASE_ID!);

  // Find the order by Shopify order ID
  const records = await base(ORDERS_TABLE_ID)
    .select({
      filterByFormula: `{${ORDERS_FIELD_IDS.order_id}} = "${order.admin_graphql_api_id}"`,
      maxRecords: 1,
    })
    .firstPage();

  if (records.length === 0) {
    console.log('[orders-cancelled] Order not found in Airtable:', order.admin_graphql_api_id);
    return;
  }

  // Map financial status
  let paymentStatus: 'pending' | 'paid' | 'refunded' | 'voided' = 'pending';
  if (order.financial_status === 'refunded' || order.financial_status === 'partially_refunded') {
    paymentStatus = 'refunded';
  } else if (order.financial_status === 'voided') {
    paymentStatus = 'voided';
  }

  // Update the record
  await base(ORDERS_TABLE_ID).update(records[0].id, {
    [ORDERS_FIELD_IDS.payment_status]: paymentStatus,
    [ORDERS_FIELD_IDS.updated_at]: new Date().toISOString(),
  });
}

/**
 * Revoke digital access for cancelled/refunded orders
 */
async function revokeDigitalAccess(parentId: string, order: ShopifyWebhookOrder): Promise<void> {
  // TODO: Implement digital access revocation
  // This could involve:
  // 1. Setting digital_access = false on parent record
  // 2. Invalidating download tokens
  // 3. Sending notification email

  console.log('[orders-cancelled] Would revoke digital access for:', {
    parentId,
    orderNumber: order.name,
    email: order.email,
  });

  // For now, just log - full implementation when digital delivery is complete
}
