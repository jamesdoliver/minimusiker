import { getAirtableService } from '@/lib/services/airtableService';
import {
  ORDERS_TABLE_ID,
  ORDERS_FIELD_IDS,
  ShopifyOrderLineItem,
} from '@/lib/types/airtable';
import { AUDIO_PRODUCT_VARIANT_IDS } from '@/lib/config/shopProfiles';

// 'cd' deliberately omitted — too short, would false-match titles like "ABCD pack".
// CD variants are covered by variant_id matching against AUDIO_PRODUCT_VARIANT_IDS.
const AUDIO_TITLE_KEYWORDS = ['minicard', 'kinderliederbox', 'tonie'];

/**
 * Pure: does any line item count as an audio-category purchase?
 * Order matters: variant_id is authoritative, product_title is a fallback
 * for legacy / custom orders where the variant isn't in our variant-ID set.
 */
export function classifyLineItemsAsAudioPurchase(
  lineItems: ShopifyOrderLineItem[] | null | undefined
): boolean {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return false;
  for (const item of lineItems) {
    const numericId = (item.variant_id || '').replace('gid://shopify/ProductVariant/', '');
    if (numericId && AUDIO_PRODUCT_VARIANT_IDS.has(numericId)) return true;

    const title = (item.product_title || '').toLowerCase();
    for (const kw of AUDIO_TITLE_KEYWORDS) {
      if (title.includes(kw)) return true;
    }
  }
  return false;
}

/**
 * Has this parent purchased ANY audio-category product (minicard, CD,
 * bundle, or Kinderliederbox) for this event?
 *
 * Used to split the parent "Mix fertig" trigger email between buyers and
 * non-buyers. Distinct from `hasMinicardForEvent` (audio-access gate),
 * which deliberately excludes CD-only buyers.
 *
 * Implementation mirrors `hasMinicardForEvent` exactly so the behaviour
 * around event matching (booking_id and event_id link) stays consistent.
 */
export async function hasAudioPurchaseForEvent(
  parentRecordId: string,
  eventId: string
): Promise<boolean> {
  const airtable = getAirtableService();
  const base = airtable.getBase();
  const ordersTable = base(ORDERS_TABLE_ID);

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

  for (const order of orders) {
    const orderBookingId = order.get(ORDERS_FIELD_IDS.booking_id) as string | undefined;
    const eventIds = order.get(ORDERS_FIELD_IDS.event_id) as string[] | undefined;

    let isForEvent = false;
    if (orderBookingId && orderBookingId === eventId) isForEvent = true;
    if (!isForEvent && eventIds) {
      try {
        for (const eventRecId of eventIds) {
          const eventRecord = await base('Events').find(eventRecId);
          const canonicalEventId = eventRecord.get('event_id') as string | undefined;
          if (canonicalEventId === eventId) { isForEvent = true; break; }
        }
      } catch {
        // event lookup failed — continue with what we have
      }
    }
    if (!isForEvent) continue;

    const lineItemsRaw = order.get(ORDERS_FIELD_IDS.line_items);
    let lineItems: ShopifyOrderLineItem[];
    try {
      lineItems = typeof lineItemsRaw === 'string'
        ? JSON.parse(lineItemsRaw)
        : (lineItemsRaw as unknown as ShopifyOrderLineItem[]);
    } catch {
      continue;
    }

    if (classifyLineItemsAsAudioPurchase(lineItems)) return true;
  }

  return false;
}
