/**
 * Shopify Storefront API Service
 * Handles all communication with Shopify for product data and checkout creation
 */

import { Product, ProductVariant } from '../types/airtable';
import { CheckoutLineItem, CheckoutCustomAttributes, ShopifyCheckout } from '../types/shop';

class ShopifyService {
  private storefrontUrl: string;
  private storefrontAccessToken: string;
  private storeDomain: string;

  constructor() {
    this.storeDomain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || '';
    this.storefrontAccessToken = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN || '';
    this.storefrontUrl = `https://${this.storeDomain}/api/2024-01/graphql.json`;
  }

  /**
   * Executes a GraphQL query against Shopify Storefront API
   */
  private async query<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
    try {
      const response = await fetch(this.storefrontUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': this.storefrontAccessToken,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.statusText}`);
      }

      const json = await response.json();

      if (json.errors) {
        console.error('Shopify GraphQL errors:', json.errors);
        throw new Error(`GraphQL error: ${json.errors[0]?.message}`);
      }

      return json.data as T;
    } catch (error) {
      console.error('Shopify API request failed:', error);
      throw error;
    }
  }

  /**
   * Fetches all products from the shop, optionally filtered by tag
   */
  async getProducts(tagFilter?: string, first: number = 50): Promise<Product[]> {
    const query = `
      query GetProducts($first: Int!, $query: String) {
        products(first: $first, query: $query) {
          edges {
            node {
              id
              title
              description
              productType
              handle
              tags
              availableForSale
              images(first: 5) {
                edges {
                  node {
                    id
                    url
                    altText
                  }
                }
              }
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
                maxVariantPrice {
                  amount
                  currencyCode
                }
              }
              compareAtPriceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              variants(first: 50) {
                edges {
                  node {
                    id
                    title
                    availableForSale
                    quantityAvailable
                    price {
                      amount
                      currencyCode
                    }
                    compareAtPrice {
                      amount
                      currencyCode
                    }
                    image {
                      url
                      altText
                    }
                    selectedOptions {
                      name
                      value
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const variables: any = { first };

    // Add tag filter if provided
    if (tagFilter) {
      variables.query = `tag:${tagFilter}`;
    }

    const data = await this.query<{
      products: {
        edges: Array<{
          node: any;
        }>;
      };
    }>(query, variables);

    // Transform Shopify response to our Product type
    return data.products.edges.map((edge) => this.transformProduct(edge.node));
  }

  /**
   * Fetches a single product by handle (URL-friendly identifier)
   */
  async getProductByHandle(handle: string): Promise<Product | null> {
    const query = `
      query GetProductByHandle($handle: String!) {
        productByHandle(handle: $handle) {
          id
          title
          description
          productType
          handle
          tags
          availableForSale
          images(first: 10) {
            edges {
              node {
                id
                url
                altText
              }
            }
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
          compareAtPriceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                availableForSale
                quantityAvailable
                price {
                  amount
                  currencyCode
                }
                compareAtPrice {
                  amount
                  currencyCode
                }
                image {
                  url
                  altText
                }
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.query<{
      productByHandle: any | null;
    }>(query, { handle });

    if (!data.productByHandle) {
      return null;
    }

    return this.transformProduct(data.productByHandle);
  }

  /**
   * Creates a Shopify checkout with line items and custom attributes
   */
  async createCheckout(
    lineItems: CheckoutLineItem[],
    customAttributes?: CheckoutCustomAttributes
  ): Promise<ShopifyCheckout> {
    const query = `
      mutation CheckoutCreate($input: CheckoutCreateInput!) {
        checkoutCreate(input: $input) {
          checkout {
            id
            webUrl
          }
          checkoutUserErrors {
            code
            field
            message
          }
        }
      }
    `;

    // Transform line items to Shopify format
    const shopifyLineItems = lineItems.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
    }));

    // Prepare custom attributes if provided
    const shopifyCustomAttributes = customAttributes
      ? Object.entries(customAttributes)
          .filter(([_, value]) => value !== undefined)
          .map(([key, value]) => ({
            key,
            value: String(value),
          }))
      : [];

    const variables = {
      input: {
        lineItems: shopifyLineItems,
        customAttributes: shopifyCustomAttributes,
      },
    };

    const data = await this.query<{
      checkoutCreate: {
        checkout: {
          id: string;
          webUrl: string;
        } | null;
        checkoutUserErrors: Array<{
          code: string;
          field: string[];
          message: string;
        }>;
      };
    }>(query, variables);

    // Check for errors
    if (data.checkoutCreate.checkoutUserErrors.length > 0) {
      const errors = data.checkoutCreate.checkoutUserErrors;
      console.error('Shopify checkout creation errors:', errors);
      throw new Error(`Checkout error: ${errors[0].message}`);
    }

    if (!data.checkoutCreate.checkout) {
      throw new Error('Checkout creation failed: No checkout returned');
    }

    return {
      checkoutId: data.checkoutCreate.checkout.id,
      checkoutUrl: data.checkoutCreate.checkout.webUrl,
      webUrl: data.checkoutCreate.checkout.webUrl,
    };
  }

  /**
   * Retrieves an existing checkout by ID
   */
  async getCheckout(checkoutId: string): Promise<any> {
    const query = `
      query GetCheckout($checkoutId: ID!) {
        node(id: $checkoutId) {
          ... on Checkout {
            id
            webUrl
            completedAt
            lineItems(first: 50) {
              edges {
                node {
                  title
                  quantity
                  variant {
                    id
                    title
                    price {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
            subtotalPrice {
              amount
              currencyCode
            }
            totalTax {
              amount
              currencyCode
            }
            totalPrice {
              amount
              currencyCode
            }
          }
        }
      }
    `;

    const data = await this.query<{
      node: any;
    }>(query, { checkoutId });

    return data.node;
  }

  /**
   * Transforms Shopify product data to our Product type
   */
  private transformProduct(shopifyProduct: any): Product {
    return {
      id: shopifyProduct.id,
      title: shopifyProduct.title,
      description: shopifyProduct.description,
      productType: shopifyProduct.productType,
      handle: shopifyProduct.handle,
      tags: shopifyProduct.tags,
      availableForSale: shopifyProduct.availableForSale,
      images: shopifyProduct.images.edges.map((edge: any) => ({
        id: edge.node.id,
        url: edge.node.url,
        altText: edge.node.altText,
      })),
      priceRange: {
        minVariantPrice: {
          amount: shopifyProduct.priceRange.minVariantPrice.amount,
          currencyCode: shopifyProduct.priceRange.minVariantPrice.currencyCode,
        },
        maxVariantPrice: {
          amount: shopifyProduct.priceRange.maxVariantPrice.amount,
          currencyCode: shopifyProduct.priceRange.maxVariantPrice.currencyCode,
        },
      },
      compareAtPriceRange: shopifyProduct.compareAtPriceRange
        ? {
            minVariantPrice: {
              amount: shopifyProduct.compareAtPriceRange.minVariantPrice.amount,
              currencyCode: shopifyProduct.compareAtPriceRange.minVariantPrice.currencyCode,
            },
          }
        : undefined,
      variants: shopifyProduct.variants.edges.map((edge: any) => this.transformVariant(edge.node)),
    };
  }

  /**
   * Transforms Shopify variant data to our ProductVariant type
   */
  private transformVariant(shopifyVariant: any): ProductVariant {
    return {
      id: shopifyVariant.id,
      title: shopifyVariant.title,
      availableForSale: shopifyVariant.availableForSale,
      quantityAvailable: shopifyVariant.quantityAvailable,
      price: {
        amount: shopifyVariant.price.amount,
        currencyCode: shopifyVariant.price.currencyCode,
      },
      compareAtPrice: shopifyVariant.compareAtPrice
        ? {
            amount: shopifyVariant.compareAtPrice.amount,
            currencyCode: shopifyVariant.compareAtPrice.currencyCode,
          }
        : undefined,
      image: shopifyVariant.image
        ? {
            url: shopifyVariant.image.url,
            altText: shopifyVariant.image.altText,
          }
        : undefined,
      selectedOptions: shopifyVariant.selectedOptions,
    };
  }
}

// Export singleton instance
const shopifyService = new ShopifyService();
export default shopifyService;
