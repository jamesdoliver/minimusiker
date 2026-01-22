# Clothing Order Tasks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a clothing order task view that aggregates Shopify clothing orders by event and surfaces them 18 days before the event date.

**Architecture:** On-demand aggregation queries Orders table, filters by clothing variant IDs, groups by event, and calculates urgency from event dates. No new Airtable tables - uses existing Orders, Events, Tasks, and GuesstimateOrders tables.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, Airtable, Cloudflare R2

---

## Task 1: Create Clothing Variants Config

**Files:**
- Create: `src/lib/config/clothingVariants.ts`

**Step 1: Create the clothing variants mapping file**

```typescript
// src/lib/config/clothingVariants.ts

/**
 * Mapping of Shopify variant IDs to clothing item type and size
 * Used to filter and categorize clothing items from order line_items
 */

export type ClothingType = 'tshirt' | 'hoodie';

export interface ClothingVariant {
  type: ClothingType;
  size: string;
}

export const CLOTHING_VARIANTS: Record<string, ClothingVariant> = {
  // T-Shirt (Personalisiert) - Product ID: 10663662747994
  '53328502194522': { type: 'tshirt', size: '98/104' },
  '53328502227290': { type: 'tshirt', size: '110/116' },
  '53328502260058': { type: 'tshirt', size: '122/128' },
  '53328502292826': { type: 'tshirt', size: '134/146' },
  '53328502325594': { type: 'tshirt', size: '152/164' },
  // Hoodie (Personalisiert) - Product ID: 10664195916122
  '53328494788954': { type: 'hoodie', size: '116' },
  '53328494821722': { type: 'hoodie', size: '128' },
  '53328494854490': { type: 'hoodie', size: '140' },
  '53328494887258': { type: 'hoodie', size: '152' },
  '53328494920026': { type: 'hoodie', size: '164' },
};

// All clothing variant IDs for quick lookup
export const CLOTHING_VARIANT_IDS = Object.keys(CLOTHING_VARIANTS);

// T-Shirt sizes in display order
export const TSHIRT_SIZES = ['98/104', '110/116', '122/128', '134/146', '152/164'];

// Hoodie sizes in display order
export const HOODIE_SIZES = ['116', '128', '140', '152', '164'];

/**
 * Check if a variant ID is a clothing item
 */
export function isClothingVariant(variantId: string): boolean {
  // Handle both full Shopify GID format and numeric-only format
  const numericId = variantId.replace(/^gid:\/\/shopify\/ProductVariant\//, '');
  return numericId in CLOTHING_VARIANTS;
}

/**
 * Get clothing details for a variant ID
 */
export function getClothingDetails(variantId: string): ClothingVariant | null {
  const numericId = variantId.replace(/^gid:\/\/shopify\/ProductVariant\//, '');
  return CLOTHING_VARIANTS[numericId] || null;
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/jamesoliver/WebstormProjects/MiniMusiker/.worktrees/clothing-order-tasks && npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/config/clothingVariants.ts
git commit -m "feat: add clothing variants config for Shopify product mapping"
```

---

## Task 2: Create Clothing Orders Types

**Files:**
- Create: `src/lib/types/clothingOrders.ts`

**Step 1: Create the types file**

```typescript
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
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/types/clothingOrders.ts
git commit -m "feat: add TypeScript types for clothing orders feature"
```

---

## Task 3: Create Clothing Orders Service

**Files:**
- Create: `src/lib/services/clothingOrdersService.ts`

**Step 1: Create the service file**

```typescript
// src/lib/services/clothingOrdersService.ts

import { getAirtableService } from './airtableService';
import { getTaskService } from './taskService';
import {
  CLOTHING_VARIANTS,
  CLOTHING_VARIANT_IDS,
  isClothingVariant,
  getClothingDetails,
  TSHIRT_SIZES,
  HOODIE_SIZES,
} from '@/lib/config/clothingVariants';
import {
  ClothingOrderEvent,
  ClothingOrderDetail,
  AggregatedClothingItems,
  ClothingItem,
} from '@/lib/types/clothingOrders';
import {
  ORDERS_TABLE_ID,
  ORDERS_FIELD_IDS,
  EVENTS_TABLE_ID,
  EVENTS_FIELD_IDS,
  TASKS_TABLE_ID,
  TASKS_FIELD_IDS,
  REGISTRATIONS_TABLE_ID,
  REGISTRATIONS_FIELD_IDS,
  PARENTS_TABLE_ID,
  PARENTS_FIELD_IDS,
} from '@/lib/types/airtable';
import { ShopifyOrderLineItem } from '@/lib/types/airtable';

// Order Day is 18 days before event
const ORDER_DAY_OFFSET = 18;
// Show cards 3 days before Order Day (21 days before event)
const VISIBILITY_WINDOW_DAYS = 21;

class ClothingOrdersService {
  private airtable = getAirtableService();

  /**
   * Get all pending clothing order events within the visibility window
   */
  async getPendingClothingOrders(): Promise<ClothingOrderEvent[]> {
    const base = this.airtable.getBase();
    const ordersTable = base(ORDERS_TABLE_ID);
    const eventsTable = base(EVENTS_TABLE_ID);
    const tasksTable = base(TASKS_TABLE_ID);

    // Calculate visibility threshold (events within 21 days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const visibilityThreshold = new Date(today);
    visibilityThreshold.setDate(today.getDate() + VISIBILITY_WINDOW_DAYS);

    // Get all events within visibility window or past (for overdue)
    const events = await eventsTable
      .select({
        filterByFormula: `IS_BEFORE({${EVENTS_FIELD_IDS.event_date}}, '${visibilityThreshold.toISOString().split('T')[0]}')`,
      })
      .all();

    // Get completed clothing_order tasks to exclude
    const completedTasks = await tasksTable
      .select({
        filterByFormula: `AND(
          {${TASKS_FIELD_IDS.task_type}} = 'clothing_order',
          {${TASKS_FIELD_IDS.status}} = 'completed'
        )`,
      })
      .all();

    const completedEventIds = new Set(
      completedTasks.map((t) => {
        const eventIds = t.get(TASKS_FIELD_IDS.event_id) as string[] | undefined;
        return eventIds?.[0];
      }).filter(Boolean)
    );

    // Get all orders and filter by clothing items
    const allOrders = await ordersTable.select().all();

    // Group orders by event
    const ordersByEvent = new Map<string, {
      orders: typeof allOrders;
      eventRecordId: string;
    }>();

    for (const order of allOrders) {
      const lineItemsJson = order.get(ORDERS_FIELD_IDS.line_items) as string;
      if (!lineItemsJson) continue;

      let lineItems: ShopifyOrderLineItem[];
      try {
        lineItems = JSON.parse(lineItemsJson);
      } catch {
        continue;
      }

      // Check if order has any clothing items
      const hasClothing = lineItems.some((item) => isClothingVariant(item.variant_id));
      if (!hasClothing) continue;

      const eventIds = order.get(ORDERS_FIELD_IDS.event_id) as string[] | undefined;
      const eventRecordId = eventIds?.[0];
      if (!eventRecordId) continue;

      // Skip if this event already has a completed clothing task
      if (completedEventIds.has(eventRecordId)) continue;

      if (!ordersByEvent.has(eventRecordId)) {
        ordersByEvent.set(eventRecordId, { orders: [], eventRecordId });
      }
      ordersByEvent.get(eventRecordId)!.orders.push(order);
    }

    // Build ClothingOrderEvent for each event with orders
    const clothingOrderEvents: ClothingOrderEvent[] = [];

    for (const event of events) {
      const eventRecordId = event.id;
      const eventData = ordersByEvent.get(eventRecordId);
      if (!eventData || eventData.orders.length === 0) continue;

      const eventId = event.get(EVENTS_FIELD_IDS.event_id) as string;
      const schoolName = event.get(EVENTS_FIELD_IDS.school_name) as string;
      const eventDate = event.get(EVENTS_FIELD_IDS.event_date) as string;

      // Calculate days until Order Day
      const eventDateObj = new Date(eventDate);
      eventDateObj.setHours(0, 0, 0, 0);
      const orderDay = new Date(eventDateObj);
      orderDay.setDate(eventDateObj.getDate() - ORDER_DAY_OFFSET);

      const diffTime = orderDay.getTime() - today.getTime();
      const daysUntilOrderDay = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const isOverdue = daysUntilOrderDay < 0;

      // Aggregate items and calculate totals
      const aggregatedItems: AggregatedClothingItems = {
        tshirts: Object.fromEntries(TSHIRT_SIZES.map((s) => [s, 0])),
        hoodies: Object.fromEntries(HOODIE_SIZES.map((s) => [s, 0])),
      };
      let totalRevenue = 0;
      const orderIds: string[] = [];

      for (const order of eventData.orders) {
        orderIds.push(order.id);
        const lineItemsJson = order.get(ORDERS_FIELD_IDS.line_items) as string;
        const lineItems: ShopifyOrderLineItem[] = JSON.parse(lineItemsJson);

        for (const item of lineItems) {
          const details = getClothingDetails(item.variant_id);
          if (!details) continue;

          totalRevenue += item.total;

          if (details.type === 'tshirt') {
            aggregatedItems.tshirts[details.size] =
              (aggregatedItems.tshirts[details.size] || 0) + item.quantity;
          } else {
            aggregatedItems.hoodies[details.size] =
              (aggregatedItems.hoodies[details.size] || 0) + item.quantity;
          }
        }
      }

      clothingOrderEvents.push({
        event_id: eventId,
        event_record_id: eventRecordId,
        school_name: schoolName,
        event_date: eventDate,
        days_until_order_day: daysUntilOrderDay,
        is_overdue: isOverdue,
        total_orders: eventData.orders.length,
        total_revenue: totalRevenue,
        aggregated_items: aggregatedItems,
        order_ids: orderIds,
      });
    }

    // Sort by urgency (overdue first, then by days remaining ascending)
    clothingOrderEvents.sort((a, b) => {
      if (a.is_overdue !== b.is_overdue) {
        return a.is_overdue ? -1 : 1;
      }
      return a.days_until_order_day - b.days_until_order_day;
    });

    return clothingOrderEvents;
  }

  /**
   * Get individual orders for an event (for modal display)
   */
  async getOrdersForEvent(eventRecordId: string): Promise<ClothingOrderDetail[]> {
    const base = this.airtable.getBase();
    const ordersTable = base(ORDERS_TABLE_ID);
    const registrationsTable = base(REGISTRATIONS_TABLE_ID);
    const parentsTable = base(PARENTS_TABLE_ID);

    // Get orders for this event
    const orders = await ordersTable
      .select({
        filterByFormula: `SEARCH('${eventRecordId}', ARRAYJOIN({${ORDERS_FIELD_IDS.event_id}}))`,
      })
      .all();

    const orderDetails: ClothingOrderDetail[] = [];

    for (const order of orders) {
      const lineItemsJson = order.get(ORDERS_FIELD_IDS.line_items) as string;
      if (!lineItemsJson) continue;

      let lineItems: ShopifyOrderLineItem[];
      try {
        lineItems = JSON.parse(lineItemsJson);
      } catch {
        continue;
      }

      // Filter to clothing items only
      const clothingItems: ClothingItem[] = [];
      for (const item of lineItems) {
        const details = getClothingDetails(item.variant_id);
        if (details) {
          clothingItems.push({
            type: details.type,
            size: details.size,
            quantity: item.quantity,
          });
        }
      }

      if (clothingItems.length === 0) continue;

      // Get parent info
      const parentIds = order.get(ORDERS_FIELD_IDS.parent_id) as string[] | undefined;
      let parentName = 'Unknown';
      if (parentIds?.[0]) {
        try {
          const parent = await parentsTable.find(parentIds[0]);
          parentName = parent.get(PARENTS_FIELD_IDS.parent_first_name) as string || 'Unknown';
        } catch {
          // Ignore if parent not found
        }
      }

      // Get child names from registrations
      const childNames: string[] = [];
      const classIds = order.get(ORDERS_FIELD_IDS.class_id) as string[] | undefined;
      if (classIds?.[0] && parentIds?.[0]) {
        try {
          const registrations = await registrationsTable
            .select({
              filterByFormula: `AND(
                SEARCH('${parentIds[0]}', ARRAYJOIN({${REGISTRATIONS_FIELD_IDS.parent_id}})),
                SEARCH('${classIds[0]}', ARRAYJOIN({${REGISTRATIONS_FIELD_IDS.class_id}}))
              )`,
            })
            .all();

          for (const reg of registrations) {
            const childName = reg.get(REGISTRATIONS_FIELD_IDS.registered_child) as string;
            if (childName) childNames.push(childName);
          }
        } catch {
          // Ignore if registrations not found
        }
      }

      // Calculate clothing-only total
      let clothingTotal = 0;
      for (const item of lineItems) {
        if (isClothingVariant(item.variant_id)) {
          clothingTotal += item.total;
        }
      }

      orderDetails.push({
        order_id: order.id,
        order_number: order.get(ORDERS_FIELD_IDS.order_number) as string || '',
        order_date: order.get(ORDERS_FIELD_IDS.order_date) as string || '',
        total_amount: clothingTotal,
        parent_name: parentName,
        child_names: childNames.length > 0 ? childNames : ['Unknown'],
        clothing_items: clothingItems,
      });
    }

    // Sort by order date (newest first)
    orderDetails.sort((a, b) =>
      new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
    );

    return orderDetails;
  }

  /**
   * Complete a clothing order (create task + GO-ID)
   */
  async completeClothingOrder(
    eventRecordId: string,
    amount: number,
    notes: string | undefined,
    orderIds: string[],
    adminEmail: string
  ): Promise<{ taskId: string; goId: string }> {
    const taskService = getTaskService();
    const base = this.airtable.getBase();
    const tasksTable = base(TASKS_TABLE_ID);
    const eventsTable = base(EVENTS_TABLE_ID);

    // Get event details
    const event = await eventsTable.find(eventRecordId);
    const eventId = event.get(EVENTS_FIELD_IDS.event_id) as string;
    const schoolName = event.get(EVENTS_FIELD_IDS.school_name) as string;

    // Get aggregated items for GO-ID contains field
    const orderDetails = await this.getOrdersForEvent(eventRecordId);
    const aggregatedItems: { sku: string; name: string; quantity: number }[] = [];

    const itemCounts = new Map<string, number>();
    for (const order of orderDetails) {
      for (const item of order.clothing_items) {
        const key = `${item.type}-${item.size}`;
        itemCounts.set(key, (itemCounts.get(key) || 0) + item.quantity);
      }
    }

    for (const [key, quantity] of itemCounts) {
      const [type, size] = key.split('-');
      aggregatedItems.push({
        sku: key,
        name: `${type === 'tshirt' ? 'T-Shirt' : 'Hoodie'} (${size})`,
        quantity,
      });
    }

    // Create GuesstimateOrder
    const goOrder = await taskService.createGuesstimateOrder({
      event_id: eventRecordId,
      order_ids: orderIds.join(','),
      order_date: new Date().toISOString().split('T')[0],
      order_amount: amount,
      contains: aggregatedItems,
    });

    // Create completed task
    const completionData = JSON.stringify({
      amount,
      notes: notes || undefined,
    });

    const taskRecord = await tasksTable.create({
      [TASKS_FIELD_IDS.template_id]: 'clothing_order',
      [TASKS_FIELD_IDS.event_id]: [eventRecordId],
      [TASKS_FIELD_IDS.task_type]: 'clothing_order',
      [TASKS_FIELD_IDS.task_name]: `Clothing Order - ${schoolName}`,
      [TASKS_FIELD_IDS.description]: `Clothing order for ${schoolName}`,
      [TASKS_FIELD_IDS.completion_type]: 'monetary',
      [TASKS_FIELD_IDS.timeline_offset]: -ORDER_DAY_OFFSET,
      [TASKS_FIELD_IDS.deadline]: new Date().toISOString().split('T')[0],
      [TASKS_FIELD_IDS.status]: 'completed',
      [TASKS_FIELD_IDS.completed_at]: new Date().toISOString(),
      [TASKS_FIELD_IDS.completed_by]: adminEmail,
      [TASKS_FIELD_IDS.completion_data]: completionData,
      [TASKS_FIELD_IDS.go_id]: [goOrder.id],
      [TASKS_FIELD_IDS.order_ids]: orderIds.join(','),
      [TASKS_FIELD_IDS.created_at]: new Date().toISOString(),
    });

    return {
      taskId: taskRecord.id,
      goId: goOrder.id,
    };
  }
}

// Singleton
let clothingOrdersServiceInstance: ClothingOrdersService | null = null;

export function getClothingOrdersService(): ClothingOrdersService {
  if (!clothingOrdersServiceInstance) {
    clothingOrdersServiceInstance = new ClothingOrdersService();
  }
  return clothingOrdersServiceInstance;
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/services/clothingOrdersService.ts
git commit -m "feat: add clothing orders service for aggregation and completion"
```

---

## Task 4: Create GET Pending Clothing Orders API

**Files:**
- Create: `src/app/api/admin/tasks/clothing-orders/route.ts`

**Step 1: Create the API route**

```typescript
// src/app/api/admin/tasks/clothing-orders/route.ts

import { NextResponse } from 'next/server';
import { getClothingOrdersService } from '@/lib/services/clothingOrdersService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/clothing-orders
 * Get all pending clothing order events within visibility window
 */
export async function GET() {
  try {
    const clothingOrdersService = getClothingOrdersService();
    const events = await clothingOrdersService.getPendingClothingOrders();

    return NextResponse.json({
      success: true,
      data: { events },
    });
  } catch (error) {
    console.error('Error fetching clothing orders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch clothing orders' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/admin/tasks/clothing-orders/route.ts
git commit -m "feat: add GET endpoint for pending clothing orders"
```

---

## Task 5: Create GET Orders for Event API

**Files:**
- Create: `src/app/api/admin/tasks/clothing-orders/[eventId]/orders/route.ts`

**Step 1: Create the directory structure and API route**

```typescript
// src/app/api/admin/tasks/clothing-orders/[eventId]/orders/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getClothingOrdersService } from '@/lib/services/clothingOrdersService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/clothing-orders/[eventId]/orders
 * Get individual orders for an event (for modal display)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    const clothingOrdersService = getClothingOrdersService();
    const orders = await clothingOrdersService.getOrdersForEvent(eventId);

    return NextResponse.json({
      success: true,
      data: { orders },
    });
  } catch (error) {
    console.error('Error fetching orders for event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/admin/tasks/clothing-orders/\[eventId\]/orders/route.ts
git commit -m "feat: add GET endpoint for individual orders by event"
```

---

## Task 6: Create POST Complete Clothing Order API

**Files:**
- Create: `src/app/api/admin/tasks/clothing-orders/[eventId]/complete/route.ts`

**Step 1: Create the API route**

```typescript
// src/app/api/admin/tasks/clothing-orders/[eventId]/complete/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getClothingOrdersService } from '@/lib/services/clothingOrdersService';
import { CompleteClothingOrderRequest } from '@/lib/types/clothingOrders';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/tasks/clothing-orders/[eventId]/complete
 * Mark a clothing order as complete
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    const body: CompleteClothingOrderRequest = await request.json();

    if (typeof body.amount !== 'number' || body.amount < 0) {
      return NextResponse.json(
        { success: false, error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.order_ids) || body.order_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Order IDs are required' },
        { status: 400 }
      );
    }

    // TODO: Get admin email from session
    const adminEmail = 'admin@minimusiker.de';

    const clothingOrdersService = getClothingOrdersService();
    const result = await clothingOrdersService.completeClothingOrder(
      eventId,
      body.amount,
      body.notes,
      body.order_ids,
      adminEmail
    );

    return NextResponse.json({
      success: true,
      data: {
        task_id: result.taskId,
        go_id: result.goId,
      },
    });
  } catch (error) {
    console.error('Error completing clothing order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to complete clothing order' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/admin/tasks/clothing-orders/\[eventId\]/complete/route.ts
git commit -m "feat: add POST endpoint for completing clothing orders"
```

---

## Task 7: Create ClothingOrderCard Component

**Files:**
- Create: `src/components/admin/tasks/ClothingOrderCard.tsx`

**Step 1: Create the accordion card component**

```typescript
// src/components/admin/tasks/ClothingOrderCard.tsx

'use client';

import { useState } from 'react';
import { ClothingOrderEvent } from '@/lib/types/clothingOrders';
import { TSHIRT_SIZES, HOODIE_SIZES } from '@/lib/config/clothingVariants';

interface ClothingOrderCardProps {
  event: ClothingOrderEvent;
  onViewOrders: (event: ClothingOrderEvent) => void;
  onMarkComplete: (event: ClothingOrderEvent) => void;
}

export default function ClothingOrderCard({
  event,
  onViewOrders,
  onMarkComplete,
}: ClothingOrderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate urgency styling
  const getUrgencyBadge = () => {
    if (event.is_overdue) {
      const daysOverdue = Math.abs(event.days_until_order_day);
      return {
        text: `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`,
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        borderColor: 'border-red-300',
      };
    }
    if (event.days_until_order_day === 0) {
      return {
        text: 'Order Day',
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-800',
        borderColor: 'border-orange-300',
      };
    }
    return {
      text: `${event.days_until_order_day} day${event.days_until_order_day !== 1 ? 's' : ''}`,
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-700',
      borderColor: 'border-gray-200',
    };
  };

  const urgency = getUrgencyBadge();
  const cardBorderColor = event.is_overdue ? 'border-red-400' : 'border-gray-200';

  // Calculate totals
  const totalTshirts = Object.values(event.aggregated_items.tshirts).reduce((a, b) => a + b, 0);
  const totalHoodies = Object.values(event.aggregated_items.hoodies).reduce((a, b) => a + b, 0);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border-2 ${cardBorderColor} overflow-hidden`}>
      {/* Urgency Badge */}
      <div className={`px-4 py-2 ${urgency.bgColor} ${urgency.borderColor} border-b`}>
        <span className={`text-sm font-medium ${urgency.textColor}`}>
          {urgency.text}
        </span>
      </div>

      {/* Header Row (Always Visible) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">
              {event.school_name}
            </h3>
            <span className="text-sm text-gray-500">
              Event: {formatDate(event.event_date)}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {event.total_orders} order{event.total_orders !== 1 ? 's' : ''} - {formatCurrency(event.total_revenue)} revenue
          </p>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 ml-4 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Expanded Content */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? 'max-h-[500px]' : 'max-h-0'
        }`}
      >
        <div className="px-4 pb-4 border-t border-gray-100">
          {/* Item Breakdown */}
          <div className="grid grid-cols-2 gap-6 mt-4">
            {/* T-Shirts Column */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">
                T-Shirts
              </h4>
              <div className="space-y-1">
                {TSHIRT_SIZES.map((size) => (
                  <div key={size} className="flex justify-between text-sm">
                    <span className="text-gray-600">{size}:</span>
                    <span className="font-medium text-gray-900">
                      {event.aggregated_items.tshirts[size] || 0}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold pt-2 border-t mt-2">
                  <span className="text-gray-700">Total:</span>
                  <span className="text-gray-900">{totalTshirts}</span>
                </div>
              </div>
            </div>

            {/* Hoodies Column */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">
                Hoodies
              </h4>
              <div className="space-y-1">
                {HOODIE_SIZES.map((size) => (
                  <div key={size} className="flex justify-between text-sm">
                    <span className="text-gray-600">{size}:</span>
                    <span className="font-medium text-gray-900">
                      {event.aggregated_items.hoodies[size] || 0}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold pt-2 border-t mt-2">
                  <span className="text-gray-700">Total:</span>
                  <span className="text-gray-900">{totalHoodies}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewOrders(event);
              }}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              View Order List
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkComplete(event);
              }}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#94B8B3] rounded-lg hover:bg-[#7da39e] transition-colors"
            >
              Mark Complete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/admin/tasks/ClothingOrderCard.tsx
git commit -m "feat: add ClothingOrderCard accordion component"
```

---

## Task 8: Create ClothingOrderListModal Component

**Files:**
- Create: `src/components/admin/tasks/ClothingOrderListModal.tsx`

**Step 1: Create the modal component**

```typescript
// src/components/admin/tasks/ClothingOrderListModal.tsx

'use client';

import { useState, useEffect, useMemo } from 'react';
import { ClothingOrderEvent, ClothingOrderDetail } from '@/lib/types/clothingOrders';

interface ClothingOrderListModalProps {
  event: ClothingOrderEvent;
  isOpen: boolean;
  onClose: () => void;
}

export default function ClothingOrderListModal({
  event,
  isOpen,
  onClose,
}: ClothingOrderListModalProps) {
  const [orders, setOrders] = useState<ClothingOrderDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch orders when modal opens
  useEffect(() => {
    if (isOpen && event) {
      fetchOrders();
    }
  }, [isOpen, event]);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/tasks/clothing-orders/${event.event_record_id}/orders`
      );
      const data = await response.json();
      if (data.success) {
        setOrders(data.data.orders);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter orders based on search
  const filteredOrders = useMemo(() => {
    if (!searchQuery) return orders;
    const query = searchQuery.toLowerCase();
    return orders.filter(
      (order) =>
        order.order_number.toLowerCase().includes(query) ||
        order.parent_name.toLowerCase().includes(query) ||
        order.child_names.some((name) => name.toLowerCase().includes(query))
    );
  }, [orders, searchQuery]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Clothing Orders - {event.school_name}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Event: {formatDate(event.event_date)} - {event.total_orders} orders - {formatCurrency(event.total_revenue)} total
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className="mt-4">
              <input
                type="text"
                placeholder="Search by name or order #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#94B8B3] focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#94B8B3]"></div>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? 'No orders match your search' : 'No orders found'}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <div
                    key={order.order_id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium text-gray-900">
                          #{order.order_number}
                        </span>
                        <span className="text-gray-500 mx-2">-</span>
                        <span className="text-gray-600">
                          {formatDate(order.order_date)}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(order.total_amount)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700 mt-2">
                      {order.parent_name} → {order.child_names.join(', ')}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {order.clothing_items.map((item, idx) => (
                        <span key={idx}>
                          {idx > 0 && ', '}
                          {item.type === 'tshirt' ? 'T-Shirt' : 'Hoodie'} ({item.size}) x{item.quantity}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/admin/tasks/ClothingOrderListModal.tsx
git commit -m "feat: add ClothingOrderListModal for viewing individual orders"
```

---

## Task 9: Create ClothingOrderCompletionModal Component

**Files:**
- Create: `src/components/admin/tasks/ClothingOrderCompletionModal.tsx`

**Step 1: Create the completion modal component**

```typescript
// src/components/admin/tasks/ClothingOrderCompletionModal.tsx

'use client';

import { useState, useEffect } from 'react';
import { ClothingOrderEvent } from '@/lib/types/clothingOrders';

interface ClothingOrderCompletionModalProps {
  event: ClothingOrderEvent;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export default function ClothingOrderCompletionModal({
  event,
  isOpen,
  onClose,
  onComplete,
}: ClothingOrderCompletionModalProps) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setNotes('');
      setError(null);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isSubmitting, onClose]);

  // Calculate totals
  const totalTshirts = Object.values(event.aggregated_items.tshirts).reduce((a, b) => a + b, 0);
  const totalHoodies = Object.values(event.aggregated_items.hoodies).reduce((a, b) => a + b, 0);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleSubmit = async () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 0) {
      setError('Please enter a valid amount');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/tasks/clothing-orders/${event.event_record_id}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: amountNum,
            notes: notes || undefined,
            order_ids: event.order_ids,
          }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to complete order');
      }

      onComplete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete order');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={() => !isSubmitting && onClose()}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Complete Clothing Order
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {event.school_name} - {formatDate(event.event_date)}
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {/* Order Summary */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Order Summary</h3>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">T-Shirts:</span>
                  <span className="font-medium">{totalTshirts} items</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Hoodies:</span>
                  <span className="font-medium">{totalHoodies} items</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-600">Customer Revenue:</span>
                  <span className="font-medium">{formatCurrency(event.total_revenue)}</span>
                </div>
              </div>
            </div>

            {/* Amount Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier Order Cost (EUR) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={isSubmitting}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#94B8B3] focus:border-transparent outline-none disabled:opacity-50"
              />
            </div>

            {/* Notes Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this order..."
                disabled={isSubmitting}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#94B8B3] focus:border-transparent outline-none resize-none disabled:opacity-50"
              />
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-medium mb-1">This will create:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>GO-ID for supplier order tracking</li>
                <li>Task record in Completed Tasks</li>
              </ul>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !amount}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#94B8B3] rounded-lg hover:bg-[#7da39e] transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                'Complete Order'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/admin/tasks/ClothingOrderCompletionModal.tsx
git commit -m "feat: add ClothingOrderCompletionModal for marking orders complete"
```

---

## Task 10: Create ClothingOrdersView Container

**Files:**
- Create: `src/components/admin/tasks/ClothingOrdersView.tsx`

**Step 1: Create the container component**

```typescript
// src/components/admin/tasks/ClothingOrdersView.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClothingOrderEvent } from '@/lib/types/clothingOrders';
import ClothingOrderCard from './ClothingOrderCard';
import ClothingOrderListModal from './ClothingOrderListModal';
import ClothingOrderCompletionModal from './ClothingOrderCompletionModal';

interface ClothingOrdersViewProps {
  isActive: boolean;  // Only fetch when this tab is active
}

export default function ClothingOrdersView({ isActive }: ClothingOrdersViewProps) {
  const [events, setEvents] = useState<ClothingOrderEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ClothingOrderEvent | null>(null);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);

  const fetchClothingOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/tasks/clothing-orders');
      const data = await response.json();
      if (data.success) {
        setEvents(data.data.events);
      } else {
        throw new Error(data.error || 'Failed to fetch clothing orders');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clothing orders');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch when tab becomes active
  useEffect(() => {
    if (isActive) {
      fetchClothingOrders();
    }
  }, [isActive, fetchClothingOrders]);

  const handleViewOrders = (event: ClothingOrderEvent) => {
    setSelectedEvent(event);
    setIsListModalOpen(true);
  };

  const handleMarkComplete = (event: ClothingOrderEvent) => {
    setSelectedEvent(event);
    setIsCompletionModalOpen(true);
  };

  const handleCompletionSuccess = () => {
    fetchClothingOrders();
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow-sm border border-gray-200 h-48 animate-pulse"
          >
            <div className="h-10 bg-gray-100 border-b"></div>
            <div className="p-4 space-y-3">
              <div className="h-4 bg-gray-100 rounded w-3/4"></div>
              <div className="h-3 bg-gray-100 rounded w-full"></div>
              <div className="h-3 bg-gray-100 rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Error: {error}</p>
        <button
          onClick={fetchClothingOrders}
          className="mt-2 text-sm text-red-700 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="text-5xl mb-4">👕</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No Pending Clothing Orders
        </h3>
        <p className="text-gray-600">
          Clothing orders will appear here 3 days before their Order Day (18 days before event).
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((event) => (
          <ClothingOrderCard
            key={event.event_record_id}
            event={event}
            onViewOrders={handleViewOrders}
            onMarkComplete={handleMarkComplete}
          />
        ))}
      </div>

      {/* Order List Modal */}
      {selectedEvent && (
        <ClothingOrderListModal
          event={selectedEvent}
          isOpen={isListModalOpen}
          onClose={() => {
            setIsListModalOpen(false);
            setSelectedEvent(null);
          }}
        />
      )}

      {/* Completion Modal */}
      {selectedEvent && (
        <ClothingOrderCompletionModal
          event={selectedEvent}
          isOpen={isCompletionModalOpen}
          onClose={() => {
            setIsCompletionModalOpen(false);
            setSelectedEvent(null);
          }}
          onComplete={handleCompletionSuccess}
        />
      )}
    </>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/admin/tasks/ClothingOrdersView.tsx
git commit -m "feat: add ClothingOrdersView container component"
```

---

## Task 11: Integrate ClothingOrdersView into TaskQueue Page

**Files:**
- Modify: `src/app/admin/tasks/page.tsx`

**Step 1: Import ClothingOrdersView**

Add this import at the top of the file (after line 8):

```typescript
import ClothingOrdersView from '@/components/admin/tasks/ClothingOrdersView';
```

**Step 2: Update the pending tasks section**

Find the section starting with `{/* Pending Tasks View */}` (around line 259) and replace it with:

```typescript
      {/* Pending Tasks View */}
      {viewMode === 'pending' && (
        <>
          {/* Task Type Tabs */}
          <div className="mb-6">
            <TaskTypeTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              counts={{
                all: stats.all,
                paper_order: stats.paper_order,
                clothing_order: stats.clothing_order,
                cd_master: stats.cd_master,
                cd_production: stats.cd_production,
                shipping: stats.shipping,
              }}
            />
          </div>

          {/* Show ClothingOrdersView for clothing tab, TaskQueue for others */}
          {activeTab === 'clothing_order' ? (
            <ClothingOrdersView isActive={activeTab === 'clothing_order'} />
          ) : (
            <TaskQueue
              tasks={filteredTasks}
              isLoading={isLoading}
              onComplete={handleCompleteClick}
            />
          )}
        </>
      )}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 4: Run tests**

Run: `npm test`

Expected: All tests pass

**Step 5: Commit**

```bash
git add src/app/admin/tasks/page.tsx
git commit -m "feat: integrate ClothingOrdersView into tasks page"
```

---

## Task 12: Create TaskTypeFilter Component

**Files:**
- Create: `src/components/admin/tasks/TaskTypeFilter.tsx`

**Step 1: Create the filter dropdown component**

```typescript
// src/components/admin/tasks/TaskTypeFilter.tsx

'use client';

import { TaskFilterTab, TASK_TYPE_CONFIG } from '@/lib/types/tasks';

interface TaskTypeFilterProps {
  value: TaskFilterTab;
  onChange: (value: TaskFilterTab) => void;
}

const FILTER_OPTIONS: { value: TaskFilterTab; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'paper_order', label: 'Paper Orders' },
  { value: 'clothing_order', label: 'Clothing Orders' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'cd_master', label: 'CD Master' },
  { value: 'cd_production', label: 'CD Production' },
];

export default function TaskTypeFilter({ value, onChange }: TaskTypeFilterProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as TaskFilterTab)}
      className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 focus:ring-2 focus:ring-[#94B8B3] focus:border-transparent outline-none"
    >
      {FILTER_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/admin/tasks/TaskTypeFilter.tsx
git commit -m "feat: add TaskTypeFilter dropdown component"
```

---

## Task 13: Create InvoiceUploadButton Component

**Files:**
- Create: `src/components/admin/tasks/InvoiceUploadButton.tsx`

**Step 1: Create the invoice upload button component**

```typescript
// src/components/admin/tasks/InvoiceUploadButton.tsx

'use client';

import { useState, useRef } from 'react';

interface InvoiceUploadButtonProps {
  taskId: string;
  hasInvoice: boolean;
  invoiceUrl?: string;
  onUploadSuccess?: () => void;
}

export default function InvoiceUploadButton({
  taskId,
  hasInvoice,
  invoiceUrl,
  onUploadSuccess,
}: InvoiceUploadButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleViewClick = async () => {
    if (!invoiceUrl) return;

    try {
      const response = await fetch(`/api/admin/tasks/${taskId}/invoice`);
      const data = await response.json();
      if (data.success && data.data?.url) {
        window.open(data.data.url, '_blank');
      }
    } catch (error) {
      console.error('Error fetching invoice URL:', error);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/admin/tasks/${taskId}/invoice`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      onUploadSuccess?.();
    } catch (error) {
      console.error('Error uploading invoice:', error);
      alert('Failed to upload invoice');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (hasInvoice) {
    return (
      <button
        onClick={handleViewClick}
        className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 transition-colors"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        View
      </button>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={handleUploadClick}
        disabled={isUploading}
        className="inline-flex items-center px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        {isUploading ? (
          <>
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 mr-1"></div>
            Uploading...
          </>
        ) : (
          'Upload'
        )}
      </button>
    </>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/admin/tasks/InvoiceUploadButton.tsx
git commit -m "feat: add InvoiceUploadButton component"
```

---

## Task 14: Create Invoice Upload API Endpoint

**Files:**
- Create: `src/app/api/admin/tasks/[taskId]/invoice/route.ts`

**Step 1: Create the API route**

```typescript
// src/app/api/admin/tasks/[taskId]/invoice/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getR2Service } from '@/lib/services/r2Service';
import { getTaskService } from '@/lib/services/taskService';
import {
  TASKS_TABLE_ID,
  TASKS_FIELD_IDS,
} from '@/lib/types/airtable';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/[taskId]/invoice
 * Get signed URL for invoice download
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'Task ID is required' },
        { status: 400 }
      );
    }

    const airtable = getAirtableService();
    const base = airtable.getBase();
    const table = base(TASKS_TABLE_ID);

    const record = await table.find(taskId);
    const completionDataStr = record.get(TASKS_FIELD_IDS.completion_data) as string;

    if (!completionDataStr) {
      return NextResponse.json(
        { success: false, error: 'No completion data found' },
        { status: 404 }
      );
    }

    const completionData = JSON.parse(completionDataStr);

    if (!completionData.invoice_r2_key) {
      return NextResponse.json(
        { success: false, error: 'No invoice uploaded' },
        { status: 404 }
      );
    }

    const r2 = getR2Service();
    const url = await r2.generateSignedUrlForAssetsBucket(completionData.invoice_r2_key, 3600);

    return NextResponse.json({
      success: true,
      data: { url },
    });
  } catch (error) {
    console.error('Error getting invoice URL:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get invoice URL' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/tasks/[taskId]/invoice
 * Upload invoice to R2
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'Task ID is required' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Allowed: PDF, PNG, JPG' },
        { status: 400 }
      );
    }

    // Get file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate R2 key
    const ext = file.name.split('.').pop() || 'pdf';
    const r2Key = `invoices/${taskId}/${Date.now()}.${ext}`;

    // Upload to R2
    const r2 = getR2Service();
    await r2.uploadToAssetsBucket(r2Key, buffer, file.type);

    // Update task completion_data with invoice_r2_key
    const airtable = getAirtableService();
    const base = airtable.getBase();
    const table = base(TASKS_TABLE_ID);

    const record = await table.find(taskId);
    const existingData = record.get(TASKS_FIELD_IDS.completion_data) as string;

    let completionData = {};
    if (existingData) {
      try {
        completionData = JSON.parse(existingData);
      } catch {
        // Ignore parse errors
      }
    }

    const updatedData = {
      ...completionData,
      invoice_r2_key: r2Key,
    };

    await table.update(taskId, {
      [TASKS_FIELD_IDS.completion_data]: JSON.stringify(updatedData),
    });

    return NextResponse.json({
      success: true,
      data: { invoice_url: r2Key },
    });
  } catch (error) {
    console.error('Error uploading invoice:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload invoice' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/admin/tasks/\[taskId\]/invoice/route.ts
git commit -m "feat: add invoice upload and download API endpoints"
```

---

## Task 15: Update CompletedTasksView with Filter and Invoice Column

**Files:**
- Modify: `src/components/admin/tasks/CompletedTasksView.tsx`

**Step 1: Read the current file to understand its structure**

The file is at `src/components/admin/tasks/CompletedTasksView.tsx`.

**Step 2: Update the component**

Replace the entire file with:

```typescript
// src/components/admin/tasks/CompletedTasksView.tsx

'use client';

import { useState, Fragment } from 'react';
import { TaskWithEventDetails, TASK_TYPE_CONFIG, TaskFilterTab } from '@/lib/types/tasks';
import TaskTypeBadge from './TaskTypeBadge';
import TaskTypeFilter from './TaskTypeFilter';
import InvoiceUploadButton from './InvoiceUploadButton';

interface CompletedTasksViewProps {
  tasks: TaskWithEventDetails[];
  isLoading: boolean;
  onRefresh?: () => void;
}

export default function CompletedTasksView({
  tasks,
  isLoading,
  onRefresh,
}: CompletedTasksViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TaskFilterTab>('all');

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Filter tasks by type
  const filteredTasks = typeFilter === 'all'
    ? tasks
    : tasks.filter(task => task.task_type === typeFilter);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <div className="h-6 w-24 bg-gray-100 rounded"></div>
              <div className="h-4 w-40 bg-gray-100 rounded"></div>
              <div className="h-4 w-32 bg-gray-100 rounded flex-1"></div>
              <div className="h-4 w-24 bg-gray-100 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Filter Row */}
      <div className="mb-4 flex items-center gap-4">
        <TaskTypeFilter value={typeFilter} onChange={setTypeFilter} />
        <span className="text-sm text-gray-500">
          {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Completed Tasks
          </h3>
          <p className="text-gray-600">
            {typeFilter === 'all'
              ? 'Completed tasks will appear here for reference.'
              : `No completed ${TASK_TYPE_CONFIG[typeFilter]?.label || typeFilter} tasks found.`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8 px-4 py-3"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Task
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  School
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Completed
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTasks.map((task) => {
                const isExpanded = expandedId === task.id;
                const completionData = task.completion_data
                  ? JSON.parse(task.completion_data)
                  : {};
                const hasInvoice = !!completionData.invoice_r2_key;

                return (
                  <Fragment key={task.id}>
                    <tr
                      className={`hover:bg-gray-50 cursor-pointer ${
                        isExpanded ? 'bg-gray-50' : ''
                      }`}
                      onClick={() => toggleExpand(task.id)}
                    >
                      <td className="px-4 py-3">
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${
                            isExpanded ? 'rotate-90' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <TaskTypeBadge type={task.task_type} size="sm" />
                          <span className="text-sm text-gray-900 font-medium">
                            {task.task_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {task.school_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {completionData.amount
                          ? `€${completionData.amount.toFixed(2)}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {task.completed_at
                          ? new Date(task.completed_at).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '-'}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <InvoiceUploadButton
                          taskId={task.id}
                          hasInvoice={hasInvoice}
                          invoiceUrl={completionData.invoice_r2_key}
                          onUploadSuccess={onRefresh}
                        />
                      </td>
                    </tr>

                    {/* Expanded Details Row */}
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="ml-8 space-y-3">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium text-gray-700">
                                  Event ID:
                                </span>{' '}
                                <span className="text-gray-600 font-mono text-xs">
                                  {task.event_id}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">
                                  Event Date:
                                </span>{' '}
                                <span className="text-gray-600">
                                  {new Date(task.event_date).toLocaleDateString('en-GB', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </span>
                              </div>
                              {task.go_display_id && (
                                <div>
                                  <span className="font-medium text-gray-700">
                                    GO-ID:
                                  </span>{' '}
                                  <span className="text-sage-700 font-mono">
                                    {task.go_display_id}
                                  </span>
                                </div>
                              )}
                              {task.completed_by && (
                                <div>
                                  <span className="font-medium text-gray-700">
                                    Completed By:
                                  </span>{' '}
                                  <span className="text-gray-600">
                                    {task.completed_by}
                                  </span>
                                </div>
                              )}
                            </div>
                            {completionData.notes && (
                              <div className="text-sm">
                                <span className="font-medium text-gray-700">
                                  Notes:
                                </span>{' '}
                                <span className="text-gray-600">
                                  {completionData.notes}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Update tasks page to pass onRefresh**

In `src/app/admin/tasks/page.tsx`, update the CompletedTasksView usage (around line 299) to pass the refresh callback:

```typescript
          <CompletedTasksView
            tasks={completedTasks}
            isLoading={isLoadingCompleted}
            onRefresh={() => fetchCompletedTasks(searchQuery)}
          />
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 5: Run tests**

Run: `npm test`

Expected: All tests pass

**Step 6: Commit**

```bash
git add src/components/admin/tasks/CompletedTasksView.tsx src/app/admin/tasks/page.tsx
git commit -m "feat: add task type filter and invoice column to completed tasks"
```

---

## Task 16: Final Verification

**Step 1: Run all tests**

Run: `npm test`

Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Run linter**

Run: `npm run lint`

Expected: No errors (or only pre-existing warnings)

**Step 4: Start dev server and manual test**

Run: `npm run dev`

Manual verification checklist:
1. Navigate to `/admin/tasks`
2. Click "Clothing Orders" tab
3. Verify cards show for events with clothing orders within visibility window
4. Expand a card and verify item breakdown displays correctly
5. Click "View Order List" and verify modal shows individual orders
6. Click "Mark Complete" and verify completion modal works
7. Switch to "Completed" view
8. Verify task type filter works
9. Verify invoice upload button works

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete clothing order tasks feature implementation"
```

---

## Summary

This implementation adds:

1. **Clothing Variants Config** - Maps Shopify variant IDs to item types and sizes
2. **Types** - TypeScript interfaces for clothing orders
3. **Service Layer** - Business logic for aggregation, detail fetching, and completion
4. **API Endpoints** - 4 new endpoints for the feature
5. **UI Components** - Accordion card, order list modal, completion modal, container view
6. **Completed Tasks Enhancements** - Type filter dropdown and invoice upload column

The feature integrates seamlessly with the existing task system, using the same patterns for urgency calculation, completion flow, and GO-ID creation.
