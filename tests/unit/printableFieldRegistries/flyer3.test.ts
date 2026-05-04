import { FLYER3_FIELDS } from '@/lib/config/printableFieldRegistries/flyer3';

describe('FLYER3_FIELDS (single-page post-event)', () => {
  it('declares exactly 5 fields (ab-ins-studio + wohooo are baked in the partial)', () => {
    expect(FLYER3_FIELDS).toHaveLength(5);
  });

  it.each([
    // wow-body and liebe-erwachsene-body resolve via computed sources so they
    // can branch on isKita; the others are static or computed-from-booking.
    ['wow-body',              'text', 'computed'],
    ['liebe-erwachsene-body', 'text', 'computed'],
    ['teacher-signature',     'text', 'static'],
    ['qr-code',               'qr',   'computed'],
    ['qr-caption',            'text', 'computed'],
  ])('field %s has kind %s and source.type %s', (key, kind, sourceType) => {
    const f = FLYER3_FIELDS.find(x => x.key === key);
    expect(f).toBeDefined();
    expect(f?.kind).toBe(kind);
    expect(f?.source.type).toBe(sourceType);
  });

  it('does NOT register ab-ins-studio-body or wohooo-body (baked into partial)', () => {
    expect(FLYER3_FIELDS.find(f => f.key === 'ab-ins-studio-body')).toBeUndefined();
    expect(FLYER3_FIELDS.find(f => f.key === 'wohooo-body')).toBeUndefined();
  });

  it('body fields are multiline', () => {
    const bodyKeys = ['wow-body', 'liebe-erwachsene-body'];
    for (const key of bodyKeys) {
      const f = FLYER3_FIELDS.find(x => x.key === key);
      expect(f?.multiline).toBe(true);
    }
  });

  it('all fields are draggable with non-zero size', () => {
    for (const f of FLYER3_FIELDS) {
      expect(f.draggable).toBe(true);
      expect(f.defaultSize.width).toBeGreaterThan(0);
      expect(f.defaultSize.height).toBeGreaterThan(0);
    }
  });

  it('qr-code has no font properties', () => {
    const qr = FLYER3_FIELDS.find(x => x.key === 'qr-code')!;
    expect(qr.defaultFontSize).toBeUndefined();
    expect(qr.defaultFontFamily).toBeUndefined();
    expect(qr.defaultColor).toBeUndefined();
  });
});
