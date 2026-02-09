import { NextRequest } from 'next/server';
import {
  verifyShopifyWebhook,
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
 * POST /api/webhooks/shopify/orders-updated
 *
 * Shopify webhook handler for orders/updated topic.
 * Catches ALL order status changes (refunds, cancellations, returns, fulfillment)
 * and mirrors Shopify's current state to Airtable.
 *
 * This is idempotent — it reads Shopify's financial_status and writes it
 * to Airtable's payment_status, only when values actually change.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const rawBody = await request.text();

    // Verify webhook signature
    const hmacHeader = request.headers.get('X-Shopify-Hmac-Sha256');
    if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
      console.error('[orders-updated] Webhook signature verification failed');
      return webhookError('Unauthorized', 401);
    }

    const order: ShopifyWebhookOrder = JSON.parse(rawBody);

    console.log('[orders-updated] Order updated:', {
      orderId: order.id,
      orderNumber: order.name,
      financialStatus: order.financial_status,
      fulfillmentStatus: order.fulfillment_status,
      cancelReason: order.cancel_reason,
      totalPrice: order.total_price,
      currentTotalPrice: order.current_total_price,
    });

    try {
      const updated = await syncOrderStatus(order);
      if (updated) {
        console.log('[orders-updated] Airtable updated');
      } else {
        console.log('[orders-updated] No changes needed');
      }
    } catch (airtableError) {
      console.error('[orders-updated] Failed to update Airtable:', airtableError);
    }

    const processingTime = Date.now() - startTime;
    console.log(`[orders-updated] Order ${order.name} processed in ${processingTime}ms`);

    return webhookSuccess();
  } catch (error) {
    console.error('[orders-updated] Error processing webhook:', error);
    return webhookSuccess(); // Return 200 to prevent retries
  }
}

/**
 * Map Shopify financial_status to Airtable payment_status
 */
function mapPaymentStatus(
  financialStatus: ShopifyWebhookOrder['financial_status']
): 'pending' | 'paid' | 'partially_refunded' | 'refunded' | 'voided' {
  switch (financialStatus) {
    case 'partially_refunded':
      return 'partially_refunded';
    case 'refunded':
      return 'refunded';
    case 'voided':
      return 'voided';
    case 'paid':
    case 'partially_paid':
      return 'paid';
    default:
      return 'pending';
  }
}

/**
 * Map Shopify fulfillment_status to Airtable fulfillment_status.
 * Explicit mapping prevents writing invalid values to Airtable's single-select field
 * if Shopify ever sends an undocumented status at runtime.
 */
function mapFulfillmentStatus(
  fulfillmentStatus: ShopifyWebhookOrder['fulfillment_status']
): 'pending' | 'fulfilled' | 'partial' | 'restocked' {
  switch (fulfillmentStatus) {
    case 'fulfilled':
      return 'fulfilled';
    case 'partial':
      return 'partial';
    case 'restocked':
      return 'restocked';
    default:
      return 'pending';
  }
}

/**
 * Sync order status from Shopify to Airtable.
 * Only writes when values have actually changed.
 * Returns true if Airtable was updated, false if no changes needed.
 */
async function syncOrderStatus(order: ShopifyWebhookOrder): Promise<boolean> {
  const Airtable = require('airtable');

  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
    .base(process.env.AIRTABLE_BASE_ID!);

  // Find the order by Shopify admin_graphql_api_id
  const records = await base(ORDERS_TABLE_ID)
    .select({
      filterByFormula: `{${ORDERS_FIELD_IDS.order_id}} = "${order.admin_graphql_api_id}"`,
      maxRecords: 1,
      returnFieldsByFieldId: true,
    })
    .firstPage();

  if (records.length === 0) {
    console.log('[orders-updated] Order not found in Airtable:', order.admin_graphql_api_id);
    return false;
  }

  const record = records[0];
  const existingFields = record.fields;

  // Calculate new values
  const newPaymentStatus = mapPaymentStatus(order.financial_status);
  const newFulfillmentStatus = mapFulfillmentStatus(order.fulfillment_status);
  const rawRefundAmount = parseFloat(order.total_price) - parseFloat(order.current_total_price);
  const newRefundAmount = isNaN(rawRefundAmount) ? 0 : Math.max(0, rawRefundAmount);
  const newCancelReason = order.cancel_reason || '';

  // Read existing values
  const existingPaymentStatus = existingFields[ORDERS_FIELD_IDS.payment_status];
  const existingFulfillmentStatus = existingFields[ORDERS_FIELD_IDS.fulfillment_status];
  const existingRefundAmount = existingFields[ORDERS_FIELD_IDS.refund_amount] || 0;
  const existingCancelReason = existingFields[ORDERS_FIELD_IDS.cancel_reason] || '';

  // Check if anything changed
  const hasChanges =
    newPaymentStatus !== existingPaymentStatus ||
    newFulfillmentStatus !== existingFulfillmentStatus ||
    Math.abs(newRefundAmount - existingRefundAmount) > 0.001 ||
    newCancelReason !== existingCancelReason;

  if (!hasChanges) {
    return false;
  }

  console.log('[orders-updated] Changes detected:', {
    paymentStatus: `${existingPaymentStatus} → ${newPaymentStatus}`,
    fulfillmentStatus: `${existingFulfillmentStatus} → ${newFulfillmentStatus}`,
    refundAmount: `${existingRefundAmount} → ${newRefundAmount}`,
    cancelReason: existingCancelReason !== newCancelReason ? `${existingCancelReason} → ${newCancelReason}` : 'unchanged',
  });

  // Build update fields — always write cancel_reason so it can be cleared
  const updateFields: Record<string, unknown> = {
    [ORDERS_FIELD_IDS.payment_status]: newPaymentStatus,
    [ORDERS_FIELD_IDS.fulfillment_status]: newFulfillmentStatus,
    [ORDERS_FIELD_IDS.refund_amount]: newRefundAmount,
    [ORDERS_FIELD_IDS.cancel_reason]: newCancelReason,
    [ORDERS_FIELD_IDS.updated_at]: new Date().toISOString(),
  };

  await base(ORDERS_TABLE_ID).update(record.id, updateFields);

  return true;
}
