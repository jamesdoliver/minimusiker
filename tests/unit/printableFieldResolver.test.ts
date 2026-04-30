import { resolveFieldValues, type ResolverBooking } from '@/lib/config/printableFieldResolver';
import type { PrintableFieldDef } from '@/lib/config/printableFields';

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
