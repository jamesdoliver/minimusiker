import type { EventTimelineOverrides } from '@/lib/utils/eventThresholds';
import type {
  PrintableFieldDef,
  ResolvedFieldValue,
  ResolvedFieldValues,
  ComputedFieldName,
} from './printableFields';

/**
 * Minimal booking shape needed by the resolver. Real callers pass a
 * BookingWithDetails (which is structurally compatible).
 */
export interface ResolverBooking {
  schoolName: string;
  bookingDate: string;        // ISO date (YYYY-MM-DD) or empty
  accessCode?: number;
  isKita?: boolean;
  /** Per-event timeline overrides parsed from Airtable. Optional. */
  timelineOverrides?: EventTimelineOverrides | null;
}

export function resolveFieldValues(
  fields: PrintableFieldDef[],
  booking: ResolverBooking,
): ResolvedFieldValues {
  const out: ResolvedFieldValues = {};
  for (const field of fields) {
    out[field.key] = resolveOne(field, booking);
  }
  return out;
}

function resolveOne(field: PrintableFieldDef, booking: ResolverBooking): ResolvedFieldValue {
  if (field.source.type === 'static') {
    return wrap(field, field.source.value);
  }
  return wrap(field, resolveComputed(field.source.name, booking));
}

function wrap(field: PrintableFieldDef, raw: string): ResolvedFieldValue {
  switch (field.kind) {
    case 'qr':
      return { kind: 'qr', url: raw };
    case 'date':
      return { kind: 'date', text: raw };
    case 'text':
    default:
      return { kind: 'text', text: raw };
  }
}

function resolveComputed(name: ComputedFieldName, booking: ResolverBooking): string {
  switch (name) {
    case 'schoolName':
      return booking.schoolName ?? '';
    // Other computed sources implemented in later tasks.
    default:
      return '';
  }
}
