// src/lib/types/clothingOrders.ts

import { ClothingType } from '@/lib/config/clothingVariants';

/**
 * Aggregated clothing items by size
 */
export interface AggregatedClothingItems {
  tshirts: Record<string, number>;  // size -> quantity
  hoodies: Record<string, number>;  // size -> quantity
}

/**
 * Individual clothing item in an order
 */
export interface ClothingItem {
  type: ClothingType;
  size: string;
  quantity: number;
}

/**
 * Pending clothing order event (aggregated view)
 */
export interface ClothingOrderEvent {
  event_id: string;
  event_record_id: string;
  school_name: string;
  event_date: string;
  days_until_order_day: number;  // negative = overdue
  is_overdue: boolean;
  total_orders: number;
  total_revenue: number;
  aggregated_items: AggregatedClothingItems;
  order_ids: string[];  // Airtable record IDs
}

/**
 * Individual order for modal display
 */
export interface ClothingOrderDetail {
  order_id: string;
  order_number: string;
  order_date: string;
  total_amount: number;
  parent_name: string;
  child_names: string[];
  clothing_items: ClothingItem[];
}

/**
 * API response for pending clothing orders
 */
export interface ClothingOrdersResponse {
  success: boolean;
  data?: {
    events: ClothingOrderEvent[];
  };
  error?: string;
}

/**
 * API response for individual orders
 */
export interface ClothingOrderDetailsResponse {
  success: boolean;
  data?: {
    orders: ClothingOrderDetail[];
  };
  error?: string;
}

/**
 * Request body for completing a clothing order
 */
export interface CompleteClothingOrderRequest {
  amount: number;
  notes?: string;
  order_ids: string[];
}

/**
 * Response for completing a clothing order
 */
export interface CompleteClothingOrderResponse {
  success: boolean;
  data?: {
    task_id: string;
    go_id: string;
  };
  error?: string;
}
