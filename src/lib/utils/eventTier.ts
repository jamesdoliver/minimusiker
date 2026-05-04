/**
 * Event tier predicates.
 *
 * Schulsong-only = event has a schulsong but no MiniMusikertag and no Plus tier.
 * These events skip class management, tracklist confirmation, and the
 * preparation/resources/shop flows in the teacher portal.
 */

export interface EventTierFields {
  is_schulsong?: boolean;
  is_minimusikertag?: boolean;
  is_plus?: boolean;
}

export function isSchulsongOnlyEvent(event: EventTierFields): boolean {
  return (
    event.is_schulsong === true &&
    event.is_minimusikertag !== true &&
    event.is_plus !== true
  );
}
