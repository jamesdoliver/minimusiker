// src/lib/services/minicardOrdersService.ts

import Airtable from 'airtable';
import { getAirtableService } from './airtableService';
import { getR2Service, R2_PATHS, PRINTABLE_FILENAMES } from './r2Service';
import {
  MinicardOrderEvent,
  ProductCombination,
} from '@/lib/types/minicardOrders';
import {
  ORDERS_TABLE_ID,
  ORDERS_FIELD_IDS,
  EVENTS_TABLE_ID,
  EVENTS_FIELD_IDS,
  TASKS_TABLE_ID,
  TASKS_FIELD_IDS,
  ShopifyOrderLineItem,
} from '@/lib/types/airtable';
import { buildClassToEventMap, resolveOrderEventId } from '@/lib/utils/orderEventResolver';

class MinicardOrdersService {
  private airtable = getAirtableService();

  /**
   * Categorize a product title into a display label.
   * Returns undefined for minicard items (already implied).
   */
  private categorizeProduct(productTitle: string): string | undefined {
    const title = productTitle.toLowerCase();
    if (title.includes('minicard')) return undefined; // skip, already implied
    if (title.includes('hoodie')) return 'Hoodie';
    if (title.includes('shirt') || title.includes('t-shirt')) return 'T-Shirt';
    if (title.includes('cd')) return 'CD';
    if (title.includes('tonie')) return 'Tonie';
    return productTitle; // use original title as-is
  }

  /**
   * Get all pending minicard order events
   */
  async getPendingMinicardOrders(): Promise<MinicardOrderEvent[]> {
    const base = this.airtable.getBase();
    const ordersTable = base(ORDERS_TABLE_ID);
    const eventsTable = base(EVENTS_TABLE_ID);
    const tasksTable = base(TASKS_TABLE_ID);

    // Calculate date thresholds
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Events up to 30 days in the future
    const futureThreshold = new Date(today);
    futureThreshold.setDate(today.getDate() + 30 + 1);

    // Events up to 30 days in the past for overdue orders
    const pastCutoff = new Date(today);
    pastCutoff.setDate(today.getDate() - 30 - 1);

    // Step 1: Get pending minicard tasks
    const pendingTasks = await tasksTable
      .select({
        filterByFormula: `AND(
          {${TASKS_FIELD_IDS.template_id}} = 'minicard',
          {${TASKS_FIELD_IDS.status}} = 'pending'
        )`,
        returnFieldsByFieldId: true,
      })
      .all();

    if (pendingTasks.length === 0) {
      return [];
    }

    // Build a map of event_record_id → task_record_id for pending minicard tasks
    const taskByEventId = new Map<string, string>();
    for (const task of pendingTasks) {
      const eventIds = task.get(TASKS_FIELD_IDS.event_id) as string[] | undefined;
      if (eventIds?.[0]) {
        taskByEventId.set(eventIds[0], task.id);
      }
    }

    // Step 2: Get events in the visibility window
    const events = await eventsTable
      .select({
        filterByFormula: `AND(
          IS_BEFORE({${EVENTS_FIELD_IDS.event_date}}, '${futureThreshold.toISOString().split('T')[0]}'),
          IS_AFTER({${EVENTS_FIELD_IDS.event_date}}, '${pastCutoff.toISOString().split('T')[0]}')
        )`,
        returnFieldsByFieldId: true,
      })
      .all();

    // Step 3: Fetch all orders and class→event map
    const [allOrders, classToEvent] = await Promise.all([
      ordersTable.select({ returnFieldsByFieldId: true }).all(),
      buildClassToEventMap(base),
    ]);

    // Step 4: Group minicard-containing orders by event
    const ordersByEvent = new Map<string, Airtable.Record<Airtable.FieldSet>[]>();

    for (const order of allOrders) {
      const lineItemsJson = order.get(ORDERS_FIELD_IDS.line_items) as string;
      if (!lineItemsJson) continue;

      let lineItems: ShopifyOrderLineItem[];
      try {
        lineItems = JSON.parse(lineItemsJson);
      } catch {
        continue;
      }

      // Check if order has any minicard items
      const hasMinicard = lineItems.some((item) =>
        item.product_title?.toLowerCase().includes('minicard')
      );
      if (!hasMinicard) continue;

      const eventRecordId = resolveOrderEventId(order, classToEvent);
      if (!eventRecordId) continue;

      // Only include events with a pending minicard task
      if (!taskByEventId.has(eventRecordId)) continue;

      if (!ordersByEvent.has(eventRecordId)) {
        ordersByEvent.set(eventRecordId, []);
      }
      ordersByEvent.get(eventRecordId)!.push(order);
    }

    // Step 5: Build MinicardOrderEvent for each event with orders
    const r2Service = getR2Service();
    const minicardOrderEvents: MinicardOrderEvent[] = [];

    for (const event of events) {
      const eventRecordId = event.id;
      const eventOrders = ordersByEvent.get(eventRecordId);
      if (!eventOrders || eventOrders.length === 0) continue;

      const eventId = event.get(EVENTS_FIELD_IDS.event_id) as string;
      const schoolName = event.get(EVENTS_FIELD_IDS.school_name) as string;
      const eventDate = event.get(EVENTS_FIELD_IDS.event_date) as string;

      // Deadline is event_date + 1 day
      const eventDateObj = new Date(eventDate);
      eventDateObj.setHours(0, 0, 0, 0);
      const deadlineDate = new Date(eventDateObj);
      deadlineDate.setDate(eventDateObj.getDate() + 1);

      const diffTime = deadlineDate.getTime() - today.getTime();
      const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const isOverdue = daysUntilDue < 0;

      // Aggregate minicard counts and build combination breakdown
      let totalMinicardCount = 0;
      const combinationMap = new Map<string, { order_count: number; minicard_qty: number }>();

      for (const order of eventOrders) {
        const lineItemsJson = order.get(ORDERS_FIELD_IDS.line_items) as string;
        const lineItems: ShopifyOrderLineItem[] = JSON.parse(lineItemsJson);

        // Count minicards in this order
        let orderMinicardQty = 0;
        const nonMinicardCategories = new Set<string>();

        for (const item of lineItems) {
          const title = item.product_title || '';
          if (title.toLowerCase().includes('minicard')) {
            orderMinicardQty += item.quantity;
          } else {
            const category = this.categorizeProduct(title);
            if (category) {
              nonMinicardCategories.add(category);
            }
          }
        }

        totalMinicardCount += orderMinicardQty;

        // Build combination label
        let label: string;
        if (nonMinicardCategories.size === 0) {
          label = 'Minicard only';
        } else {
          const sorted = Array.from(nonMinicardCategories).sort();
          label = 'Minicard + ' + sorted.join(' + ');
        }

        const existing = combinationMap.get(label);
        if (existing) {
          existing.order_count += 1;
          existing.minicard_qty += orderMinicardQty;
        } else {
          combinationMap.set(label, { order_count: 1, minicard_qty: orderMinicardQty });
        }
      }

      // Convert combination map to array
      const combinations: ProductCombination[] = Array.from(combinationMap.entries())
        .map(([label, data]) => ({
          label,
          order_count: data.order_count,
          minicard_qty: data.minicard_qty,
        }))
        .sort((a, b) => b.order_count - a.order_count);

      // Check R2 for minicard PDF
      const minicardKey = `${R2_PATHS.EVENT_PRINTABLES_MINICARDS(eventId)}/${PRINTABLE_FILENAMES.minicard}`;
      let r2DownloadUrl: string | undefined;
      try {
        const exists = await r2Service.fileExistsInAssetsBucket(minicardKey);
        if (exists) {
          r2DownloadUrl = await r2Service.generateSignedUrlForAssetsBucket(minicardKey);
        }
      } catch {
        // PDF not available — leave undefined
      }

      minicardOrderEvents.push({
        event_id: eventId,
        event_record_id: eventRecordId,
        school_name: schoolName,
        event_date: eventDate,
        deadline: deadlineDate.toISOString().split('T')[0],
        days_until_due: daysUntilDue,
        is_overdue: isOverdue,
        total_minicard_count: totalMinicardCount,
        total_orders: eventOrders.length,
        combinations,
        r2_download_url: r2DownloadUrl,
        task_record_id: taskByEventId.get(eventRecordId)!,
      });
    }

    // Sort by urgency (overdue first, then by days_until_due ascending)
    minicardOrderEvents.sort((a, b) => {
      if (a.is_overdue !== b.is_overdue) {
        return a.is_overdue ? -1 : 1;
      }
      return a.days_until_due - b.days_until_due;
    });

    return minicardOrderEvents;
  }
}

// Singleton
let minicardOrdersServiceInstance: MinicardOrdersService | null = null;

export function getMinicardOrdersService(): MinicardOrdersService {
  if (!minicardOrdersServiceInstance) {
    minicardOrdersServiceInstance = new MinicardOrdersService();
  }
  return minicardOrdersServiceInstance;
}
