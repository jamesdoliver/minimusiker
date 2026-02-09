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
import { calculateDeadline } from '@/lib/config/taskTemplates';
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
  CLASSES_TABLE_ID,
  CLASSES_FIELD_IDS,
} from '@/lib/types/airtable';
import { ShopifyOrderLineItem } from '@/lib/types/airtable';

// Order Day is 18 days before event
const ORDER_DAY_OFFSET = 18;
// Show cards 3 days before Order Day (21 days before event)
const VISIBILITY_WINDOW_DAYS = 21;

class ClothingOrdersService {
  private airtable = getAirtableService();

  /**
   * Build a map from class record ID → event record ID.
   * Fetched once per method call to avoid N+1 queries.
   */
  private async buildClassToEventMap(): Promise<Map<string, string>> {
    const base = this.airtable.getBase();
    const classesTable = base(CLASSES_TABLE_ID);
    const records = await classesTable.select({ returnFieldsByFieldId: true }).all();
    const map = new Map<string, string>();
    for (const record of records) {
      const eventIds = record.get(CLASSES_FIELD_IDS.event_id) as string[] | undefined;
      if (eventIds?.[0]) {
        map.set(record.id, eventIds[0]);
      }
    }
    return map;
  }

  /**
   * Resolve an order's event record ID using direct event_id first,
   * falling back to class_id → event_id lookup.
   */
  private resolveOrderEventId(
    order: Airtable.Record<Airtable.FieldSet>,
    classToEvent: Map<string, string>
  ): string | undefined {
    // Path 1: Direct event_id linked field
    const eventIds = order.get(ORDERS_FIELD_IDS.event_id) as string[] | undefined;
    if (eventIds?.[0]) return eventIds[0];

    // Path 2: Fallback via class_id → event_id
    const classIds = order.get(ORDERS_FIELD_IDS.class_id) as string[] | undefined;
    if (classIds?.[0]) {
      return classToEvent.get(classIds[0]);
    }

    return undefined;
  }

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

    // Events up to 21 days in the future (inclusive)
    // Add 1 day to threshold so IS_BEFORE includes the boundary date
    const visibilityThreshold = new Date(today);
    visibilityThreshold.setDate(today.getDate() + VISIBILITY_WINDOW_DAYS + 1);

    // Events up to 7 days in the past (inclusive) for overdue orders
    // Subtract 1 day from cutoff so IS_AFTER includes the boundary date
    const pastCutoff = new Date(today);
    pastCutoff.setDate(today.getDate() - 7 - 1);

    // Get events in visibility window (including recently past for overdue)
    const events = await eventsTable
      .select({
        filterByFormula: `AND(
          IS_BEFORE({${EVENTS_FIELD_IDS.event_date}}, '${visibilityThreshold.toISOString().split('T')[0]}'),
          IS_AFTER({${EVENTS_FIELD_IDS.event_date}}, '${pastCutoff.toISOString().split('T')[0]}')
        )`,
        returnFieldsByFieldId: true,
      })
      .all();

    // Get completed clothing_order tasks to exclude
    const completedTasks = await tasksTable
      .select({
        filterByFormula: `AND(
          {${TASKS_FIELD_IDS.task_type}} = 'clothing_order',
          {${TASKS_FIELD_IDS.status}} = 'completed'
        )`,
        returnFieldsByFieldId: true,
      })
      .all();

    const completedEventIds = new Set(
      completedTasks.map((t) => {
        const eventIds = t.get(TASKS_FIELD_IDS.event_id) as string[] | undefined;
        return eventIds?.[0];
      }).filter(Boolean)
    );

    // Get all orders and class→event lookup for fallback resolution
    const [allOrders, classToEvent] = await Promise.all([
      ordersTable.select({ returnFieldsByFieldId: true }).all(),
      this.buildClassToEventMap(),
    ]);

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

      const eventRecordId = this.resolveOrderEventId(order, classToEvent);
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

    // Fetch all data upfront to avoid multiple Airtable calls in loops
    // (SEARCH with ARRAYJOIN doesn't work reliably with linked record fields)
    const [allOrders, allParents, allRegistrations, classToEvent] = await Promise.all([
      ordersTable.select({ returnFieldsByFieldId: true }).all(),
      parentsTable.select({ returnFieldsByFieldId: true }).all(),
      registrationsTable.select({ returnFieldsByFieldId: true }).all(),
      this.buildClassToEventMap(),
    ]);

    // Create lookup maps for efficient access
    const parentsById = new Map(
      allParents.map((p) => [p.id, p.get(PARENTS_FIELD_IDS.parent_first_name) as string])
    );

    // Filter to orders linked to this event (with class_id → event_id fallback)
    const orders = allOrders.filter((order) => {
      return this.resolveOrderEventId(order, classToEvent) === eventRecordId;
    });

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

      // Get parent name from lookup map
      const parentIds = order.get(ORDERS_FIELD_IDS.parent_id) as string[] | undefined;
      const parentName = parentIds?.[0] ? (parentsById.get(parentIds[0]) || 'Unknown') : 'Unknown';

      // Get child names from registrations (filter in code)
      const childNames: string[] = [];
      const classIds = order.get(ORDERS_FIELD_IDS.class_id) as string[] | undefined;
      if (classIds?.[0] && parentIds?.[0]) {
        const matchingRegs = allRegistrations.filter((reg) => {
          const regParentIds = reg.get(REGISTRATIONS_FIELD_IDS.parent_id) as string[] | undefined;
          const regClassIds = reg.get(REGISTRATIONS_FIELD_IDS.class_id) as string[] | undefined;
          return regParentIds?.includes(parentIds[0]) && regClassIds?.includes(classIds[0]);
        });

        for (const reg of matchingRegs) {
          const childName = reg.get(REGISTRATIONS_FIELD_IDS.registered_child) as string;
          if (childName) childNames.push(childName);
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
   * Complete a clothing order via the standard task cascade
   * Finds (or creates) the pending clothing task, then completes it through taskService
   * which creates GO-ID + shipping task
   */
  async completeClothingOrder(
    eventRecordId: string,
    amount: number,
    notes: string | undefined,
    orderIds: string[],
    adminEmail: string
  ): Promise<{ taskId: string; goId: string; shippingTaskId?: string }> {
    const taskService = getTaskService();
    const base = this.airtable.getBase();
    const tasksTable = base(TASKS_TABLE_ID);
    const eventsTable = base(EVENTS_TABLE_ID);

    // Find the pending order_schul_shirts task for this event
    const pendingTasks = await tasksTable
      .select({
        filterByFormula: `AND(
          {${TASKS_FIELD_IDS.template_id}} = 'order_schul_shirts',
          {${TASKS_FIELD_IDS.status}} = 'pending',
          SEARCH('${eventRecordId}', ARRAYJOIN({${TASKS_FIELD_IDS.event_id}}))
        )`,
      })
      .all();

    let taskId: string;

    if (pendingTasks.length > 0) {
      // Use the existing pending task
      taskId = pendingTasks[0].id;
    } else {
      // Legacy event without pre-generated task — create one as pending first
      const eventRecords = await eventsTable
        .select({
          filterByFormula: `RECORD_ID() = '${eventRecordId}'`,
          returnFieldsByFieldId: true,
          maxRecords: 1,
        })
        .all();

      if (eventRecords.length === 0) {
        throw new Error(`Event not found: ${eventRecordId}`);
      }

      const event = eventRecords[0];
      const eventDate = event.get(EVENTS_FIELD_IDS.event_date) as string;

      const deadline = calculateDeadline(new Date(eventDate), -ORDER_DAY_OFFSET);

      const pendingTask = await taskService.createTask({
        event_id: eventRecordId,
        template_id: 'order_schul_shirts',
        task_type: 'clothing_order',
        task_name: 'Order School T-Shirts & Hoodies',
        description: 'Place supplier order for school-branded clothing items',
        completion_type: 'monetary',
        timeline_offset: -ORDER_DAY_OFFSET,
        deadline: deadline.toISOString(),
        status: 'pending',
      });
      taskId = pendingTask.id;
    }

    // Build aggregated items for GO enrichment
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

    // Complete through the standard task cascade (creates GO-ID + shipping task)
    const result = await taskService.completeTask(
      taskId,
      { amount, notes: notes || undefined },
      adminEmail,
      { order_ids: orderIds.join(','), contains: aggregatedItems }
    );

    return {
      taskId: result.task.id,
      goId: result.goId || '',
      shippingTaskId: result.shippingTaskId,
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
