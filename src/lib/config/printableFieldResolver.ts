import { getThreshold } from '@/lib/utils/eventThresholds';
import type { EventTimelineOverrides } from '@/lib/utils/eventThresholds';
import type { MasterCdTrack } from '@/lib/services/masterCdService';
import type {
  PrintableFieldDef,
  ResolvedFieldValue,
  ResolvedFieldValues,
  ComputedFieldName,
} from './printableFields';

/**
 * Minimal booking shape needed by the resolver. Real callers pass a
 * BookingWithDetails (which is structurally compatible). Per-event timeline
 * overrides are passed separately to `resolveFieldValues`, since
 * BookingWithDetails does not carry them.
 */
export interface ResolverBooking {
  schoolName: string;
  bookingDate: string;        // ISO date (YYYY-MM-DD) or empty
  accessCode?: number;
  isKita?: boolean;
}

export function resolveFieldValues(
  fields: PrintableFieldDef[],
  booking: ResolverBooking,
  overrides?: EventTimelineOverrides | null,
  tracklist?: MasterCdTrack[] | null,
): ResolvedFieldValues {
  const out: ResolvedFieldValues = {};
  for (const field of fields) {
    out[field.key] = resolveOne(field, booking, overrides ?? null, tracklist ?? null);
  }
  return out;
}

function resolveOne(
  field: PrintableFieldDef,
  booking: ResolverBooking,
  overrides: EventTimelineOverrides | null,
  tracklist: MasterCdTrack[] | null,
): ResolvedFieldValue {
  if (field.source.type === 'static') {
    return wrap(field, field.source.value);
  }
  return wrap(field, resolveComputed(field.source.name, booking, overrides, tracklist));
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

function resolveComputed(
  name: ComputedFieldName,
  booking: ResolverBooking,
  overrides: EventTimelineOverrides | null,
  tracklist: MasterCdTrack[] | null,
): string {
  switch (name) {
    case 'schoolName':
      return booking.schoolName ?? '';
    case 'schuleOrKita':
      return booking.isKita ? 'KiTa' : 'Schule';
    case 'qrUrl':
      return booking.accessCode ? `https://minimusiker.app/e/${booking.accessCode}` : '';
    case 'eventDateLocation': {
      const date = formatGermanShortDate(booking.bookingDate);
      if (!date) return '';
      // Reference layout wraps after "in der"; the renderer doesn't auto-wrap,
      // so inject the break here.
      return `Am ${date} in der\n${booking.schoolName ?? ''}`;
    }
    case 'earlyBirdDeadline': {
      if (!booking.bookingDate) return '';
      const days = getThreshold('early_bird_deadline_days', overrides);
      return subtractDaysIso(booking.bookingDate, days);
    }
    case 'tshirtBodyParagraph': {
      const word = booking.isKita ? 'KiTa' : 'Schule';
      return `Mit dem passenden T-Shirt oder Hoodie eurer ${word}, strahlt nicht nur die Stimme, sondern auch dein Kind.`;
    }
    case 'qrCaption':
      return booking.accessCode ? `minimusiker.app/e/${booking.accessCode}` : '';
    case 'songList': {
      if (!tracklist || tracklist.length === 0) return '';
      const sorted = [...tracklist].sort((a, b) => a.trackNumber - b.trackNumber);
      return sorted.map(t => `${t.trackNumber}. ${t.title} ${t.className}`).join('\n');
    }
    case 'eventDateHeadline': {
      const date = formatGermanShortDate(booking.bookingDate);
      if (!date) return '';
      return `Minimusikertag am ${date}`;
    }
    case 'eventDatePostHeadline': {
      const date = formatGermanShortDate(booking.bookingDate);
      if (!date) return '';
      return `Das war unser Minimusikertag am ${date}`;
    }
    case 'eventDateShort':
      return formatGermanShortDate(booking.bookingDate);
    case 'flyerSubtitlePreEvent':
      return `Nur noch wenige Tage bis zum Minimusikertag im ${booking.schoolName ?? ''}`;
    case 'flyer3WowBody': {
      const word = booking.isKita ? 'KiTa' : 'Schule';
      return `Heute haben wir mit der ganzen ${word} und allen Kindern soooooo viele Lieder aufgenommen. Das hat Spaß gemacht und richtig gut geklappt.`;
    }
    case 'flyer3LiebeBody': {
      const word = booking.isKita ? 'KiTa' : 'Schule';
      return `Über diesen QR-Code könnt ihr die Aufnahmen vom Minimusikertag bestellen. Passend dazu gibt es T-Shirts oder einen Hoodie mit dem Namen eurer ${word}.`;
    }
    default: {
      const _exhaustive: never = name;
      return _exhaustive;
    }
  }
}

function parseIsoDate(iso: string): { y: number; m: number; d: number } | null {
  if (!iso) return null;
  const datePart = iso.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function formatDDMMYYYY(p: { y: number; m: number; d: number }): string {
  const day = String(p.d).padStart(2, '0');
  const mo = String(p.m).padStart(2, '0');
  return `${day}.${mo}.${p.y}`;
}

function formatGermanShortDate(iso: string): string {
  const parsed = parseIsoDate(iso);
  return parsed ? formatDDMMYYYY(parsed) : '';
}

function subtractDaysIso(iso: string, days: number): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return '';
  // All UTC: Date.UTC + setUTCDate + getUTC* — never local methods (DST hazard).
  const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  date.setUTCDate(date.getUTCDate() - days);
  return formatDDMMYYYY({
    y: date.getUTCFullYear(),
    m: date.getUTCMonth() + 1,
    d: date.getUTCDate(),
  });
}

/**
 * Project a BookingWithDetails-compatible value into the minimal ResolverBooking
 * shape. Use at call sites that need to feed the resolver from the API booking
 * type, so the projection logic lives in one place.
 *
 * Note: BookingWithDetails does not carry timeline overrides; pass those
 * separately to resolveFieldValues.
 */
export function bookingToResolverInput(b: {
  schoolName: string;
  bookingDate: string;
  accessCode?: number;
  isKita?: boolean;
}): ResolverBooking {
  return {
    schoolName: b.schoolName,
    bookingDate: b.bookingDate,
    accessCode: b.accessCode,
    isKita: b.isKita,
  };
}
