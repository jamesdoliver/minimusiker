import { getAirtableService } from '@/lib/services/airtableService';
import {
  ORDERS_TABLE_ID,
  ORDERS_FIELD_IDS,
  ShopifyOrderLineItem,
} from '@/lib/types/airtable';
import { buildClassToEventMap, resolveOrderEventId } from '@/lib/utils/orderEventResolver';
import { MINICARD_VARIANT_IDS } from '@/lib/config/shopProfiles';

/**
 * Check if a parent has purchased a Minicard (or Minicard-containing product)
 * for a specific event.
 *
 * Checks:
 * 1. Query Orders table for paid orders linked to the parent
 * 2. Resolve each order's event (using orderEventResolver pattern)
 * 3. Filter to orders matching the target event
 * 4. Check if any line item's variant_id matches a known minicard variant ID
 *    OR product_title contains "minicard" (case-insensitive)
 */
export async function hasMinicardForEvent(
  parentRecordId: string,
  eventId: string
): Promise<boolean> {
  const airtable = getAirtableService();
  const base = airtable.getBase();
  const ordersTable = base(ORDERS_TABLE_ID);

  // 1. Query orders linked to this parent with payment_status = 'paid'
  const orders = await ordersTable
    .select({
      filterByFormula: `AND(
        {${ORDERS_FIELD_IDS.payment_status}} = 'paid',
        FIND('${parentRecordId}', ARRAYJOIN({${ORDERS_FIELD_IDS.parent_id}}, ','))
      )`,
      returnFieldsByFieldId: true,
    })
    .all();

  if (orders.length === 0) return false;

  // 2. Build class→event map for resolving order events
  const classToEvent = await buildClassToEventMap(base);

  // 3. For each order, check if it's for this event and contains a minicard
  for (const order of orders) {
    // Resolve the event record ID for this order
    const orderEventRecordId = resolveOrderEventId(order, classToEvent);

    // We need to compare event record ID with eventId
    // The eventId from the parent session is the canonical event_id (e.g., evt_...)
    // but resolveOrderEventId returns the Airtable record ID of the event.
    // We need to check both: direct event_id linked field AND text-based event matching.

    // Check if this order is for the target event
    // Method 1: Direct event_id field match via booking_id
    const orderBookingId = order.get(ORDERS_FIELD_IDS.booking_id) as string | undefined;

    // Method 2: Check event_id link matches
    const eventIds = order.get(ORDERS_FIELD_IDS.event_id) as string[] | undefined;

    // We need to check if the order's event matches our target eventId.
    // Since eventId could be a canonical event_id string OR a record ID,
    // we compare booking_id (which often equals eventId in the parent journey).
    // Also check if the event_id linked records resolve to the target.
    let isForEvent = false;

    if (orderBookingId && orderBookingId === eventId) {
      isForEvent = true;
    }

    // Also try matching via the event record IDs
    // To do this properly, we'd need to look up the event by event_id,
    // but for efficiency we also match on the resolved event record.
    if (!isForEvent && eventIds) {
      // Look up the event to get its canonical event_id
      try {
        for (const eventRecId of eventIds) {
          const eventRecord = await base('Events').find(eventRecId);
          const canonicalEventId = eventRecord.get('event_id') as string | undefined;
          if (canonicalEventId === eventId) {
            isForEvent = true;
            break;
          }
        }
      } catch {
        // Event lookup failed, continue with other matching methods
      }
    }

    if (!isForEvent) continue;

    // 4. Parse line_items and check for minicard variants
    const lineItemsRaw = order.get(ORDERS_FIELD_IDS.line_items) as string | undefined;
    if (!lineItemsRaw) continue;

    let lineItems: ShopifyOrderLineItem[];
    try {
      lineItems = typeof lineItemsRaw === 'string' ? JSON.parse(lineItemsRaw) : lineItemsRaw;
    } catch {
      continue;
    }

    for (const item of lineItems) {
      // Check variant_id against known minicard variants
      const variantIdNumeric = item.variant_id?.replace('gid://shopify/ProductVariant/', '') || '';
      if (MINICARD_VARIANT_IDS.has(variantIdNumeric)) {
        return true;
      }

      // Fallback: check product_title contains "minicard" or "tonie"
      const title = (item.product_title || '').toLowerCase();
      if (title.includes('minicard') || title.includes('tonie')) {
        return true;
      }
    }
  }

  return false;
}
