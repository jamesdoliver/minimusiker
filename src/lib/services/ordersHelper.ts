/**
 * Orders Helper Service
 *
 * Provides utility functions for querying orders using the event_id linked record field
 * instead of the deprecated booking_id text field.
 */

import Airtable from 'airtable';
import { FieldSet } from 'airtable';
import {
  ORDERS_TABLE_ID,
  ORDERS_FIELD_IDS,
  EVENTS_TABLE_ID,
  EVENTS_FIELD_IDS,
} from '@/lib/types/airtable';

type AirtableRecord = Airtable.Record<FieldSet>;

/**
 * Get the Airtable base instance
 */
function getBase(): Airtable.Base {
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
    .base(process.env.AIRTABLE_BASE_ID!);
}

/**
 * Look up an Event record by access_code (numeric) and return its record ID
 * @param accessCode - The numeric access code (e.g., "1562" or 1562)
 * @returns The Airtable record ID or null if not found
 */
export async function getEventRecordIdByAccessCode(
  accessCode: string | number
): Promise<string | null> {
  const base = getBase();

  try {
    const events = await base(EVENTS_TABLE_ID)
      .select({
        filterByFormula: `{${EVENTS_FIELD_IDS.access_code}} = "${accessCode}"`,
        maxRecords: 1,
      })
      .firstPage();

    return events.length > 0 ? events[0].id : null;
  } catch (error) {
    console.error('[ordersHelper] Error looking up event by access_code:', error);
    return null;
  }
}

/**
 * Look up an Event record by event_id field and return its record ID
 * @param eventId - The event_id string (e.g., "evt_school_minimusiker_...")
 * @returns The Airtable record ID or null if not found
 */
export async function getEventRecordIdByEventId(
  eventId: string
): Promise<string | null> {
  const base = getBase();

  try {
    const events = await base(EVENTS_TABLE_ID)
      .select({
        filterByFormula: `{${EVENTS_FIELD_IDS.event_id}} = "${eventId}"`,
        maxRecords: 1,
      })
      .firstPage();

    return events.length > 0 ? events[0].id : null;
  } catch (error) {
    console.error('[ordersHelper] Error looking up event by event_id:', error);
    return null;
  }
}

/**
 * Look up an Event record by legacy_booking_id field and return its record ID
 * Used for backward compatibility with old booking IDs
 * @param bookingId - The legacy booking ID
 * @returns The Airtable record ID or null if not found
 */
export async function getEventRecordIdByLegacyBookingId(
  bookingId: string
): Promise<string | null> {
  const base = getBase();

  try {
    const events = await base(EVENTS_TABLE_ID)
      .select({
        filterByFormula: `{${EVENTS_FIELD_IDS.legacy_booking_id}} = "${bookingId}"`,
        maxRecords: 1,
      })
      .firstPage();

    return events.length > 0 ? events[0].id : null;
  } catch (error) {
    console.error('[ordersHelper] Error looking up event by legacy_booking_id:', error);
    return null;
  }
}

/**
 * Try multiple strategies to resolve an event identifier to a record ID
 * This handles various formats: access_code (numeric), event_id, or legacy booking_id
 * @param identifier - The event identifier (could be access_code, event_id, or legacy booking_id)
 * @returns The Airtable record ID or null if not found
 */
export async function resolveEventRecordId(
  identifier: string
): Promise<string | null> {
  // Strategy 1: If numeric, try as access_code first
  if (/^\d+$/.test(identifier)) {
    const recordId = await getEventRecordIdByAccessCode(identifier);
    if (recordId) return recordId;
  }

  // Strategy 2: Try as event_id (e.g., "evt_school_minimusiker_...")
  const recordIdByEventId = await getEventRecordIdByEventId(identifier);
  if (recordIdByEventId) return recordIdByEventId;

  // Strategy 3: Try as legacy_booking_id
  const recordIdByLegacy = await getEventRecordIdByLegacyBookingId(identifier);
  if (recordIdByLegacy) return recordIdByLegacy;

  console.warn('[ordersHelper] Could not resolve event identifier:', identifier);
  return null;
}

/**
 * Get all orders for a specific event using the event_id linked record field
 * @param eventRecordId - The Airtable record ID of the Event
 * @returns Array of order records
 */
export async function getOrdersByEventRecordId(
  eventRecordId: string
): Promise<AirtableRecord[]> {
  const base = getBase();

  try {
    // Fetch all orders and filter by linked record
    // Note: Airtable doesn't support direct filtering on linked record contents,
    // so we fetch all and filter client-side
    const allOrders = await base(ORDERS_TABLE_ID)
      .select({ returnFieldsByFieldId: true })
      .all();

    return allOrders.filter((order) => {
      const eventIds = order.get(ORDERS_FIELD_IDS.event_id) as string[] | undefined;
      return eventIds && eventIds.includes(eventRecordId);
    });
  } catch (error) {
    console.error('[ordersHelper] Error fetching orders by event record ID:', error);
    return [];
  }
}

/**
 * Get all orders for a specific event with additional filter conditions
 * @param eventRecordId - The Airtable record ID of the Event
 * @param filters - Additional filter conditions to apply
 * @returns Array of order records
 */
export async function getOrdersByEventRecordIdWithFilters(
  eventRecordId: string,
  filters: {
    paymentStatus?: string;
    digitalDelivered?: boolean;
  }
): Promise<AirtableRecord[]> {
  const orders = await getOrdersByEventRecordId(eventRecordId);

  return orders.filter((order) => {
    // Apply payment status filter if specified
    if (filters.paymentStatus) {
      const status = order.get(ORDERS_FIELD_IDS.payment_status) as string | undefined;
      if (status !== filters.paymentStatus) return false;
    }

    // Apply digital delivered filter if specified
    if (filters.digitalDelivered !== undefined) {
      const delivered = order.get(ORDERS_FIELD_IDS.digital_delivered) as boolean | undefined;
      if (delivered !== filters.digitalDelivered) return false;
    }

    return true;
  });
}

/**
 * Convenience function: Get orders for an event by resolving the identifier first
 * @param eventIdentifier - Any form of event identifier (access_code, event_id, legacy booking_id)
 * @returns Array of order records, or empty array if event not found
 */
export async function getOrdersByEventIdentifier(
  eventIdentifier: string
): Promise<AirtableRecord[]> {
  const eventRecordId = await resolveEventRecordId(eventIdentifier);
  if (!eventRecordId) {
    return [];
  }
  return getOrdersByEventRecordId(eventRecordId);
}
