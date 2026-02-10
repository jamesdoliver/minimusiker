// src/lib/utils/orderEventResolver.ts

import Airtable from 'airtable';
import {
  ORDERS_FIELD_IDS,
  CLASSES_TABLE_ID,
  CLASSES_FIELD_IDS,
} from '@/lib/types/airtable';

/**
 * Build a map from class record ID to event record ID.
 * Fetched once per method call to avoid N+1 queries.
 */
export async function buildClassToEventMap(
  base: ReturnType<Airtable['base']>
): Promise<Map<string, string>> {
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
 * falling back to class_id -> event_id lookup.
 */
export function resolveOrderEventId(
  order: Airtable.Record<Airtable.FieldSet>,
  classToEvent: Map<string, string>
): string | undefined {
  // Path 1: Direct event_id linked field
  const eventIds = order.get(ORDERS_FIELD_IDS.event_id) as string[] | undefined;
  if (eventIds?.[0]) return eventIds[0];

  // Path 2: Fallback via class_id -> event_id
  const classIds = order.get(ORDERS_FIELD_IDS.class_id) as string[] | undefined;
  if (classIds?.[0]) {
    return classToEvent.get(classIds[0]);
  }

  return undefined;
}
