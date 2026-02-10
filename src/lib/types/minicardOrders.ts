// src/lib/types/minicardOrders.ts

/**
 * Product combination within a minicard order event
 * e.g. "Minicard only" or "Minicard + T-Shirt + Hoodie"
 */
export interface ProductCombination {
  label: string;       // "Minicard only" or "Minicard + T-Shirt + Hoodie"
  order_count: number;
  minicard_qty: number;
}

/**
 * Pending minicard order event (aggregated view)
 */
export interface MinicardOrderEvent {
  event_id: string;
  event_record_id: string;
  school_name: string;
  event_date: string;
  deadline: string;              // event_date + 1 day
  days_until_due: number;        // negative = overdue
  is_overdue: boolean;
  total_minicard_count: number;  // sum of minicard quantities across all orders
  total_orders: number;          // orders containing at least one minicard
  combinations: ProductCombination[];
  r2_download_url?: string;      // signed URL if PDF exists, undefined if not
  task_record_id: string;        // for task completion
}

/**
 * API response for pending minicard orders
 */
export interface MinicardOrdersResponse {
  success: boolean;
  data?: {
    events: MinicardOrderEvent[];
  };
  error?: string;
}
