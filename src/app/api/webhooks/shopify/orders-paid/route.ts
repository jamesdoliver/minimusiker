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
import { tokenManager } from '@/lib/services/shopifyTokenManager';
import {
  ORDERS_TABLE_ID,
  ORDERS_FIELD_IDS,
  PARENTS_TABLE_ID,
  PARENTS_FIELD_IDS,
  EVENTS_TABLE_ID,
  EVENTS_FIELD_IDS,
  CLASSES_TABLE_ID,
  CLASSES_FIELD_IDS,
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

    // Idempotency check: see if this order already exists in Airtable
    const shopifyEventId = request.headers.get('X-Shopify-Event-Id');
    const existingOrder = await checkOrderExists(order.admin_graphql_api_id);
    if (existingOrder) {
      console.log('[orders-paid] Order already exists, skipping:', {
        orderId: order.id,
        orderNumber: order.name,
        shopifyEventId,
      });
      return webhookSuccess();
    }

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
    // Note: class_id and event_id are linked record fields and expect arrays of record IDs
    const classId = attributes.classId || attributes.class_id;
    const eventId = attributes.eventId || attributes.event_id || attributes.bookingId || attributes.booking_id;

    // Look up Event record to get Airtable record ID for linked record
    let eventRecordId: string | null = null;
    let classRecordId: string | null = null;

    const Airtable = require('airtable');
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
      .base(process.env.AIRTABLE_BASE_ID!);

    if (eventId) {
      try {
        // Look up by event_id OR legacy_booking_id for backward compatibility
        // SimplyBook events use numeric IDs, admin-created events use evt_ format
        const events = await base(EVENTS_TABLE_ID)
          .select({
            filterByFormula: `OR({${EVENTS_FIELD_IDS.event_id}} = "${eventId}", {${EVENTS_FIELD_IDS.legacy_booking_id}} = "${eventId}")`,
            maxRecords: 1,
          })
          .firstPage();

        if (events.length > 0) {
          eventRecordId = events[0].id;
          console.log('[orders-paid] Found Event record:', eventRecordId);
        } else {
          console.warn('[orders-paid] Event not found for eventId:', eventId);
        }
      } catch (eventError) {
        console.error('[orders-paid] Error looking up event:', eventError);
      }
    }

    // Look up Class record to get Airtable record ID for linked record
    // Try multiple lookup strategies since classId generation may vary
    if (classId || eventId) {
      try {
        // Strategy 1: Look up by class_id or legacy_booking_id matching classId
        if (classId) {
          const classes = await base(CLASSES_TABLE_ID)
            .select({
              filterByFormula: `OR({${CLASSES_FIELD_IDS.class_id}} = "${classId}", {${CLASSES_FIELD_IDS.legacy_booking_id}} = "${classId}")`,
              maxRecords: 1,
            })
            .firstPage();

          if (classes.length > 0) {
            classRecordId = classes[0].id;
            console.log('[orders-paid] Found Class record by classId:', classRecordId);
          }
        }

        // Strategy 2: If not found by classId, try looking up by eventId (booking_id)
        // Classes may have legacy_booking_id = parent's booking_id
        if (!classRecordId && eventId) {
          const classesByEvent = await base(CLASSES_TABLE_ID)
            .select({
              filterByFormula: `{${CLASSES_FIELD_IDS.legacy_booking_id}} = "${eventId}"`,
              maxRecords: 1,
            })
            .firstPage();

          if (classesByEvent.length > 0) {
            classRecordId = classesByEvent[0].id;
            console.log('[orders-paid] Found Class record by eventId/booking_id:', classRecordId);
          }
        }

        if (!classRecordId) {
          console.warn('[orders-paid] Class not found for classId:', classId, 'or eventId:', eventId);
        }
      } catch (classError) {
        console.error('[orders-paid] Error looking up class:', classError);
      }
    }

    const orderData = {
      [ORDERS_FIELD_IDS.order_id]: order.admin_graphql_api_id,
      [ORDERS_FIELD_IDS.order_number]: order.name,
      [ORDERS_FIELD_IDS.booking_id]: eventId || '',
      [ORDERS_FIELD_IDS.school_name]: attributes.schoolName || attributes.school_name || '',
      ...(classRecordId ? { [ORDERS_FIELD_IDS.class_id]: [classRecordId] } : {}),
      ...(eventRecordId ? { [ORDERS_FIELD_IDS.event_id]: [eventRecordId] } : {}),
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

    // Add short tags to Shopify order for easy identification
    // Extract 6-char hash from eventId/classId (last segment after underscore)
    const eventHash = eventId?.match(/_([a-f0-9]{6})$/)?.[1];
    const classHash = classId?.match(/_([a-f0-9]{6})$/)?.[1];

    const tags: string[] = [];
    if (eventHash) tags.push(`evt-${eventHash}`);
    if (classHash) tags.push(`cls-${classHash}`);

    if (tags.length > 0) {
      try {
        await addOrderTags(order.id, tags);
        console.log('[orders-paid] Tags added:', tags);
      } catch (tagError) {
        console.error('[orders-paid] Failed to add tags:', tagError);
        // Don't fail the webhook - tags are nice-to-have
      }
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
 * Check if an order already exists in Airtable (idempotency check)
 */
async function checkOrderExists(orderId: string): Promise<boolean> {
  const Airtable = require('airtable');
  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
    .base(process.env.AIRTABLE_BASE_ID!);

  try {
    const records = await base(ORDERS_TABLE_ID)
      .select({
        filterByFormula: `{${ORDERS_FIELD_IDS.order_id}} = "${orderId}"`,
        maxRecords: 1,
      })
      .firstPage();

    return records.length > 0;
  } catch (error) {
    console.error('[orders-paid] Error checking for existing order:', error);
    // Return false to allow order creation attempt on error
    return false;
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
 *
 * This function:
 * 1. Looks up the parent's Airtable record ID
 * 2. Updates the order with parent link and marks digital_delivered = true
 * 3. The parent portal will check this flag to show download buttons
 */
async function grantDigitalAccess(parentId: string, order: ShopifyWebhookOrder): Promise<void> {
  const Airtable = require('airtable');
  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
    .base(process.env.AIRTABLE_BASE_ID!);

  try {
    // 1. Look up parent record by parent_id field
    const parentRecords = await base(PARENTS_TABLE_ID)
      .select({
        filterByFormula: `{${PARENTS_FIELD_IDS.parent_id}} = "${parentId}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (parentRecords.length === 0) {
      console.warn('[orders-paid] Parent not found:', parentId);
      // Don't throw - order still processed, just can't link
      return;
    }

    const parentRecordId = parentRecords[0].id;
    console.log('[orders-paid] Found parent record:', parentRecordId);

    // 2. Find the order record we just created and update it
    const orderRecords = await base(ORDERS_TABLE_ID)
      .select({
        filterByFormula: `{${ORDERS_FIELD_IDS.order_id}} = "${order.admin_graphql_api_id}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (orderRecords.length > 0) {
      // Update order with parent link and mark digital as delivered
      await base(ORDERS_TABLE_ID).update(orderRecords[0].id, {
        [ORDERS_FIELD_IDS.parent_id]: [parentRecordId],
        [ORDERS_FIELD_IDS.digital_delivered]: true,
        [ORDERS_FIELD_IDS.updated_at]: new Date().toISOString(),
      });

      console.log('[orders-paid] Order updated with digital access:', {
        orderId: order.name,
        parentId: parentId,
        parentRecordId: parentRecordId,
      });
    }

    // 3. TODO: Send email notification about digital content availability
    // This could be implemented using the emailService
    // await sendDigitalAccessEmail(order.email, parentId, order.name);

  } catch (error) {
    console.error('[orders-paid] Error granting digital access:', error);
    throw error; // Re-throw to be caught by caller
  }
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

/**
 * Add tags to a Shopify order via Admin API
 * Uses tokenManager for OAuth 2.0 Client Credentials Grant
 */
async function addOrderTags(orderId: number, tags: string[]): Promise<void> {
  const shopifyDomain = process.env.SHOPIFY_SHOP_DOMAIN || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;

  if (!shopifyDomain) {
    console.warn('[orders-paid] Missing Shopify domain for adding tags');
    return;
  }

  // Get access token via OAuth Client Credentials Grant
  const accessToken = await tokenManager.getAccessToken();

  const response = await fetch(
    `https://${shopifyDomain}/admin/api/2024-01/orders/${orderId}.json`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ order: { tags: tags.join(', ') } }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to add tags: ${response.status} - ${errorText}`);
  }
}
