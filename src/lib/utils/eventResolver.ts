/**
 * Centralized Event ID Resolution Utility
 *
 * This module provides a single source of truth for resolving various
 * event identifier formats to Airtable record IDs.
 *
 * Supported ID types (in resolution priority order):
 * 1. Airtable Record ID (starts with "rec", 17 chars)
 * 2. Event ID (starts with "evt_")
 * 3. Legacy Booking ID (starts with "booking_")
 * 4. SimplyBook ID (numeric string - most common for admin panel)
 * 5. Access Code (numeric - used for parent portal short URLs)
 */

import { detectIdentifierType } from '@/lib/types/identifiers';

/**
 * ID type detection patterns
 */
const ID_PATTERNS = {
  airtableRecordId: /^rec[a-zA-Z0-9]{14}$/,
  eventId: /^evt_[a-z0-9_]+_[a-f0-9]{6}$/,
  legacyBookingId: /^booking_/,
  numericId: /^\d+$/,
};

export type IdResolutionMethod =
  | 'airtable_record_id'
  | 'event_id'
  | 'legacy_booking_id'
  | 'simplybook_id'
  | 'access_code'
  | 'not_found';

export interface ResolvedEvent {
  eventRecordId: string;
  eventId: string;
  resolvedVia: IdResolutionMethod;
}

/**
 * Interface for the Airtable service methods needed by the resolver
 * This allows for dependency injection and easier testing
 */
export interface EventResolverDependencies {
  getEventById(recordId: string): Promise<{ id: string; eventId: string } | null>;
  getEventByEventId(eventId: string): Promise<{ id: string; eventId: string } | null>;
  getEventByLegacyBookingId?(bookingId: string): Promise<{ id: string; eventId: string } | null>;
  getSchoolBookingBySimplybookId(simplybookId: string): Promise<{ id: string } | null>;
  getEventBySchoolBookingId(bookingRecordId: string): Promise<{ id: string; eventId: string } | null>;
  getEventByAccessCode(accessCode: number): Promise<{ id: string; eventId: string } | null>;
}

/**
 * Create an event resolver with the given dependencies
 *
 * Usage:
 *   const resolver = createEventResolver(getAirtableService());
 *   const resolved = await resolver.resolve("1703");
 */
export function createEventResolver(deps: EventResolverDependencies) {
  return {
    /**
     * Resolve any event identifier to an Airtable record ID
     *
     * @param unknownId - Any identifier that might refer to an event
     * @returns Resolved event info or null if not found
     */
    async resolve(unknownId: string): Promise<ResolvedEvent | null> {
      const detectedType = detectIdentifierType(unknownId);
      console.log(`[eventResolver] Resolving ID: "${unknownId}" (detected type: ${detectedType})`);

      // 1. Check if it's an Airtable record ID
      if (ID_PATTERNS.airtableRecordId.test(unknownId)) {
        try {
          const event = await deps.getEventById(unknownId);
          if (event) {
            console.log(`[eventResolver] Resolved via airtable_record_id`);
            return {
              eventRecordId: event.id,
              eventId: event.eventId,
              resolvedVia: 'airtable_record_id',
            };
          }
        } catch {
          // Not a valid record ID, continue to other methods
        }
      }

      // 2. Check if it's an event_id format
      if (ID_PATTERNS.eventId.test(unknownId)) {
        const event = await deps.getEventByEventId(unknownId);
        if (event) {
          console.log(`[eventResolver] Resolved via event_id`);
          return {
            eventRecordId: event.id,
            eventId: event.eventId,
            resolvedVia: 'event_id',
          };
        }
      }

      // 3. Check if it's a legacy booking ID
      if (ID_PATTERNS.legacyBookingId.test(unknownId) && deps.getEventByLegacyBookingId) {
        const event = await deps.getEventByLegacyBookingId(unknownId);
        if (event) {
          console.log(`[eventResolver] Resolved via legacy_booking_id`);
          return {
            eventRecordId: event.id,
            eventId: event.eventId,
            resolvedVia: 'legacy_booking_id',
          };
        }
      }

      // 4. For numeric strings, try SimplyBook ID first (most common admin case)
      if (ID_PATTERNS.numericId.test(unknownId)) {
        // Try SimplyBook ID first
        const booking = await deps.getSchoolBookingBySimplybookId(unknownId);
        if (booking) {
          const linkedEvent = await deps.getEventBySchoolBookingId(booking.id);
          if (linkedEvent) {
            console.log(`[eventResolver] Resolved via simplybook_id: ${unknownId} -> booking ${booking.id} -> event ${linkedEvent.id}`);
            return {
              eventRecordId: linkedEvent.id,
              eventId: linkedEvent.eventId,
              resolvedVia: 'simplybook_id',
            };
          }
        }

        // Try access code
        const accessCode = parseInt(unknownId, 10);
        if (!isNaN(accessCode)) {
          const eventByAccessCode = await deps.getEventByAccessCode(accessCode);
          if (eventByAccessCode) {
            console.log(`[eventResolver] Resolved via access_code`);
            return {
              eventRecordId: eventByAccessCode.id,
              eventId: eventByAccessCode.eventId,
              resolvedVia: 'access_code',
            };
          }
        }
      }

      // Not found by any method
      console.warn(`[eventResolver] Could not resolve ID: "${unknownId}"`);
      return null;
    },

    /**
     * Detect the likely type of an identifier without resolving it
     */
    detectType(id: string): IdResolutionMethod | 'unknown' {
      if (ID_PATTERNS.airtableRecordId.test(id)) return 'airtable_record_id';
      if (ID_PATTERNS.eventId.test(id)) return 'event_id';
      if (ID_PATTERNS.legacyBookingId.test(id)) return 'legacy_booking_id';
      if (ID_PATTERNS.numericId.test(id)) return 'simplybook_id'; // Could also be access_code
      return 'unknown';
    },
  };
}

/**
 * Standalone function for simple resolution
 * Note: This imports airtableService lazily to avoid circular dependencies
 */
export async function resolveEventId(unknownId: string): Promise<ResolvedEvent | null> {
  // Lazy import to avoid circular dependency
  const { getAirtableService } = await import('@/lib/services/airtableService');
  const airtable = getAirtableService();

  // Helper to map Event (snake_case) to resolver interface (camelCase)
  const mapEvent = (event: { id: string; event_id: string } | null) =>
    event ? { id: event.id, eventId: event.event_id } : null;

  const resolver = createEventResolver({
    getEventById: async (recordId) => {
      try {
        const event = await airtable.getEventById(recordId);
        return mapEvent(event);
      } catch {
        return null;
      }
    },
    getEventByEventId: async (eventId) => mapEvent(await airtable.getEventByEventId(eventId)),
    getSchoolBookingBySimplybookId: (simplybookId) => airtable.getSchoolBookingBySimplybookId(simplybookId),
    getEventBySchoolBookingId: async (bookingRecordId) => mapEvent(await airtable.getEventBySchoolBookingId(bookingRecordId)),
    getEventByAccessCode: async (accessCode) => mapEvent(await airtable.getEventByAccessCode(accessCode)),
  });

  return resolver.resolve(unknownId);
}
