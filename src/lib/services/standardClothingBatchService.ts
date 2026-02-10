// src/lib/services/standardClothingBatchService.ts

import Airtable from 'airtable';
import { getAirtableService } from './airtableService';
import { getTaskService } from './taskService';
import {
  isStandardClothingVariant,
  getStandardClothingDetails,
  TSHIRT_SIZES,
  HOODIE_SIZES,
} from '@/lib/config/clothingVariants';
import {
  StandardClothingBatch,
  StandardClothingOrderDetail,
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
  PARENTS_TABLE_ID,
  PARENTS_FIELD_IDS,
} from '@/lib/types/airtable';
import { ShopifyOrderLineItem } from '@/lib/types/airtable';
import { buildClassToEventMap, resolveOrderEventId } from '@/lib/utils/orderEventResolver';

class StandardClothingBatchService {
  private airtable = getAirtableService();

  /**
   * Get the previous week's date range (Monday 00:00 to Sunday 23:59 UTC)
   */
  getLastWeekRange(): { start: Date; end: Date } {
    const now = new Date();
    // Find this Monday
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon, ...
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    // This Monday at 00:00 UTC
    const thisMonday = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysSinceMonday,
      0, 0, 0, 0
    ));

    // Last Monday at 00:00 UTC
    const lastMonday = new Date(thisMonday);
    lastMonday.setUTCDate(lastMonday.getUTCDate() - 7);

    // Last Sunday at 23:59:59 UTC
    const lastSunday = new Date(thisMonday);
    lastSunday.setUTCMilliseconds(-1);

    return { start: lastMonday, end: lastSunday };
  }

  /**
   * Generate batch ID from a date, e.g. "STD-2026-W06"
   */
  private generateBatchId(date: Date): string {
    const year = date.getUTCFullYear();
    // ISO week number
    const tempDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = tempDate.getUTCDay() || 7;
    tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil((((tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `STD-${year}-W${String(weekNum).padStart(2, '0')}`;
  }

  /**
   * Get all order IDs already included in any standard_clothing_order task
   * (both pending and completed) for deduplication.
   */
  async getAlreadyBatchedOrderIds(): Promise<Set<string>> {
    const base = this.airtable.getBase();
    const tasksTable = base(TASKS_TABLE_ID);

    const records = await tasksTable
      .select({
        filterByFormula: `{${TASKS_FIELD_IDS.task_type}} = 'standard_clothing_order'`,
        returnFieldsByFieldId: true,
      })
      .all();

    const batchedIds = new Set<string>();
    for (const record of records) {
      const orderIdsStr = record.get(TASKS_FIELD_IDS.order_ids) as string | undefined;
      if (orderIdsStr) {
        for (const id of orderIdsStr.split(',')) {
          const trimmed = id.trim();
          if (trimmed) batchedIds.add(trimmed);
        }
      }
    }

    return batchedIds;
  }

  /**
   * Find standard clothing orders for a given date range, excluding already-batched orders.
   * Returns null if no matching orders found.
   */
  async findStandardOrdersForWeek(
    start: Date,
    end: Date
  ): Promise<StandardClothingBatch | null> {
    const base = this.airtable.getBase();
    const ordersTable = base(ORDERS_TABLE_ID);
    const eventsTable = base(EVENTS_TABLE_ID);

    // Add 1 day to end for IS_BEFORE boundary inclusivity (same pattern as clothingOrdersService)
    const endPlusOne = new Date(end);
    endPlusOne.setUTCDate(endPlusOne.getUTCDate() + 1);

    // Subtract 1 day from start for IS_AFTER boundary inclusivity
    const startMinusOne = new Date(start);
    startMinusOne.setUTCDate(startMinusOne.getUTCDate() - 1);

    // Fetch orders in date range
    const orders = await ordersTable
      .select({
        filterByFormula: `AND(
          IS_AFTER({${ORDERS_FIELD_IDS.order_date}}, '${startMinusOne.toISOString().split('T')[0]}'),
          IS_BEFORE({${ORDERS_FIELD_IDS.order_date}}, '${endPlusOne.toISOString().split('T')[0]}')
        )`,
        returnFieldsByFieldId: true,
      })
      .all();

    // Get already-batched order IDs for deduplication
    const alreadyBatched = await this.getAlreadyBatchedOrderIds();

    // Build class-to-event map for event resolution
    const classToEvent = await buildClassToEventMap(this.airtable.getBase());

    // Filter to orders with standard clothing items, excluding already-batched
    const matchingOrders: {
      order: Airtable.Record<Airtable.FieldSet>;
      eventRecordId: string | undefined;
      items: ClothingItem[];
      revenue: number;
    }[] = [];

    for (const order of orders) {
      // Skip already-batched orders
      if (alreadyBatched.has(order.id)) continue;

      const lineItemsJson = order.get(ORDERS_FIELD_IDS.line_items) as string;
      if (!lineItemsJson) continue;

      let lineItems: ShopifyOrderLineItem[];
      try {
        lineItems = JSON.parse(lineItemsJson);
      } catch {
        continue;
      }

      // Check for standard clothing items
      const clothingItems: ClothingItem[] = [];
      let revenue = 0;

      for (const item of lineItems) {
        const details = getStandardClothingDetails(item.variant_id);
        if (details) {
          clothingItems.push({
            type: details.type,
            size: details.size,
            quantity: item.quantity,
          });
          revenue += item.total;
        }
      }

      if (clothingItems.length === 0) continue;

      const eventRecordId = resolveOrderEventId(order, classToEvent);

      matchingOrders.push({
        order,
        eventRecordId,
        items: clothingItems,
        revenue,
      });
    }

    // No standard orders found for this week
    if (matchingOrders.length === 0) return null;

    // Aggregate items by size
    const aggregatedItems: AggregatedClothingItems = {
      tshirts: Object.fromEntries(TSHIRT_SIZES.map((s) => [s, 0])),
      hoodies: Object.fromEntries(HOODIE_SIZES.map((s) => [s, 0])),
    };

    let totalRevenue = 0;
    const orderIds: string[] = [];
    const eventRecordIds = new Set<string>();

    for (const { order, eventRecordId, items, revenue } of matchingOrders) {
      orderIds.push(order.id);
      totalRevenue += revenue;

      if (eventRecordId) {
        eventRecordIds.add(eventRecordId);
      }

      for (const item of items) {
        if (item.type === 'tshirt') {
          aggregatedItems.tshirts[item.size] =
            (aggregatedItems.tshirts[item.size] || 0) + item.quantity;
        } else {
          aggregatedItems.hoodies[item.size] =
            (aggregatedItems.hoodies[item.size] || 0) + item.quantity;
        }
      }
    }

    // Resolve event names
    const eventRecordIdArray = Array.from(eventRecordIds);
    const eventNames: string[] = [];

    for (const eventRecordId of eventRecordIdArray) {
      try {
        const eventRecord = await eventsTable.find(eventRecordId);
        const schoolName = eventRecord.get(EVENTS_FIELD_IDS.school_name) as string;
        if (schoolName) eventNames.push(schoolName);
      } catch {
        // Skip events that can't be found
      }
    }

    const batchId = this.generateBatchId(start);

    return {
      task_id: '', // Will be set after task creation
      batch_id: batchId,
      week_start: start.toISOString().split('T')[0],
      week_end: end.toISOString().split('T')[0],
      event_record_ids: eventRecordIdArray,
      event_names: eventNames,
      total_orders: matchingOrders.length,
      total_revenue: totalRevenue,
      aggregated_items: aggregatedItems,
      order_ids: orderIds,
    };
  }

  /**
   * Create a batch task in Airtable for the given batch.
   * Writes order_ids immediately for deduplication.
   */
  async createBatchTask(batch: StandardClothingBatch): Promise<string> {
    const taskService = getTaskService();
    const base = this.airtable.getBase();
    const tasksTable = base(TASKS_TABLE_ID);

    // Use event_ids if we have linked events, otherwise use a placeholder
    const eventIds = batch.event_record_ids.length > 0
      ? batch.event_record_ids
      : undefined;

    const task = await taskService.createTask({
      event_id: eventIds?.[0] || '',
      event_ids: eventIds,
      template_id: 'order_standard_shirts',
      task_type: 'standard_clothing_order',
      task_name: `Standard Clothing Batch ${batch.batch_id}`,
      description: `Weekly batch: ${batch.total_orders} orders from ${batch.event_names.length} schools (${batch.week_start} to ${batch.week_end})`,
      completion_type: 'monetary',
      timeline_offset: 0,
      deadline: new Date().toISOString(),
      status: 'pending',
    });

    // Immediately write order_ids for deduplication on next run
    await tasksTable.update(task.id, {
      [TASKS_FIELD_IDS.order_ids]: batch.order_ids.join(','),
    });

    return task.id;
  }

  /**
   * Get all pending standard clothing batches for admin display.
   */
  async getPendingStandardBatches(): Promise<StandardClothingBatch[]> {
    const base = this.airtable.getBase();
    const tasksTable = base(TASKS_TABLE_ID);
    const ordersTable = base(ORDERS_TABLE_ID);
    const eventsTable = base(EVENTS_TABLE_ID);

    // Fetch pending standard_clothing_order tasks
    const taskRecords = await tasksTable
      .select({
        filterByFormula: `AND(
          {${TASKS_FIELD_IDS.task_type}} = 'standard_clothing_order',
          {${TASKS_FIELD_IDS.status}} = 'pending'
        )`,
        returnFieldsByFieldId: true,
      })
      .all();

    if (taskRecords.length === 0) return [];

    // Fetch all orders for re-aggregation
    const allOrders = await ordersTable
      .select({ returnFieldsByFieldId: true })
      .all();

    const ordersById = new Map(
      allOrders.map((o) => [o.id, o])
    );

    // Build class-to-event map
    const classToEvent = await buildClassToEventMap(this.airtable.getBase());

    const batches: StandardClothingBatch[] = [];

    for (const taskRecord of taskRecords) {
      const taskId = taskRecord.id;
      const taskName = taskRecord.get(TASKS_FIELD_IDS.task_name) as string || '';
      const orderIdsStr = taskRecord.get(TASKS_FIELD_IDS.order_ids) as string | undefined;
      const eventIds = taskRecord.get(TASKS_FIELD_IDS.event_id) as string[] | undefined;

      if (!orderIdsStr) continue;

      const orderIdArray = orderIdsStr.split(',').map((id) => id.trim()).filter(Boolean);

      // Re-aggregate from order data for accurate display
      const aggregatedItems: AggregatedClothingItems = {
        tshirts: Object.fromEntries(TSHIRT_SIZES.map((s) => [s, 0])),
        hoodies: Object.fromEntries(HOODIE_SIZES.map((s) => [s, 0])),
      };

      let totalRevenue = 0;
      let totalOrders = 0;
      const eventRecordIds = new Set<string>();

      for (const orderId of orderIdArray) {
        const order = ordersById.get(orderId);
        if (!order) continue;

        const lineItemsJson = order.get(ORDERS_FIELD_IDS.line_items) as string;
        if (!lineItemsJson) continue;

        let lineItems: ShopifyOrderLineItem[];
        try {
          lineItems = JSON.parse(lineItemsJson);
        } catch {
          continue;
        }

        let hasStandard = false;
        for (const item of lineItems) {
          const details = getStandardClothingDetails(item.variant_id);
          if (details) {
            hasStandard = true;
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

        if (hasStandard) {
          totalOrders++;
          const eventRecordId = resolveOrderEventId(order, classToEvent);
          if (eventRecordId) eventRecordIds.add(eventRecordId);
        }
      }

      // Resolve event names
      const eventRecordIdArray = eventIds || Array.from(eventRecordIds);
      const eventNames: string[] = [];
      for (const eventRecordId of eventRecordIdArray) {
        try {
          const eventRecord = await eventsTable.find(eventRecordId);
          const schoolName = eventRecord.get(EVENTS_FIELD_IDS.school_name) as string;
          if (schoolName) eventNames.push(schoolName);
        } catch {
          // Skip events that can't be found
        }
      }

      // Extract batch ID from task name ("Standard Clothing Batch STD-2026-W06")
      const batchIdMatch = taskName.match(/STD-\d{4}-W\d{2}/);
      const batchId = batchIdMatch ? batchIdMatch[0] : taskName;

      // Extract week dates from description
      const description = taskRecord.get(TASKS_FIELD_IDS.description) as string || '';
      const dateMatch = description.match(/\((\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})\)/);

      batches.push({
        task_id: taskId,
        batch_id: batchId,
        week_start: dateMatch?.[1] || '',
        week_end: dateMatch?.[2] || '',
        event_record_ids: eventRecordIdArray,
        event_names: eventNames,
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        aggregated_items: aggregatedItems,
        order_ids: orderIdArray,
      });
    }

    return batches;
  }

  /**
   * Get individual orders for a batch (for modal display).
   */
  async getOrdersForBatch(orderIds: string[]): Promise<StandardClothingOrderDetail[]> {
    const base = this.airtable.getBase();
    const ordersTable = base(ORDERS_TABLE_ID);
    const parentsTable = base(PARENTS_TABLE_ID);
    const eventsTable = base(EVENTS_TABLE_ID);

    // Fetch all data upfront
    const [allOrders, allParents, classToEvent] = await Promise.all([
      ordersTable.select({ returnFieldsByFieldId: true }).all(),
      parentsTable.select({ returnFieldsByFieldId: true }).all(),
      buildClassToEventMap(this.airtable.getBase()),
    ]);

    const parentsById = new Map(
      allParents.map((p) => [p.id, p.get(PARENTS_FIELD_IDS.parent_first_name) as string])
    );

    // Filter to orders in this batch
    const orderIdSet = new Set(orderIds);
    const batchOrders = allOrders.filter((o) => orderIdSet.has(o.id));

    // Cache event names
    const eventNameCache = new Map<string, string>();

    const orderDetails: StandardClothingOrderDetail[] = [];

    for (const order of batchOrders) {
      const lineItemsJson = order.get(ORDERS_FIELD_IDS.line_items) as string;
      if (!lineItemsJson) continue;

      let lineItems: ShopifyOrderLineItem[];
      try {
        lineItems = JSON.parse(lineItemsJson);
      } catch {
        continue;
      }

      // Filter to standard clothing items only
      const clothingItems: ClothingItem[] = [];
      let clothingTotal = 0;
      for (const item of lineItems) {
        const details = getStandardClothingDetails(item.variant_id);
        if (details) {
          clothingItems.push({
            type: details.type,
            size: details.size,
            quantity: item.quantity,
          });
          clothingTotal += item.total;
        }
      }

      if (clothingItems.length === 0) continue;

      // Get parent name
      const parentIds = order.get(ORDERS_FIELD_IDS.parent_id) as string[] | undefined;
      const parentName = parentIds?.[0] ? (parentsById.get(parentIds[0]) || 'Unknown') : 'Unknown';

      // Get school name from event
      const eventRecordId = resolveOrderEventId(order, classToEvent);
      let schoolName = 'Unknown School';
      if (eventRecordId) {
        if (eventNameCache.has(eventRecordId)) {
          schoolName = eventNameCache.get(eventRecordId)!;
        } else {
          try {
            const eventRecord = await eventsTable.find(eventRecordId);
            const name = eventRecord.get(EVENTS_FIELD_IDS.school_name) as string;
            if (name) {
              schoolName = name;
              eventNameCache.set(eventRecordId, name);
            }
          } catch {
            // Skip
          }
        }
      }

      orderDetails.push({
        order_id: order.id,
        order_number: order.get(ORDERS_FIELD_IDS.order_number) as string || '',
        order_date: order.get(ORDERS_FIELD_IDS.order_date) as string || '',
        total_amount: clothingTotal,
        parent_name: parentName,
        school_name: schoolName,
        clothing_items: clothingItems,
      });
    }

    // Sort by school name, then order date
    orderDetails.sort((a, b) => {
      if (a.school_name !== b.school_name) {
        return a.school_name.localeCompare(b.school_name);
      }
      return new Date(b.order_date).getTime() - new Date(a.order_date).getTime();
    });

    return orderDetails;
  }

  /**
   * Complete a standard clothing batch through the task cascade.
   * Creates GO-ID (linked to all events) + shipping task.
   */
  async completeStandardBatch(
    taskId: string,
    amount: number,
    notes: string | undefined,
    batch: StandardClothingBatch,
    adminEmail: string
  ): Promise<{ taskId: string; goId: string; shippingTaskId?: string }> {
    const taskService = getTaskService();

    // Build aggregated items for GO enrichment
    const aggregatedItems: { sku: string; name: string; quantity: number }[] = [];

    for (const [size, qty] of Object.entries(batch.aggregated_items.tshirts)) {
      if (qty > 0) {
        aggregatedItems.push({
          sku: `std-tshirt-${size}`,
          name: `Standard T-Shirt (${size})`,
          quantity: qty,
        });
      }
    }

    for (const [size, qty] of Object.entries(batch.aggregated_items.hoodies)) {
      if (qty > 0) {
        aggregatedItems.push({
          sku: `std-hoodie-${size}`,
          name: `Standard Hoodie (${size})`,
          quantity: qty,
        });
      }
    }

    const result = await taskService.completeTask(
      taskId,
      { amount, notes: notes || undefined },
      adminEmail,
      { order_ids: batch.order_ids.join(','), contains: aggregatedItems }
    );

    return {
      taskId: result.task.id,
      goId: result.goId || '',
      shippingTaskId: result.shippingTaskId,
    };
  }
}

// Singleton
let standardClothingBatchServiceInstance: StandardClothingBatchService | null = null;

export function getStandardClothingBatchService(): StandardClothingBatchService {
  if (!standardClothingBatchServiceInstance) {
    standardClothingBatchServiceInstance = new StandardClothingBatchService();
  }
  return standardClothingBatchServiceInstance;
}
