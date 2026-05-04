import { FLYER2_FIELDS, FLYER2_BACK_FIELDS } from '@/lib/config/printableFieldRegistries/flyer2';

describe('FLYER2_FIELDS (front page)', () => {
  it('declares exactly 2 fields', () => {
    expect(FLYER2_FIELDS).toHaveLength(2);
  });

  it.each([
    ['event-date-headline', 'text', { type: 'computed', name: 'eventDateHeadline' }],
    ['pre-event-subtitle', 'text', { type: 'computed', name: 'flyerSubtitlePreEvent' }],
  ])('field %s has kind %s and source %o', (key, kind, source) => {
    const f = FLYER2_FIELDS.find(x => x.key === key);
    expect(f).toBeDefined();
    expect(f?.kind).toBe(kind);
    expect(f?.source).toEqual(source);
  });
});

describe('FLYER2_BACK_FIELDS (back page)', () => {
  it('declares exactly 4 fields', () => {
    expect(FLYER2_BACK_FIELDS).toHaveLength(4);
  });

  it.each([
    ['hoodie-mockup-label', 'text', { type: 'computed', name: 'schoolName' }],
    ['tshirt-mockup-label', 'text', { type: 'computed', name: 'schoolName' }],
    ['qr-code',             'qr',   { type: 'computed', name: 'qrUrl' }],
    ['qr-caption',          'text', { type: 'computed', name: 'qrCaption' }],
  ])('field %s has kind %s and source %o', (key, kind, source) => {
    const f = FLYER2_BACK_FIELDS.find(x => x.key === key);
    expect(f).toBeDefined();
    expect(f?.kind).toBe(kind);
    expect(f?.source).toEqual(source);
  });

  it('all fields are draggable with non-zero size', () => {
    for (const f of FLYER2_BACK_FIELDS) {
      expect(f.draggable).toBe(true);
      expect(f.defaultSize.width).toBeGreaterThan(0);
      expect(f.defaultSize.height).toBeGreaterThan(0);
    }
  });
});
