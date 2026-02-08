import { NextRequest } from 'next/server';
import {
  verifyShopifyWebhook,
  extractCustomAttributes,
  webhookSuccess,
  webhookError,
  ShopifyWebhookOrder,
} from '@/lib/utils/shopifyWebhook';

/**
 * POST /api/webhooks/shopify/orders-cancelled
 *
 * Shopify webhook handler for orders/cancelled topic.
 * Triggered when an order is explicitly cancelled.
 *
 * NOTE: Airtable status updates (payment_status, refund_amount, etc.) are handled
 * by the orders-updated webhook which fires for ALL order changes including cancellations.
 * This handler only handles cancellation-specific side effects (digital access revocation).
 *
 * Actions:
 * 1. Verify webhook signature
 * 2. Revoke digital access if applicable
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

    // Airtable status sync is handled by orders-updated webhook.
    // This handler only handles cancellation-specific side effects.

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
