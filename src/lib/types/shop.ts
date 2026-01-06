/**
 * Shop-specific type definitions for MiniMusiker parent portal shop
 */

import { Product, ProductVariant } from './airtable';

// Cart item with selected variant and quantity
export interface CartItem {
  product: Product;
  variant: ProductVariant;
  quantity: number;
  selectedOptions: Record<string, string>; // e.g., { "Size": "M", "Color": "Blue" }
}

// Shopping cart state
export interface Cart {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}

// Product categories for shop organization
export interface ShopCategory {
  name: string;
  handle: string;
  description: string;
  icon?: string;
}

// Product selection state (for add to cart flow)
export interface ProductSelection {
  variantId: string | null;
  quantity: number;
  selectedOptions: Record<string, string>;
}

// Checkout line item format for Shopify API
export interface CheckoutLineItem {
  variantId: string;
  quantity: number;
}

// Checkout custom attributes
export interface CheckoutCustomAttributes {
  parentId: string;
  parentEmail: string;
  eventId?: string;
  classId?: string;
  schoolName?: string;
}

// Shopify checkout response (legacy - kept for backward compatibility)
export interface ShopifyCheckout {
  checkoutId: string;
  checkoutUrl: string;
  webUrl: string;
}

// ======================================================================
// Cart API Types (Modern Shopify API - 2025)
// ======================================================================

// Cart line item for creating/updating cart
export interface CartLineInput {
  merchandiseId: string; // Product variant ID
  quantity: number;
}

// Cart attribute (custom data attached to cart/order)
export interface CartAttribute {
  key: string;
  value: string;
}

// Buyer identity for cart
export interface CartBuyerIdentity {
  email?: string;
  phone?: string;
  countryCode?: string;
}

// Cart creation input
export interface CartCreateInput {
  lines: CartLineInput[];
  attributes?: CartAttribute[];
  buyerIdentity?: CartBuyerIdentity;
}

// Custom attributes for MiniMusiker orders
export interface MiniMusikerCartAttributes {
  parentId: string;
  parentEmail: string;
  eventId?: string;
  classId?: string;
  bookingId?: string;
  schoolName?: string;
}

// Cart line item from API response
export interface ShopifyCartLine {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    product: {
      title: string;
    };
    price: {
      amount: string;
      currencyCode: string;
    };
  };
}

// Cart response from Shopify
export interface ShopifyCart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    totalAmount: {
      amount: string;
      currencyCode: string;
    };
    subtotalAmount: {
      amount: string;
      currencyCode: string;
    };
  };
  lines: {
    edges: Array<{
      node: ShopifyCartLine;
    }>;
  };
  attributes: CartAttribute[];
  buyerIdentity?: {
    email?: string;
  };
}

// Result of cart creation
export interface CartCreateResult {
  cartId: string;
  checkoutUrl: string;
  totalQuantity: number;
  totalAmount: number;
  currency: string;
}

// Filter and sort options for product catalog
export type ProductSortOption = 'title-asc' | 'title-desc' | 'price-asc' | 'price-desc' | 'newest';

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  availableOnly?: boolean;
}
