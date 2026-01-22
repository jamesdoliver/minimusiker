// src/lib/services/clothingOrdersService.ts

import Airtable from 'airtable';
import { getAirtableService } from './airtableService';
import { getTaskService } from './taskService';
import {
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

    // Calculate date thresholds
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const visibilityThreshold = new Date(today);
    visibilityThreshold.setDate(today.getDate() + VISIBILITY_WINDOW_DAYS);

    const pastCutoff = new Date(today);
    pastCutoff.setDate(today.getDate() - 7); // Allow 7 days past for overdue

    // Get events in visibility window (including recently past for overdue)
    const events = await eventsTable
      .select({
        filterByFormula: `AND(
          IS_ON_OR_BEFORE({${EVENTS_FIELD_IDS.event_date}}, '${visibilityThreshold.toISOString().split('T')[0]}'),
          IS_ON_OR_AFTER({${EVENTS_FIELD_IDS.event_date}}, '${pastCutoff.toISOString().split('T')[0]}')
        )`,
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
      orders: Airtable.Record<Airtable.FieldSet>[];
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
    const _eventId = event.get(EVENTS_FIELD_IDS.event_id) as string;
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
