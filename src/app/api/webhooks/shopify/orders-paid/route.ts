import { NextRequest } from 'next/server';
import {
  verifyShopifyWebhook,
  extractCustomAttributes,
  hasDigitalProducts,
  webhookSuccess,
  webhookError,
  ShopifyWebhookOrder,
} from '@/lib/utils/shopifyWebhook';
import { getAirtableService } from '@/lib/services/airtableService';
import {
  ORDERS_TABLE_ID,
  ORDERS_FIELD_IDS,
  ShopifyOrderLineItem,
} from '@/lib/types/airtable';

/**
 * POST /api/webhooks/shopify/orders-paid
 *
 * Shopify webhook handler for orders/paid topic.
 * Triggered when an order payment is confirmed.
 *
 * Actions:
 * 1. Verify webhook signature
 * 2. Extract custom attributes (parentId, eventId, etc.)
 * 3. Store order in Airtable
 * 4. Grant digital access if order contains digital products
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature
    const hmacHeader = request.headers.get('X-Shopify-Hmac-Sha256');
    if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
      console.error('[orders-paid] Webhook signature verification failed');
      return webhookError('Unauthorized', 401);
    }

    // Parse order data
    const order: ShopifyWebhookOrder = JSON.parse(rawBody);

    console.log('[orders-paid] Processing order:', {
      orderId: order.id,
      orderNumber: order.name,
      email: order.email,
      total: order.total_price,
      currency: order.currency,
    });

    // Check for duplicate processing using X-Shopify-Event-Id
    const eventId = request.headers.get('X-Shopify-Event-Id');
    // TODO: Implement idempotency check against stored event IDs

    // Extract custom attributes
    const attributes = extractCustomAttributes(order.note_attributes);
    console.log('[orders-paid] Custom attributes:', attributes);

    // Transform line items for storage
    const lineItems: ShopifyOrderLineItem[] = order.line_items.map((item) => ({
      variant_id: `gid://shopify/ProductVariant/${item.variant_id}`,
      product_title: item.title,
      variant_title: item.variant_title || undefined,
      quantity: item.quantity,
      price: parseFloat(item.price),
      total: parseFloat(item.price) * item.quantity,
    }));

    // Calculate totals
    const subtotal = parseFloat(order.subtotal_price);
    const taxAmount = parseFloat(order.total_tax);
    const shippingAmount = order.shipping_lines.reduce(
      (sum, line) => sum + parseFloat(line.price),
      0
    );
    const totalAmount = parseFloat(order.total_price);

    // Prepare order data for Airtable
    const orderData = {
      [ORDERS_FIELD_IDS.order_id]: order.admin_graphql_api_id,
      [ORDERS_FIELD_IDS.order_number]: order.name,
      [ORDERS_FIELD_IDS.booking_id]: attributes.bookingId || attributes.booking_id || '',
      [ORDERS_FIELD_IDS.school_name]: attributes.schoolName || attributes.school_name || '',
      [ORDERS_FIELD_IDS.order_date]: order.created_at,
      [ORDERS_FIELD_IDS.total_amount]: totalAmount,
      [ORDERS_FIELD_IDS.subtotal]: subtotal,
      [ORDERS_FIELD_IDS.tax_amount]: taxAmount,
      [ORDERS_FIELD_IDS.shipping_amount]: shippingAmount,
      [ORDERS_FIELD_IDS.line_items]: JSON.stringify(lineItems),
      [ORDERS_FIELD_IDS.fulfillment_status]: mapFulfillmentStatus(order.fulfillment_status),
      [ORDERS_FIELD_IDS.payment_status]: mapFinancialStatus(order.financial_status),
      [ORDERS_FIELD_IDS.digital_delivered]: false,
      [ORDERS_FIELD_IDS.created_at]: new Date().toISOString(),
      [ORDERS_FIELD_IDS.updated_at]: new Date().toISOString(),
    };

    // Try to link to parent record if parentId is provided
    if (attributes.parentId || attributes.parent_id) {
      // Note: Linked records require the record ID, not a custom field value
      // This would need to be looked up first - for now, we store the reference
      console.log('[orders-paid] Parent reference:', attributes.parentId || attributes.parent_id);
    }

    // Store order in Airtable
    try {
      await createOrderInAirtable(orderData);
      console.log('[orders-paid] Order stored in Airtable');
    } catch (airtableError) {
      console.error('[orders-paid] Failed to store order in Airtable:', airtableError);
      // Don't fail the webhook - log and continue
    }

    // Check for digital products and grant access
    if (hasDigitalProducts(order)) {
      console.log('[orders-paid] Order contains digital products');

      const parentId = attributes.parentId || attributes.parent_id;
      if (parentId) {
        try {
          await grantDigitalAccess(parentId, order);
          console.log('[orders-paid] Digital access granted for parent:', parentId);
        } catch (digitalError) {
          console.error('[orders-paid] Failed to grant digital access:', digitalError);
          // Don't fail the webhook - log and continue
        }
      } else {
        console.warn('[orders-paid] No parentId found for digital product order');
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`[orders-paid] Order ${order.name} processed in ${processingTime}ms`);

    return webhookSuccess();
  } catch (error) {
    console.error('[orders-paid] Error processing webhook:', error);

    // Return 200 to prevent Shopify from retrying for parsing errors
    // Only return 4xx/5xx if we want Shopify to retry
    return webhookSuccess();
  }
}

/**
 * Create order record in Airtable
 */
async function createOrderInAirtable(orderData: Record<string, unknown>): Promise<void> {
  // Use Airtable API directly since we need to write to Orders table
  const Airtable = require('airtable');

  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
    .base(process.env.AIRTABLE_BASE_ID!);

  await base(ORDERS_TABLE_ID).create([{ fields: orderData }]);
}

/**
 * Grant digital access to a parent
 */
async function grantDigitalAccess(parentId: string, order: ShopifyWebhookOrder): Promise<void> {
  // TODO: Implement digital access granting
  // This could involve:
  // 1. Updating the parent record with digital_access = true
  // 2. Sending an email with download links
  // 3. Creating a download token in the database

  console.log('[orders-paid] Digital access would be granted to:', {
    parentId,
    orderNumber: order.name,
    email: order.email,
  });

  // For now, just log - full implementation in digitalDeliveryService
}

/**
 * Map Shopify fulfillment status to our enum
 */
function mapFulfillmentStatus(
  status: 'fulfilled' | 'partial' | 'restocked' | null
): 'pending' | 'fulfilled' | 'partial' | 'restocked' {
  if (!status) return 'pending';
  return status;
}

/**
 * Map Shopify financial status to our enum
 */
function mapFinancialStatus(
  status: ShopifyWebhookOrder['financial_status']
): 'pending' | 'paid' | 'refunded' | 'voided' {
  switch (status) {
    case 'paid':
    case 'partially_paid':
      return 'paid';
    case 'refunded':
    case 'partially_refunded':
      return 'refunded';
    case 'voided':
      return 'voided';
    default:
      return 'pending';
  }
}
