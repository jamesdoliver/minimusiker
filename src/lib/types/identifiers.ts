/**
 * Branded types for event-related identifiers
 *
 * These types use TypeScript's structural typing with a brand property
 * to create nominally-typed identifiers that prevent accidental mixing.
 *
 * Usage:
 *   const sbId = asSimplybookId("1703"); // SimplybookId | null
 *   const evtId = asEventId("evt_school_20240115_abc123"); // EventId | null
 *
 *   // Compile error: Type 'SimplybookId' is not assignable to type 'EventId'
 *   someFunction(sbId); // if someFunction expects EventId
 */

// Brand symbols (never actually exist at runtime)
declare const SimplybookIdBrand: unique symbol;
declare const EventIdBrand: unique symbol;
declare const AccessCodeBrand: unique symbol;
declare const AirtableRecordIdBrand: unique symbol;
declare const LegacyBookingIdBrand: unique symbol;

// Branded type definitions
export type SimplybookId = string & { readonly [SimplybookIdBrand]: never };
export type EventId = string & { readonly [EventIdBrand]: never };
export type AccessCode = number & { readonly [AccessCodeBrand]: never };
export type AirtableRecordId = string & { readonly [AirtableRecordIdBrand]: never };
export type LegacyBookingId = string & { readonly [LegacyBookingIdBrand]: never };

// Union type for any event identifier
export type AnyEventIdentifier =
  | SimplybookId
  | EventId
  | AccessCode
  | AirtableRecordId
  | LegacyBookingId;

// Validation patterns
const PATTERNS = {
  simplybookId: /^\d+$/,
  eventId: /^evt_[a-z0-9_]+_[a-f0-9]{6}$/,
  airtableRecordId: /^rec[a-zA-Z0-9]{14}$/,
  legacyBookingId: /^booking_/,
};

/**
 * Safely cast a string to SimplybookId (numeric string)
 */
export function asSimplybookId(id: string): SimplybookId | null {
  if (PATTERNS.simplybookId.test(id)) {
    return id as SimplybookId;
  }
  return null;
}

/**
 * Safely cast a string to EventId (evt_* format)
 */
export function asEventId(id: string): EventId | null {
  if (PATTERNS.eventId.test(id)) {
    return id as EventId;
  }
  return null;
}

/**
 * Safely cast a number to AccessCode
 */
export function asAccessCode(code: number): AccessCode | null {
  if (Number.isInteger(code) && code > 0 && code < 100000) {
    return code as AccessCode;
  }
  return null;
}

/**
 * Safely cast a string to AirtableRecordId
 */
export function asAirtableRecordId(id: string): AirtableRecordId | null {
  if (PATTERNS.airtableRecordId.test(id)) {
    return id as AirtableRecordId;
  }
  return null;
}

/**
 * Safely cast a string to LegacyBookingId
 */
export function asLegacyBookingId(id: string): LegacyBookingId | null {
  if (PATTERNS.legacyBookingId.test(id)) {
    return id as LegacyBookingId;
  }
  return null;
}

/**
 * Type guard to check if a value is a SimplybookId
 */
export function isSimplybookId(id: unknown): id is SimplybookId {
  return typeof id === 'string' && PATTERNS.simplybookId.test(id);
}

/**
 * Type guard to check if a value is an EventId
 */
export function isEventId(id: unknown): id is EventId {
  return typeof id === 'string' && PATTERNS.eventId.test(id);
}

/**
 * Type guard to check if a value is an AirtableRecordId
 */
export function isAirtableRecordId(id: unknown): id is AirtableRecordId {
  return typeof id === 'string' && PATTERNS.airtableRecordId.test(id);
}

/**
 * Type guard to check if a value is a LegacyBookingId
 */
export function isLegacyBookingId(id: unknown): id is LegacyBookingId {
  return typeof id === 'string' && PATTERNS.legacyBookingId.test(id);
}

/**
 * Detect the likely type of an identifier string
 */
export function detectIdentifierType(id: string):
  | 'simplybook_id'
  | 'event_id'
  | 'airtable_record_id'
  | 'legacy_booking_id'
  | 'unknown' {
  if (PATTERNS.airtableRecordId.test(id)) return 'airtable_record_id';
  if (PATTERNS.eventId.test(id)) return 'event_id';
  if (PATTERNS.legacyBookingId.test(id)) return 'legacy_booking_id';
  if (PATTERNS.simplybookId.test(id)) return 'simplybook_id';
  return 'unknown';
}
