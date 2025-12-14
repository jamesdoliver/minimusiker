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
  schoolName?: string;
}

// Shopify checkout response
export interface ShopifyCheckout {
  checkoutId: string;
  checkoutUrl: string;
  webUrl: string;
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
