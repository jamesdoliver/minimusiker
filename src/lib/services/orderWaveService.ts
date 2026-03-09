// src/lib/services/orderWaveService.ts

/**
 * Order Wave Service
 *
 * Groups Airtable orders by event and shipment wave (Welle 1 / Welle 2)
 * for the admin Orders page.
 */

import Airtable from 'airtable';
import { getAirtableService } from './airtableService';
import {
  ORDERS_TABLE_ID,
  ORDERS_FIELD_IDS,
  EVENTS_FIELD_IDS,
  ShopifyOrderLineItem,
} from '@/lib/types/airtable';
import type { ShipmentWave } from '@/lib/types/tasks';
import {
  classifyVariant,
  computeShipmentWave,
  type VariantCategory,
} from '@/lib/config/variantClassification';
import { buildClassToEventMap, resolveOrderEventId } from '@/lib/utils/orderEventResolver';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderLineItem {
  variantId: string;
  productTitle: string;
  variantTitle?: string;
  quantity: number;
  price: number;
  total: number;
  waveCategory: 'clothing' | 'audio' | 'standard' | 'unknown';
}

export interface WaveOrder {
  recordId: string;             // Airtable record ID
  orderId: string;              // Shopify order GID
  orderNumber: string;          // Display number (#1001)
  customerName: string;         // From parent lookup or order
  schoolName: string;
  shipmentWave: ShipmentWave;
  fulfillmentStatus: string;
  paymentStatus: string;
  totalAmount: number;
  orderDate: string;
  lineItems: OrderLineItem[];
}

export interface EventWaveSummary {
  eventRecordId: string;
  eventId: string;
  schoolName: string;
  eventDate: string;
  welle1: {
    deadline: string;
    orderCount: number;
    itemSummary: Record<string, number>;
    fulfillmentStatus: 'unfulfilled' | 'partial' | 'fulfilled';
    orders: WaveOrder[];
  };
  welle2: {
    deadline: string;
    orderCount: number;
    itemSummary: Record<string, number>;
    fulfillmentStatus: 'unfulfilled' | 'partial' | 'fulfilled';
    orders: WaveOrder[];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a VariantCategory to the waveCategory used in OrderLineItem.
 */
function toWaveCategory(cat: VariantCategory | undefined): OrderLineItem['waveCategory'] {
  if (!cat) return 'unknown';
  return cat; // 'clothing' | 'audio' | 'standard' already match
}

/**
 * Calculate the aggregate fulfillment status for a set of orders.
 */
function aggregateFulfillmentStatus(
  orders: WaveOrder[],
): 'unfulfilled' | 'partial' | 'fulfilled' {
  if (orders.length === 0) return 'unfulfilled';

  const fulfilledCount = orders.filter(
    (o) => o.fulfillmentStatus === 'fulfilled',
  ).length;

  if (fulfilledCount === orders.length) return 'fulfilled';
  if (fulfilledCount > 0) return 'partial';
  return 'unfulfilled';
}

/**
 * Build an item summary (variant title -> total quantity) from a list of orders.
 */
function buildItemSummary(orders: WaveOrder[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const order of orders) {
    for (const item of order.lineItems) {
      const label = item.variantTitle
        ? `${item.productTitle} - ${item.variantTitle}`
        : item.productTitle;
      summary[label] = (summary[label] || 0) + item.quantity;
    }
  }
  return summary;
}

/**
 * Calculate a deadline date by adding an offset (in days) to a base date.
 * Returns an ISO date string (YYYY-MM-DD).
 */
function calculateWaveDeadline(eventDate: string, offsetDays: number): string {
  const date = new Date(eventDate);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class OrderWaveService {
  private airtable = getAirtableService();

  /**
   * Get wave summaries for ALL events that have orders.
   */
  async getEventWaveSummaries(): Promise<EventWaveSummary[]> {
    const base = this.airtable.getBase();
    const ordersTable = base(ORDERS_TABLE_ID);

    // Fetch all orders and class→event mapping in parallel
    const [allOrders, classToEvent] = await Promise.all([
      ordersTable.select({ returnFieldsByFieldId: true }).all(),
      buildClassToEventMap(base),
    ]);

    // Group orders by event record ID
    const ordersByEvent = new Map<string, Airtable.Record<Airtable.FieldSet>[]>();

    for (const order of allOrders) {
      const eventRecordId = resolveOrderEventId(order, classToEvent);
      if (!eventRecordId) continue;

      if (!ordersByEvent.has(eventRecordId)) {
        ordersByEvent.set(eventRecordId, []);
      }
      ordersByEvent.get(eventRecordId)!.push(order);
    }

    // Fetch event details for every unique event
    const summaries: EventWaveSummary[] = [];

    for (const [eventRecordId, orders] of ordersByEvent.entries()) {
      const event = await this.airtable.getEventById(eventRecordId);
      if (!event) continue;

      const summary = this.buildEventWaveSummary(
        eventRecordId,
        event.event_id,
        event.school_name,
        event.event_date,
        orders,
      );
      summaries.push(summary);
    }

    // Sort by event date ascending
    summaries.sort(
      (a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime(),
    );

    return summaries;
  }

  /**
   * Get wave summary for a SINGLE event.
   */
  async getEventOrders(eventRecordId: string): Promise<EventWaveSummary> {
    const base = this.airtable.getBase();
    const ordersTable = base(ORDERS_TABLE_ID);

    // Fetch all orders and class→event mapping in parallel
    const [allOrders, classToEvent] = await Promise.all([
      ordersTable.select({ returnFieldsByFieldId: true }).all(),
      buildClassToEventMap(base),
    ]);

    // Filter orders belonging to this event
    const eventOrders = allOrders.filter(
      (order) => resolveOrderEventId(order, classToEvent) === eventRecordId,
    );

    // Fetch event details
    const event = await this.airtable.getEventById(eventRecordId);
    if (!event) {
      throw new Error(`Event not found: ${eventRecordId}`);
    }

    return this.buildEventWaveSummary(
      eventRecordId,
      event.event_id,
      event.school_name,
      event.event_date,
      eventOrders,
    );
  }

  /**
   * Override the shipment_wave field on a specific order record.
   */
  async overrideWave(orderRecordId: string, newWave: ShipmentWave): Promise<void> {
    const base = this.airtable.getBase();
    const ordersTable = base(ORDERS_TABLE_ID);

    await ordersTable.update(orderRecordId, {
      [ORDERS_FIELD_IDS.shipment_wave]: newWave,
    } as Partial<Airtable.FieldSet>);
  }

  /**
   * Auto-classify an order's shipment wave based on its line items.
   * If a wave can be determined, the order record is updated in Airtable.
   */
  async autoClassifyOrder(
    orderRecordId: string,
    lineItems: Array<{ variant_id: string; quantity: number }>,
  ): Promise<ShipmentWave | null> {
    const wave = computeShipmentWave(lineItems);

    if (wave) {
      const base = this.airtable.getBase();
      const ordersTable = base(ORDERS_TABLE_ID);

      await ordersTable.update(orderRecordId, {
        [ORDERS_FIELD_IDS.shipment_wave]: wave,
      } as Partial<Airtable.FieldSet>);
    }

    return wave;
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  /**
   * Build an EventWaveSummary from raw Airtable order records.
   */
  private buildEventWaveSummary(
    eventRecordId: string,
    eventId: string,
    schoolName: string,
    eventDate: string,
    orderRecords: Airtable.Record<Airtable.FieldSet>[],
  ): EventWaveSummary {
    const welle1Orders: WaveOrder[] = [];
    const welle2Orders: WaveOrder[] = [];

    for (const record of orderRecords) {
      const waveOrder = this.transformOrderRecord(record, schoolName);
      if (!waveOrder) continue;

      const wave = waveOrder.shipmentWave;

      // 'Rolling' orders are excluded from wave summaries
      if (wave === 'Rolling') continue;

      if (wave === 'Welle 1') {
        welle1Orders.push(waveOrder);
      } else if (wave === 'Welle 2') {
        welle2Orders.push(waveOrder);
      } else if (wave === 'Both') {
        // Split: clothing items go to Welle 1, audio items go to Welle 2
        const welle1LineItems = waveOrder.lineItems.filter(
          (li) => li.waveCategory === 'clothing' || li.waveCategory === 'standard',
        );
        const welle2LineItems = waveOrder.lineItems.filter(
          (li) => li.waveCategory === 'audio',
        );

        if (welle1LineItems.length > 0) {
          welle1Orders.push({ ...waveOrder, lineItems: welle1LineItems });
        }
        if (welle2LineItems.length > 0) {
          welle2Orders.push({ ...waveOrder, lineItems: welle2LineItems });
        }
      }
      // Orders without a recognized wave (null/undefined) are skipped
    }

    // Deadlines: Welle 1 = eventDate - 9 days, Welle 2 = eventDate + 14 days
    const welle1Deadline = calculateWaveDeadline(eventDate, -9);
    const welle2Deadline = calculateWaveDeadline(eventDate, 14);

    return {
      eventRecordId,
      eventId,
      schoolName,
      eventDate,
      welle1: {
        deadline: welle1Deadline,
        orderCount: welle1Orders.length,
        itemSummary: buildItemSummary(welle1Orders),
        fulfillmentStatus: aggregateFulfillmentStatus(welle1Orders),
        orders: welle1Orders,
      },
      welle2: {
        deadline: welle2Deadline,
        orderCount: welle2Orders.length,
        itemSummary: buildItemSummary(welle2Orders),
        fulfillmentStatus: aggregateFulfillmentStatus(welle2Orders),
        orders: welle2Orders,
      },
    };
  }

  /**
   * Transform an Airtable order record into a WaveOrder.
   * Returns null if the order has no shipment_wave set.
   */
  private transformOrderRecord(
    record: Airtable.Record<Airtable.FieldSet>,
    schoolName: string,
  ): WaveOrder | null {
    const shipmentWave = record.get(ORDERS_FIELD_IDS.shipment_wave) as ShipmentWave | undefined;
    if (!shipmentWave) return null;

    // Parse line items JSON
    const lineItemsJson = record.get(ORDERS_FIELD_IDS.line_items) as string;
    let rawLineItems: ShopifyOrderLineItem[] = [];
    if (lineItemsJson) {
      try {
        rawLineItems = JSON.parse(lineItemsJson);
      } catch {
        // Ignore parse errors — treat as empty
      }
    }

    const lineItems: OrderLineItem[] = rawLineItems.map((item) => ({
      variantId: item.variant_id,
      productTitle: item.product_title,
      variantTitle: item.variant_title,
      quantity: item.quantity,
      price: item.price,
      total: item.total,
      waveCategory: toWaveCategory(classifyVariant(item.variant_id)),
    }));

    // Get parent name — stored in parent_id linked record; use school_name as fallback
    // (Detailed parent name resolution would require a separate Parents table lookup,
    //  which is deferred to the UI layer for individual order views.)
    const parentIds = record.get(ORDERS_FIELD_IDS.parent_id) as string[] | undefined;
    const customerName = parentIds?.[0] || 'Unknown';

    return {
      recordId: record.id,
      orderId: (record.get(ORDERS_FIELD_IDS.order_id) as string) || '',
      orderNumber: (record.get(ORDERS_FIELD_IDS.order_number) as string) || '',
      customerName,
      schoolName,
      shipmentWave,
      fulfillmentStatus: (record.get(ORDERS_FIELD_IDS.fulfillment_status) as string) || 'pending',
      paymentStatus: (record.get(ORDERS_FIELD_IDS.payment_status) as string) || 'pending',
      totalAmount: (record.get(ORDERS_FIELD_IDS.total_amount) as number) || 0,
      orderDate: (record.get(ORDERS_FIELD_IDS.order_date) as string) || '',
      lineItems,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let orderWaveServiceInstance: OrderWaveService | null = null;

export function getOrderWaveService(): OrderWaveService {
  if (!orderWaveServiceInstance) {
    orderWaveServiceInstance = new OrderWaveService();
  }
  return orderWaveServiceInstance;
}
