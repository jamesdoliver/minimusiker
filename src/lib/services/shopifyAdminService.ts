/**
 * Shopify Admin API Service
 *
 * Handles all Admin API operations including order retrieval, analytics,
 * and webhook management. Uses Client Credentials Grant via tokenManager.
 */

import { tokenManager } from './shopifyTokenManager';

// Types for Shopify Admin API responses
interface ShopifyMoney {
  amount: string;
  currencyCode: string;
}

interface ShopifyCustomAttribute {
  key: string;
  value: string;
}

interface ShopifyOrderLineItem {
  name: string;
  quantity: number;
  originalTotalSet: {
    shopMoney: ShopifyMoney;
  };
  variant?: {
    id: string;
    title: string;
    product: {
      title: string;
      productType: string;
    };
  };
}

interface ShopifyOrder {
  id: string;
  name: string; // Display name like "#1001"
  createdAt: string;
  totalPriceSet: {
    shopMoney: ShopifyMoney;
  };
  subtotalPriceSet?: {
    shopMoney: ShopifyMoney;
  };
  totalTaxSet?: {
    shopMoney: ShopifyMoney;
  };
  totalShippingPriceSet?: {
    shopMoney: ShopifyMoney;
  };
  customAttributes: ShopifyCustomAttribute[];
  displayFulfillmentStatus: string;
  displayFinancialStatus: string;
  lineItems: {
    edges: Array<{
      node: ShopifyOrderLineItem;
    }>;
  };
}

interface OrderQueryResult {
  orders: {
    edges: Array<{
      node: ShopifyOrder;
    }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
}

// Simplified order type for our application
export interface ParsedOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  totalAmount: number;
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  currency: string;
  fulfillmentStatus: string;
  financialStatus: string;
  customAttributes: Record<string, string>;
  lineItems: Array<{
    name: string;
    quantity: number;
    total: number;
    variantId?: string;
    variantTitle?: string;
    productTitle?: string;
    productType?: string;
  }>;
}

// Revenue stats for an event
export interface EventRevenueStats {
  eventId: string;
  totalRevenue: number;
  orderCount: number;
  averageOrderValue: number;
  productBreakdown: Record<string, { quantity: number; revenue: number }>;
}

class ShopifyAdminService {
  private readonly apiVersion = process.env.SHOPIFY_API_VERSION || '2025-01';

  /**
   * Execute a GraphQL query against Shopify Admin API
   */
  private async query<T = unknown>(
    query: string,
    variables?: Record<string, unknown>
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
        query,
        variables,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ShopifyAdminService] API request failed:', {
        status: response.status,
        body: errorText,
      });
      throw new Error(
        `Shopify Admin API request failed: ${response.status} ${response.statusText}`
      );
    }

    const json = await response.json();

    if (json.errors) {
      console.error('[ShopifyAdminService] GraphQL errors:', json.errors);
      throw new Error(`GraphQL error: ${json.errors[0]?.message}`);
    }

    return json.data as T;
  }

  /**
   * Get all orders with optional custom attribute filtering
   */
  async getOrders(options?: {
    first?: number;
    after?: string;
    query?: string;
  }): Promise<{ orders: ParsedOrder[]; hasNextPage: boolean; endCursor: string | null }> {
    const graphqlQuery = `
      query GetOrders($first: Int!, $after: String, $query: String) {
        orders(first: $first, after: $after, query: $query) {
          edges {
            node {
              id
              name
              createdAt
              totalPriceSet {
                shopMoney { amount currencyCode }
              }
              subtotalPriceSet {
                shopMoney { amount currencyCode }
              }
              totalTaxSet {
                shopMoney { amount currencyCode }
              }
              totalShippingPriceSet {
                shopMoney { amount currencyCode }
              }
              customAttributes {
                key
                value
              }
              displayFulfillmentStatus
              displayFinancialStatus
              lineItems(first: 50) {
                edges {
                  node {
                    name
                    quantity
                    originalTotalSet {
                      shopMoney { amount }
                    }
                    variant {
                      id
                      title
                      product {
                        title
                        productType
                      }
                    }
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const data = await this.query<OrderQueryResult>(graphqlQuery, {
      first: options?.first || 50,
      after: options?.after,
      query: options?.query,
    });

    const orders = data.orders.edges.map(({ node }) =>
      this.parseOrder(node)
    );

    return {
      orders,
      hasNextPage: data.orders.pageInfo.hasNextPage,
      endCursor: data.orders.pageInfo.endCursor,
    };
  }

  /**
   * Get orders by booking ID (from custom attributes)
   */
  async getOrdersByBookingId(bookingId: string): Promise<ParsedOrder[]> {
    // Shopify doesn't support direct custom attribute querying,
    // so we fetch recent orders and filter client-side
    // For better performance with many orders, consider storing
    // booking_id in order tags or notes
    const allOrders: ParsedOrder[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage) {
      const result = await this.getOrders({
        first: 100,
        after: cursor || undefined,
      });

      const matchingOrders = result.orders.filter(
        (order) =>
          order.customAttributes.bookingId === bookingId ||
          order.customAttributes.booking_id === bookingId
      );

      allOrders.push(...matchingOrders);
      hasNextPage = result.hasNextPage;
      cursor = result.endCursor;

      // Safety limit
      if (allOrders.length > 1000) break;
    }

    return allOrders;
  }

  /**
   * Get orders by event ID
   */
  async getOrdersByEventId(eventId: string): Promise<ParsedOrder[]> {
    const allOrders: ParsedOrder[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage) {
      const result = await this.getOrders({
        first: 100,
        after: cursor || undefined,
      });

      const matchingOrders = result.orders.filter(
        (order) =>
          order.customAttributes.eventId === eventId ||
          order.customAttributes.event_id === eventId
      );

      allOrders.push(...matchingOrders);
      hasNextPage = result.hasNextPage;
      cursor = result.endCursor;

      // Safety limit
      if (allOrders.length > 1000) break;
    }

    return allOrders;
  }

  /**
   * Get revenue statistics for an event
   */
  async getEventRevenue(eventId: string): Promise<EventRevenueStats> {
    const orders = await this.getOrdersByEventId(eventId);

    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const orderCount = orders.length;
    const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    // Calculate product breakdown
    const productBreakdown: Record<string, { quantity: number; revenue: number }> = {};

    for (const order of orders) {
      for (const item of order.lineItems) {
        const productType = item.productType || item.productTitle || 'Unknown';

        if (!productBreakdown[productType]) {
          productBreakdown[productType] = { quantity: 0, revenue: 0 };
        }

        productBreakdown[productType].quantity += item.quantity;
        productBreakdown[productType].revenue += item.total;
      }
    }

    return {
      eventId,
      totalRevenue,
      orderCount,
      averageOrderValue,
      productBreakdown,
    };
  }

  /**
   * Get a single order by ID
   */
  async getOrder(orderId: string): Promise<ParsedOrder | null> {
    const graphqlQuery = `
      query GetOrder($id: ID!) {
        order(id: $id) {
          id
          name
          createdAt
          totalPriceSet {
            shopMoney { amount currencyCode }
          }
          subtotalPriceSet {
            shopMoney { amount currencyCode }
          }
          totalTaxSet {
            shopMoney { amount currencyCode }
          }
          totalShippingPriceSet {
            shopMoney { amount currencyCode }
          }
          customAttributes {
            key
            value
          }
          displayFulfillmentStatus
          displayFinancialStatus
          lineItems(first: 50) {
            edges {
              node {
                name
                quantity
                originalTotalSet {
                  shopMoney { amount }
                }
                variant {
                  id
                  title
                  product {
                    title
                    productType
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.query<{ order: ShopifyOrder | null }>(graphqlQuery, {
      id: orderId,
    });

    if (!data.order) {
      return null;
    }

    return this.parseOrder(data.order);
  }

  /**
   * Parse a Shopify order into our simplified format
   */
  private parseOrder(shopifyOrder: ShopifyOrder): ParsedOrder {
    const customAttributes: Record<string, string> = {};
    for (const attr of shopifyOrder.customAttributes) {
      customAttributes[attr.key] = attr.value;
    }

    return {
      id: shopifyOrder.id,
      orderNumber: shopifyOrder.name,
      createdAt: shopifyOrder.createdAt,
      totalAmount: parseFloat(shopifyOrder.totalPriceSet.shopMoney.amount),
      subtotal: parseFloat(shopifyOrder.subtotalPriceSet?.shopMoney.amount || '0'),
      taxAmount: parseFloat(shopifyOrder.totalTaxSet?.shopMoney.amount || '0'),
      shippingAmount: parseFloat(
        shopifyOrder.totalShippingPriceSet?.shopMoney.amount || '0'
      ),
      currency: shopifyOrder.totalPriceSet.shopMoney.currencyCode,
      fulfillmentStatus: shopifyOrder.displayFulfillmentStatus,
      financialStatus: shopifyOrder.displayFinancialStatus,
      customAttributes,
      lineItems: shopifyOrder.lineItems.edges.map(({ node }) => ({
        name: node.name,
        quantity: node.quantity,
        total: parseFloat(node.originalTotalSet.shopMoney.amount),
        variantId: node.variant?.id,
        variantTitle: node.variant?.title,
        productTitle: node.variant?.product.title,
        productType: node.variant?.product.productType,
      })),
    };
  }

  /**
   * Test the connection to Shopify Admin API
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const graphqlQuery = `
        query {
          shop {
            name
            email
          }
        }
      `;

      const data = await this.query<{ shop: { name: string; email: string } }>(
        graphqlQuery
      );

      return {
        success: true,
        message: `Connected to Shopify store: ${data.shop.name} (${data.shop.email})`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const shopifyAdminService = new ShopifyAdminService();

// Export class for testing
export { ShopifyAdminService };
