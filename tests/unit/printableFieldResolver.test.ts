import { resolveFieldValues, bookingToResolverInput, type ResolverBooking } from '@/lib/config/printableFieldResolver';
import type { PrintableFieldDef } from '@/lib/config/printableFields';
import type { MasterCdTrack } from '@/lib/services/masterCdService';

const baseBooking: ResolverBooking = {
  schoolName: 'Lindenschule Halle',
  bookingDate: '2026-06-02',
  accessCode: 112,
  isKita: false,
};

describe('resolveFieldValues', () => {
  it('returns empty object when given an empty registry', () => {
    expect(resolveFieldValues([], baseBooking)).toEqual({});
  });

  it('resolves a static text field to its literal value', () => {
    const fields: PrintableFieldDef[] = [
      {
        key: 'tagline',
        label: 'Tagline',
        kind: 'text',
        defaultPosition: { x: 0, y: 0 },
        defaultSize: { width: 0, height: 0 },
        draggable: false,
        source: { type: 'static', value: 'Hallo' },
      },
    ];
    expect(resolveFieldValues(fields, baseBooking)).toEqual({
      tagline: { kind: 'text', text: 'Hallo' },
    });
  });

  it('resolves computed.schoolName to booking.schoolName', () => {
    const fields: PrintableFieldDef[] = [
      {
        key: 'shirt-label',
        label: 'Shirt label',
        kind: 'text',
        defaultPosition: { x: 0, y: 0 },
        defaultSize: { width: 0, height: 0 },
        draggable: true,
        source: { type: 'computed', name: 'schoolName' },
      },
    ];
    expect(resolveFieldValues(fields, baseBooking)).toEqual({
      'shirt-label': { kind: 'text', text: 'Lindenschule Halle' },
    });
  });
});

describe('resolveFieldValues — schuleOrKita', () => {
  const field: PrintableFieldDef = {
    key: 'school-or-kita',
    label: 'Institution word',
    kind: 'text',
    defaultPosition: { x: 0, y: 0 },
    defaultSize: { width: 0, height: 0 },
    draggable: false,
    source: { type: 'computed', name: 'schuleOrKita' },
  };

  it('returns "Schule" when isKita is false', () => {
    expect(resolveFieldValues([field], { ...baseBooking, isKita: false })).toEqual({
      'school-or-kita': { kind: 'text', text: 'Schule' },
    });
  });

  it('returns "KiTa" when isKita is true', () => {
    expect(resolveFieldValues([field], { ...baseBooking, isKita: true })).toEqual({
      'school-or-kita': { kind: 'text', text: 'KiTa' },
    });
  });

  it('returns "Schule" when isKita is undefined (default)', () => {
    const { isKita: _ignored, ...rest } = baseBooking;
    expect(resolveFieldValues([field], rest)).toEqual({
      'school-or-kita': { kind: 'text', text: 'Schule' },
    });
  });
});

describe('resolveFieldValues — qrUrl', () => {
  const field: PrintableFieldDef = {
    key: 'qr',
    label: 'QR code',
    kind: 'qr',
    defaultPosition: { x: 0, y: 0 },
    defaultSize: { width: 0, height: 0 },
    draggable: true,
    source: { type: 'computed', name: 'qrUrl' },
  };

  it('builds the canonical short URL from accessCode', () => {
    expect(resolveFieldValues([field], { ...baseBooking, accessCode: 112 })).toEqual({
      qr: { kind: 'qr', url: 'https://minimusiker.app/e/112' },
    });
  });

  it('returns an empty url when accessCode is missing', () => {
    const { accessCode: _ignored, ...rest } = baseBooking;
    expect(resolveFieldValues([field], rest)).toEqual({
      qr: { kind: 'qr', url: '' },
    });
  });
});

describe('resolveFieldValues — eventDateLocation', () => {
  const field: PrintableFieldDef = {
    key: 'event-date-location',
    label: 'Event date + location',
    kind: 'text',
    defaultPosition: { x: 0, y: 0 },
    defaultSize: { width: 0, height: 0 },
    draggable: true,
    source: { type: 'computed', name: 'eventDateLocation' },
  };

  it('formats ISO bookingDate as DD.MM.YYYY with school name (newline before school)', () => {
    expect(resolveFieldValues([field], baseBooking)).toEqual({
      'event-date-location': { kind: 'text', text: 'Am 02.06.2026 in der\nLindenschule Halle' },
    });
  });

  it('returns just the date prefix when schoolName is empty', () => {
    expect(resolveFieldValues([field], { ...baseBooking, schoolName: '' })).toEqual({
      'event-date-location': { kind: 'text', text: 'Am 02.06.2026 in der\n' },
    });
  });

  it('returns empty string when bookingDate is missing', () => {
    expect(resolveFieldValues([field], { ...baseBooking, bookingDate: '' })).toEqual({
      'event-date-location': { kind: 'text', text: '' },
    });
  });

  it('handles a bookingDate that already includes a time component', () => {
    expect(resolveFieldValues([field], { ...baseBooking, bookingDate: '2026-06-02T09:00:00.000Z' })).toEqual({
      'event-date-location': { kind: 'text', text: 'Am 02.06.2026 in der\nLindenschule Halle' },
    });
  });
});

describe('resolveFieldValues — earlyBirdDeadline', () => {
  const field: PrintableFieldDef = {
    key: 'discount-end',
    label: 'Discount end date',
    kind: 'date',
    defaultPosition: { x: 0, y: 0 },
    defaultSize: { width: 0, height: 0 },
    draggable: true,
    source: { type: 'computed', name: 'earlyBirdDeadline' },
  };

  it('subtracts the global default (19 days) from bookingDate', () => {
    // 2026-06-02 minus 19 days = 2026-05-14
    expect(resolveFieldValues([field], { ...baseBooking, bookingDate: '2026-06-02' })).toEqual({
      'discount-end': { kind: 'date', text: '14.05.2026' },
    });
  });

  it('respects per-event timeline override', () => {
    // 2026-06-02 minus 10 days = 2026-05-23
    expect(
      resolveFieldValues(
        [field],
        { ...baseBooking, bookingDate: '2026-06-02' },
        { early_bird_deadline_days: 10 },
      ),
    ).toEqual({
      'discount-end': { kind: 'date', text: '23.05.2026' },
    });
  });

  it('returns empty when bookingDate is missing', () => {
    expect(resolveFieldValues([field], { ...baseBooking, bookingDate: '' })).toEqual({
      'discount-end': { kind: 'date', text: '' },
    });
  });

  it('handles cross-month and cross-year boundaries (timezone-safe)', () => {
    // 2026-01-05 minus 19 days = 2025-12-17
    expect(resolveFieldValues([field], { ...baseBooking, bookingDate: '2026-01-05' })).toEqual({
      'discount-end': { kind: 'date', text: '17.12.2025' },
    });
  });

  it('treats an explicit null overrides argument the same as omitting it', () => {
    expect(resolveFieldValues([field], { ...baseBooking, bookingDate: '2026-06-02' }, null)).toEqual({
      'discount-end': { kind: 'date', text: '14.05.2026' },
    });
  });
});

describe('resolveFieldValues — tshirtBodyParagraph', () => {
  const field: PrintableFieldDef = {
    key: 'tshirt-body',
    label: 'T-shirt body paragraph',
    kind: 'text',
    defaultPosition: { x: 0, y: 0 },
    defaultSize: { width: 0, height: 0 },
    draggable: true,
    source: { type: 'computed', name: 'tshirtBodyParagraph' },
  };

  it('uses "Schule" for schools (isKita false)', () => {
    expect(resolveFieldValues([field], { ...baseBooking, isKita: false })).toEqual({
      'tshirt-body': {
        kind: 'text',
        text: 'Mit dem passenden T-Shirt oder Hoodie eurer Schule, strahlt nicht nur die Stimme, sondern auch dein Kind.',
      },
    });
  });

  it('uses "KiTa" for KiTas (isKita true)', () => {
    expect(resolveFieldValues([field], { ...baseBooking, isKita: true })).toEqual({
      'tshirt-body': {
        kind: 'text',
        text: 'Mit dem passenden T-Shirt oder Hoodie eurer KiTa, strahlt nicht nur die Stimme, sondern auch dein Kind.',
      },
    });
  });
});

describe('resolveFieldValues — qrCaption', () => {
  const field: PrintableFieldDef = {
    key: 'qr-caption',
    label: 'QR caption',
    kind: 'text',
    defaultPosition: { x: 0, y: 0 },
    defaultSize: { width: 0, height: 0 },
    draggable: true,
    source: { type: 'computed', name: 'qrCaption' },
  };

  it('builds the bare-host short URL from accessCode (no scheme)', () => {
    expect(resolveFieldValues([field], { ...baseBooking, accessCode: 112 })).toEqual({
      'qr-caption': { kind: 'text', text: 'minimusiker.app/e/112' },
    });
  });

  it('returns empty when accessCode is missing', () => {
    const { accessCode: _ignored, ...rest } = baseBooking;
    expect(resolveFieldValues([field], rest)).toEqual({
      'qr-caption': { kind: 'text', text: '' },
    });
  });
});

describe('resolveFieldValues — songList', () => {
  const field: PrintableFieldDef = {
    key: 'songs',
    label: 'Song list',
    kind: 'text',
    defaultPosition: { x: 0, y: 0 },
    defaultSize: { width: 0, height: 0 },
    draggable: true,
    multiline: true,
    source: { type: 'computed', name: 'songList' },
  };

  const sampleTracks: MasterCdTrack[] = [
    { trackNumber: 1, songId: 's1', title: 'Unsere Schule ist bewegt', className: 'Alle Kinder', status: 'ready' },
    { trackNumber: 2, songId: 's2', title: 'Genauso wie ich bin', className: 'Alle Kinder', status: 'ready' },
    { trackNumber: 3, songId: 's3', title: 'Das Lied über mich', className: 'Klasse 1a', status: 'ready' },
  ];

  it('formats tracks as numbered multi-line text', () => {
    expect(resolveFieldValues([field], baseBooking, null, sampleTracks)).toEqual({
      songs: {
        kind: 'text',
        text:
          '1. Unsere Schule ist bewegt Alle Kinder\n' +
          '2. Genauso wie ich bin Alle Kinder\n' +
          '3. Das Lied über mich Klasse 1a',
      },
    });
  });

  it('returns empty when tracklist is null', () => {
    expect(resolveFieldValues([field], baseBooking, null, null)).toEqual({
      songs: { kind: 'text', text: '' },
    });
  });

  it('returns empty when tracklist is empty array', () => {
    expect(resolveFieldValues([field], baseBooking, null, [])).toEqual({
      songs: { kind: 'text', text: '' },
    });
  });

  it('preserves track ordering by trackNumber', () => {
    const outOfOrder: MasterCdTrack[] = [
      { trackNumber: 3, songId: 's3', title: 'C', className: 'C-class', status: 'ready' },
      { trackNumber: 1, songId: 's1', title: 'A', className: 'A-class', status: 'ready' },
      { trackNumber: 2, songId: 's2', title: 'B', className: 'B-class', status: 'ready' },
    ];
    const result = resolveFieldValues([field], baseBooking, null, outOfOrder);
    expect((result.songs as { kind: 'text'; text: string }).text).toBe(
      '1. A A-class\n2. B B-class\n3. C C-class',
    );
  });
});

describe('resolveFieldValues — eventDateHeadline', () => {
  const field: PrintableFieldDef = {
    key: 'h',
    label: 'Event date headline',
    kind: 'text',
    defaultPosition: { x: 0, y: 0 },
    defaultSize: { width: 0, height: 0 },
    draggable: true,
    source: { type: 'computed', name: 'eventDateHeadline' },
  };

  it('formats as "Minimusikertag am DD.MM.YYYY"', () => {
    expect(resolveFieldValues([field], { ...baseBooking, bookingDate: '2026-05-08' })).toEqual({
      h: { kind: 'text', text: 'Minimusikertag am 08.05.2026' },
    });
  });

  it('returns empty when bookingDate is missing', () => {
    expect(resolveFieldValues([field], { ...baseBooking, bookingDate: '' })).toEqual({
      h: { kind: 'text', text: '' },
    });
  });
});

describe('resolveFieldValues — eventDatePostHeadline', () => {
  const field: PrintableFieldDef = {
    key: 'p',
    label: 'Post-event date headline',
    kind: 'text',
    defaultPosition: { x: 0, y: 0 },
    defaultSize: { width: 0, height: 0 },
    draggable: true,
    source: { type: 'computed', name: 'eventDatePostHeadline' },
  };

  it('formats as "Das war unser Minimusikertag am DD.MM.YYYY"', () => {
    expect(resolveFieldValues([field], { ...baseBooking, bookingDate: '2026-03-17' })).toEqual({
      p: { kind: 'text', text: 'Das war unser Minimusikertag am 17.03.2026' },
    });
  });

  it('returns empty when bookingDate is missing', () => {
    expect(resolveFieldValues([field], { ...baseBooking, bookingDate: '' })).toEqual({
      p: { kind: 'text', text: '' },
    });
  });
});

describe('resolveFieldValues — eventDateShort', () => {
  const field: PrintableFieldDef = {
    key: 'd',
    label: 'Event date short',
    kind: 'text',
    defaultPosition: { x: 0, y: 0 },
    defaultSize: { width: 0, height: 0 },
    draggable: true,
    source: { type: 'computed', name: 'eventDateShort' },
  };

  it('formats bookingDate as DD.MM.YYYY only', () => {
    expect(resolveFieldValues([field], { ...baseBooking, bookingDate: '2026-03-17' })).toEqual({
      d: { kind: 'text', text: '17.03.2026' },
    });
  });

  it('returns empty when bookingDate is missing', () => {
    expect(resolveFieldValues([field], { ...baseBooking, bookingDate: '' })).toEqual({
      d: { kind: 'text', text: '' },
    });
  });
});

describe('resolveFieldValues — flyerSubtitlePreEvent', () => {
  const field: PrintableFieldDef = {
    key: 's',
    label: 'Pre-event subtitle',
    kind: 'text',
    defaultPosition: { x: 0, y: 0 },
    defaultSize: { width: 0, height: 0 },
    draggable: true,
    source: { type: 'computed', name: 'flyerSubtitlePreEvent' },
  };

  it('uses school name in the subtitle', () => {
    expect(resolveFieldValues([field], baseBooking)).toEqual({
      s: { kind: 'text', text: 'Nur noch wenige Tage bis zum Minimusikertag im Lindenschule Halle' },
    });
  });
});

describe('bookingToResolverInput', () => {
  it('projects a BookingWithDetails-shaped object to ResolverBooking', () => {
    const input = {
      schoolName: 'Lindenschule Halle',
      bookingDate: '2026-06-02',
      accessCode: 112,
      isKita: false,
      // Extra fields a real BookingWithDetails would carry — ignored.
      contactName: 'Mustermann',
      contactEmail: 'a@b.de',
    };
    expect(bookingToResolverInput(input)).toEqual({
      schoolName: 'Lindenschule Halle',
      bookingDate: '2026-06-02',
      accessCode: 112,
      isKita: false,
    });
  });

  it('preserves undefined optional fields', () => {
    const input = {
      schoolName: 'X',
      bookingDate: '2026-01-01',
    };
    expect(bookingToResolverInput(input)).toEqual({
      schoolName: 'X',
      bookingDate: '2026-01-01',
      accessCode: undefined,
      isKita: undefined,
    });
  });
});
