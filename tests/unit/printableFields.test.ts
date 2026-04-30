import type {
  PrintableFieldDef,
  PrintableFieldKind,
  PrintableFieldSource,
  ResolvedFieldValue,
} from '@/lib/config/printableFields';

describe('printableFields types', () => {
  it('PrintableFieldDef compiles with all field kinds', () => {
    const text: PrintableFieldDef = {
      key: 'event-headline',
      label: 'Event headline',
      kind: 'text',
      defaultPosition: { x: 50, y: 100 },
      defaultSize: { width: 250, height: 50 },
      defaultFontSize: 18,
      defaultFontFamily: 'fredoka',
      defaultColor: '#000000',
      draggable: true,
      source: { type: 'computed', name: 'eventDateLocation' },
    };
    const qr: PrintableFieldDef = {
      key: 'qr',
      label: 'QR code',
      kind: 'qr',
      defaultPosition: { x: 200, y: 100 },
      defaultSize: { width: 100, height: 100 },
      draggable: true,
      source: { type: 'computed', name: 'qrUrl' },
    };
    const dateField: PrintableFieldDef = {
      key: 'discount-end',
      label: 'Discount end date',
      kind: 'date',
      defaultPosition: { x: 480, y: 240 },
      defaultSize: { width: 90, height: 20 },
      defaultFontSize: 14,
      defaultFontFamily: 'fredoka',
      defaultColor: '#000000',
      draggable: true,
      source: { type: 'computed', name: 'earlyBirdDeadline' },
    };

    expect([text.kind, qr.kind, dateField.kind]).toEqual(['text', 'qr', 'date']);
  });

  it('ResolvedFieldValue carries text/url/date depending on kind', () => {
    const t: ResolvedFieldValue = { kind: 'text', text: 'hello' };
    const q: ResolvedFieldValue = { kind: 'qr', url: 'https://x' };
    const d: ResolvedFieldValue = { kind: 'date', text: '15.05.2026' };
    expect([t.kind, q.kind, d.kind]).toEqual(['text', 'qr', 'date']);
  });

  it('PrintableFieldKind is the discriminator union', () => {
    const k: PrintableFieldKind = 'text';
    expect(['text', 'qr', 'date']).toContain(k);
  });

  it('PrintableFieldSource supports static and computed', () => {
    const a: PrintableFieldSource = { type: 'static', value: 'literal' };
    const b: PrintableFieldSource = { type: 'computed', name: 'schoolName' };
    expect([a.type, b.type]).toEqual(['static', 'computed']);
  });
});
