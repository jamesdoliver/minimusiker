/**
 * Shopify Webhook Utilities
 *
 * Handles webhook signature verification and common webhook operations.
 * Shopify webhooks use HMAC-SHA256 for signature verification.
 */

import crypto from 'crypto';

/**
 * Verify Shopify webhook signature
 *
 * @param rawBody - The raw request body as a string
 * @param hmacHeader - The X-Shopify-Hmac-Sha256 header value
 * @returns true if signature is valid, false otherwise
 */
export function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null): boolean {
  if (!hmacHeader) {
    console.error('[Webhook] Missing HMAC header');
    return false;
  }

  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Webhook] SHOPIFY_WEBHOOK_SECRET not configured');
    return false;
  }

  // Calculate HMAC
  const calculatedHmac = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody, 'utf8')
    .digest('base64');

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(calculatedHmac),
      Buffer.from(hmacHeader)
    );
  } catch {
    return false;
  }
}

/**
 * Extract custom attributes from Shopify order note_attributes
 */
export function extractCustomAttributes(
  noteAttributes: Array<{ name: string; value: string }> | undefined
): Record<string, string> {
  const attributes: Record<string, string> = {};

  if (!noteAttributes || !Array.isArray(noteAttributes)) {
    return attributes;
  }

  for (const attr of noteAttributes) {
    if (attr.name && attr.value) {
      // Shopify stores attributes with original keys
      attributes[attr.name] = attr.value;
    }
  }

  return attributes;
}

/**
 * Parse Shopify order ID to extract numeric ID
 * Shopify IDs are in format: gid://shopify/Order/1234567890
 */
export function parseShopifyOrderId(gid: string): string {
  const match = gid.match(/Order\/(\d+)/);
  return match ? match[1] : gid;
}

/**
 * Check if an order contains digital products
 * This checks product types or tags for digital indicators
 */
export function hasDigitalProducts(order: ShopifyWebhookOrder): boolean {
  const digitalTypes = ['digital', 'recording', 'download', 'audio'];
  const digitalTags = ['digital', 'downloadable', 'recording'];

  for (const lineItem of order.line_items) {
    // Check product type
    if (lineItem.product_type &&
        digitalTypes.some(t => lineItem.product_type.toLowerCase().includes(t))) {
      return true;
    }

    // Check variant title
    if (lineItem.variant_title &&
        digitalTypes.some(t => lineItem.variant_title?.toLowerCase().includes(t))) {
      return true;
    }

    // Check properties for digital flags
    if (lineItem.properties) {
      for (const prop of lineItem.properties) {
        if (prop.name === 'digital' && prop.value === 'true') {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Common response for successful webhook processing
 */
export function webhookSuccess(message?: string) {
  return new Response(message || 'OK', { status: 200 });
}

/**
 * Common response for webhook errors
 */
export function webhookError(message: string, status: number = 400) {
  return new Response(message, { status });
}

// ======================================================================
// Shopify Webhook Types
// ======================================================================

export interface ShopifyWebhookLineItem {
  id: number;
  variant_id: number;
  title: string;
  quantity: number;
  sku: string;
  variant_title: string | null;
  vendor: string;
  fulfillment_service: string;
  product_id: number;
  requires_shipping: boolean;
  taxable: boolean;
  gift_card: boolean;
  name: string;
  variant_inventory_management: string | null;
  properties: Array<{ name: string; value: string }>;
  product_exists: boolean;
  fulfillable_quantity: number;
  grams: number;
  price: string;
  total_discount: string;
  fulfillment_status: string | null;
  price_set: {
    shop_money: { amount: string; currency_code: string };
    presentment_money: { amount: string; currency_code: string };
  };
  total_discount_set: {
    shop_money: { amount: string; currency_code: string };
    presentment_money: { amount: string; currency_code: string };
  };
  product_type: string;
}

export interface ShopifyWebhookOrder {
  id: number;
  admin_graphql_api_id: string;
  app_id: number | null;
  browser_ip: string | null;
  buyer_accepts_marketing: boolean;
  cancel_reason: string | null;
  cancelled_at: string | null;
  cart_token: string | null;
  checkout_id: number | null;
  checkout_token: string;
  confirmed: boolean;
  contact_email: string | null;
  created_at: string;
  currency: string;
  current_subtotal_price: string;
  current_total_discounts: string;
  current_total_price: string;
  current_total_tax: string;
  customer_locale: string | null;
  device_id: string | null;
  discount_codes: Array<{ code: string; amount: string; type: string }>;
  email: string;
  financial_status: 'pending' | 'authorized' | 'partially_paid' | 'paid' | 'partially_refunded' | 'refunded' | 'voided';
  fulfillment_status: 'fulfilled' | 'partial' | 'restocked' | null;
  gateway: string;
  landing_site: string | null;
  landing_site_ref: string | null;
  location_id: number | null;
  name: string; // Order number like "#1001"
  note: string | null;
  note_attributes: Array<{ name: string; value: string }>;
  number: number;
  order_number: number;
  order_status_url: string;
  payment_gateway_names: string[];
  phone: string | null;
  processed_at: string;
  referring_site: string | null;
  source_identifier: string | null;
  source_name: string;
  source_url: string | null;
  subtotal_price: string;
  tags: string;
  tax_lines: Array<{ title: string; price: string; rate: number }>;
  taxes_included: boolean;
  test: boolean;
  token: string;
  total_discounts: string;
  total_line_items_price: string;
  total_price: string;
  total_tax: string;
  total_weight: number;
  updated_at: string;
  user_id: number | null;
  line_items: ShopifyWebhookLineItem[];
  shipping_lines: Array<{
    id: number;
    title: string;
    price: string;
    code: string;
    source: string;
    discounted_price: string;
  }>;
  customer?: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string | null;
  };
  billing_address?: {
    first_name: string;
    last_name: string;
    address1: string;
    city: string;
    province: string;
    country: string;
    zip: string;
  };
  shipping_address?: {
    first_name: string;
    last_name: string;
    address1: string;
    city: string;
    province: string;
    country: string;
    zip: string;
  };
}
