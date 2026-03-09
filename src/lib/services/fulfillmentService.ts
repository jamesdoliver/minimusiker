// src/lib/services/fulfillmentService.ts

/**
 * Fulfillment Service
 *
 * Orchestrates Shopify fulfillment for Welle 1 (clothing) and Welle 2 (audio).
 * Uses the Order Wave Service to identify which orders belong to each wave,
 * then calls the Shopify Admin GraphQL API to create fulfillments.
 *
 * Welle 1: fulfills clothing line items only (partial fulfillment for "Both" orders)
 * Welle 2: fulfills audio line items only (completes "Both" orders)
 */

import { tokenManager } from './shopifyTokenManager';
import { getOrderWaveService, type WaveOrder } from './orderWaveService';
import { classifyVariant } from '@/lib/config/variantClassification';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FulfillmentResult {
  orderId: string;
  orderNumber: string;
  success: boolean;
  error?: string;
  fulfillmentId?: string;
}

export interface WelleFulfillmentSummary {
  total: number;
  succeeded: number;
  failed: number;
  results: FulfillmentResult[];
}

// Shopify GraphQL response types for fulfillment operations
interface ShopifyFulfillmentOrderLineItem {
  id: string;
  remainingQuantity: number;
  totalQuantity: number;
  variant: {
    id: string;
  } | null;
}

interface ShopifyFulfillmentOrder {
  id: string;
  status: string;
  lineItems: {
    edges: Array<{
      node: ShopifyFulfillmentOrderLineItem;
    }>;
  };
}

interface GetFulfillmentOrdersResult {
  order: {
    id: string;
    name: string;
    fulfillmentOrders: {
      edges: Array<{
        node: ShopifyFulfillmentOrder;
      }>;
    };
  } | null;
}

interface FulfillmentCreateResult {
  fulfillmentCreate: {
    fulfillment: {
      id: string;
      status: string;
    } | null;
    userErrors: Array<{
      field: string[];
      message: string;
    }>;
  };
}

// ---------------------------------------------------------------------------
// GraphQL Operations
// ---------------------------------------------------------------------------

const GET_FULFILLMENT_ORDERS_QUERY = `
  query GetFulfillmentOrders($orderId: ID!) {
    order(id: $orderId) {
      id
      name
      fulfillmentOrders(first: 10) {
        edges {
          node {
            id
            status
            lineItems(first: 50) {
              edges {
                node {
                  id
                  remainingQuantity
                  totalQuantity
                  variant {
                    id
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const FULFILLMENT_CREATE_MUTATION = `
  mutation FulfillmentCreate($fulfillment: FulfillmentInput!) {
    fulfillmentCreate(fulfillment: $fulfillment) {
      fulfillment {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class FulfillmentService {
  private readonly apiVersion = process.env.SHOPIFY_API_VERSION || '2025-01';
  private orderWaveService = getOrderWaveService();

  /**
   * Execute a GraphQL query against Shopify Admin API.
   * Follows the same pattern as ShopifyAdminService.
   */
  private async query<T = unknown>(
    graphqlQuery: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
    if (!storeDomain) {
      throw new Error('SHOPIFY_STORE_DOMAIN environment variable is not set');
    }

    const token = await tokenManager.getAccessToken();
    const url = `https://${storeDomain}/admin/api/${this.apiVersion}/graphql.json`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[FulfillmentService] API request failed:', {
        status: response.status,
        body: errorText,
      });
      throw new Error(
        `Shopify Admin API request failed: ${response.status} ${response.statusText}`,
      );
    }

    const json = await response.json();

    if (json.errors) {
      console.error('[FulfillmentService] GraphQL errors:', json.errors);
      throw new Error(`GraphQL error: ${json.errors[0]?.message}`);
    }

    return json.data as T;
  }

  /**
   * Fulfill all orders for a given event and wave.
   *
   * For Welle 1: fulfills clothing line items only (partial fulfillment for "Both" orders)
   * For Welle 2: fulfills audio line items only (completes "Both" orders)
   *
   * Steps:
   * 1. Get orders for event from Airtable (using OrderWaveService)
   * 2. Filter to relevant wave
   * 3. For each order, call Shopify fulfillment API
   * 4. Track success/failure per order
   * 5. Return summary
   */
  async fulfillWelle(
    eventRecordId: string,
    welle: 'Welle 1' | 'Welle 2',
  ): Promise<WelleFulfillmentSummary> {
    // 1. Get the event's orders grouped by wave
    const eventSummary = await this.orderWaveService.getEventOrders(eventRecordId);

    // 2. Get the orders for the requested wave
    const waveOrders: WaveOrder[] =
      welle === 'Welle 1' ? eventSummary.welle1.orders : eventSummary.welle2.orders;

    if (waveOrders.length === 0) {
      return {
        total: 0,
        succeeded: 0,
        failed: 0,
        results: [],
      };
    }

    // 3. Fulfill each order individually, catching errors per order
    const results: FulfillmentResult[] = [];

    for (const waveOrder of waveOrders) {
      try {
        const fulfillmentId = await this.fulfillSingleOrder(waveOrder, welle);
        results.push({
          orderId: waveOrder.orderId,
          orderNumber: waveOrder.orderNumber,
          success: true,
          fulfillmentId,
        });
      } catch (error) {
        console.error(
          `[FulfillmentService] Failed to fulfill order ${waveOrder.orderNumber}:`,
          error,
        );
        results.push({
          orderId: waveOrder.orderId,
          orderNumber: waveOrder.orderNumber,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      total: results.length,
      succeeded,
      failed,
      results,
    };
  }

  /**
   * Fulfill a single order for a specific wave.
   * Returns the fulfillment ID on success.
   */
  private async fulfillSingleOrder(
    waveOrder: WaveOrder,
    welle: 'Welle 1' | 'Welle 2',
  ): Promise<string> {
    // Ensure we have a Shopify order GID
    const shopifyOrderId = this.ensureGid(waveOrder.orderId, 'Order');

    // 1. Get fulfillment orders from Shopify
    const data = await this.query<GetFulfillmentOrdersResult>(
      GET_FULFILLMENT_ORDERS_QUERY,
      { orderId: shopifyOrderId },
    );

    if (!data.order) {
      throw new Error(`Order not found in Shopify: ${shopifyOrderId}`);
    }

    // 2. Collect line items to fulfill based on wave category
    const lineItemsByFulfillmentOrder = this.buildLineItemsForWave(
      data.order.fulfillmentOrders.edges.map((e) => e.node),
      welle,
    );

    if (lineItemsByFulfillmentOrder.length === 0) {
      throw new Error(
        `No eligible line items found for ${welle} on order ${waveOrder.orderNumber}`,
      );
    }

    // 3. Create the fulfillment
    const fulfillmentResult = await this.query<FulfillmentCreateResult>(
      FULFILLMENT_CREATE_MUTATION,
      {
        fulfillment: {
          notifyCustomer: true,
          lineItemsByFulfillmentOrder,
        },
      },
    );

    // Check for user errors
    const userErrors = fulfillmentResult.fulfillmentCreate.userErrors;
    if (userErrors.length > 0) {
      const errorMessages = userErrors.map((e) => e.message).join('; ');
      throw new Error(`Shopify fulfillment error: ${errorMessages}`);
    }

    const fulfillment = fulfillmentResult.fulfillmentCreate.fulfillment;
    if (!fulfillment) {
      throw new Error('Fulfillment was not created (no fulfillment returned)');
    }

    console.log(
      `[FulfillmentService] Fulfilled order ${waveOrder.orderNumber} for ${welle}: ${fulfillment.id}`,
    );

    return fulfillment.id;
  }

  /**
   * Build the lineItemsByFulfillmentOrder array for the fulfillmentCreate mutation.
   *
   * For Welle 1: include only clothing/standard variant line items with remaining quantity > 0.
   * For Welle 2: include only audio variant line items with remaining quantity > 0.
   */
  private buildLineItemsForWave(
    fulfillmentOrders: ShopifyFulfillmentOrder[],
    welle: 'Welle 1' | 'Welle 2',
  ): Array<{
    fulfillmentOrderId: string;
    fulfillmentOrderLineItems: Array<{ id: string; quantity: number }>;
  }> {
    const result: Array<{
      fulfillmentOrderId: string;
      fulfillmentOrderLineItems: Array<{ id: string; quantity: number }>;
    }> = [];

    for (const fulfillmentOrder of fulfillmentOrders) {
      // Only process fulfillment orders that are still open or in progress
      if (!['OPEN', 'IN_PROGRESS', 'SCHEDULED'].includes(fulfillmentOrder.status)) {
        continue;
      }

      const eligibleLineItems: Array<{ id: string; quantity: number }> = [];

      for (const edge of fulfillmentOrder.lineItems.edges) {
        const lineItem = edge.node;

        // Skip items that are already fulfilled (no remaining quantity)
        if (lineItem.remainingQuantity <= 0) continue;

        // Skip items without a variant (shouldn't happen, but be safe)
        if (!lineItem.variant) continue;

        // Classify the variant to determine if it belongs to this wave
        const category = classifyVariant(lineItem.variant.id);

        if (welle === 'Welle 1') {
          // Welle 1 ships clothing and standard items
          if (category === 'clothing' || category === 'standard') {
            eligibleLineItems.push({
              id: lineItem.id,
              quantity: lineItem.remainingQuantity,
            });
          }
        } else {
          // Welle 2 ships audio items
          if (category === 'audio') {
            eligibleLineItems.push({
              id: lineItem.id,
              quantity: lineItem.remainingQuantity,
            });
          }
        }
      }

      if (eligibleLineItems.length > 0) {
        result.push({
          fulfillmentOrderId: fulfillmentOrder.id,
          fulfillmentOrderLineItems: eligibleLineItems,
        });
      }
    }

    return result;
  }

  /**
   * Ensure a Shopify ID is in GID format.
   * Accepts both "gid://shopify/Order/123" and plain "123".
   */
  private ensureGid(id: string, type: string): string {
    if (id.startsWith('gid://')) return id;
    return `gid://shopify/${type}/${id}`;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let fulfillmentServiceInstance: FulfillmentService | null = null;

export function getFulfillmentService(): FulfillmentService {
  if (!fulfillmentServiceInstance) {
    fulfillmentServiceInstance = new FulfillmentService();
  }
  return fulfillmentServiceInstance;
}
