import { NextRequest } from 'next/server';
import {
  verifyShopifyWebhook,
  extractCustomAttributes,
  webhookSuccess,
  webhookError,
  ShopifyWebhookOrder,
} from '@/lib/utils/shopifyWebhook';

/**
 * POST /api/webhooks/shopify/orders-create
 *
 * Shopify webhook handler for orders/create topic.
 * Triggered when a new order is created (before payment).
 *
 * Actions:
 * 1. Verify webhook signature
 * 2. Log order creation for monitoring
 * 3. Optionally trigger notifications
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature
    const hmacHeader = request.headers.get('X-Shopify-Hmac-Sha256');
    if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
      console.error('[orders-create] Webhook signature verification failed');
      return webhookError('Unauthorized', 401);
    }

    // Parse order data
    const order: ShopifyWebhookOrder = JSON.parse(rawBody);

    // Extract custom attributes
    const attributes = extractCustomAttributes(order.note_attributes);

    console.log('[orders-create] New order created:', {
      orderId: order.id,
      orderNumber: order.name,
      email: order.email,
      total: order.total_price,
      currency: order.currency,
      financialStatus: order.financial_status,
      itemCount: order.line_items.length,
      parentId: attributes.parentId || attributes.parent_id || 'N/A',
      eventId: attributes.eventId || attributes.event_id || 'N/A',
    });

    // Note: Most processing happens in orders-paid webhook
    // This webhook is useful for:
    // - Real-time order monitoring
    // - Sending "order received" notifications
    // - Fraud detection triggers

    const processingTime = Date.now() - startTime;
    console.log(`[orders-create] Order ${order.name} logged in ${processingTime}ms`);

    return webhookSuccess();
  } catch (error) {
    console.error('[orders-create] Error processing webhook:', error);
    return webhookSuccess(); // Return 200 to prevent retries
  }
}
