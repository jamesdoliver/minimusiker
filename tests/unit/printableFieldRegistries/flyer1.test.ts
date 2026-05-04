import { FLYER1_FIELDS, FLYER1_BACK_FIELDS } from '@/lib/config/printableFieldRegistries/flyer1';

describe('FLYER1_FIELDS (front page)', () => {
  it('declares exactly 1 field', () => {
    expect(FLYER1_FIELDS).toHaveLength(1);
  });

  it('event-date-location is a draggable computed text field', () => {
    const f = FLYER1_FIELDS.find(x => x.key === 'event-date-location');
    expect(f).toBeDefined();
    expect(f?.kind).toBe('text');
    expect(f?.draggable).toBe(true);
    expect(f?.source).toEqual({ type: 'computed', name: 'eventDateLocation' });
  });
});

describe('FLYER1_BACK_FIELDS (back page)', () => {
  it('declares exactly 6 fields', () => {
    expect(FLYER1_BACK_FIELDS).toHaveLength(6);
  });

  it.each([
    ['tshirt-body-paragraph',   'text', { type: 'computed', name: 'tshirtBodyParagraph' }],
    ['tshirt-mockup-label',     'text', { type: 'computed', name: 'schoolName' }],
    ['hoodie-mockup-label',     'text', { type: 'computed', name: 'schoolName' }],
    ['qr-code',                 'qr',   { type: 'computed', name: 'qrUrl' }],
    ['qr-caption',              'text', { type: 'computed', name: 'qrCaption' }],
    ['discount-end-date',       'date', { type: 'computed', name: 'earlyBirdDeadline' }],
  ])('field %s has kind %s and source %o', (key, kind, source) => {
    const f = FLYER1_BACK_FIELDS.find(x => x.key === key);
    expect(f).toBeDefined();
    expect(f?.kind).toBe(kind);
    expect(f?.source).toEqual(source);
  });

  it('all fields are draggable', () => {
    expect(FLYER1_BACK_FIELDS.every(f => f.draggable === true)).toBe(true);
  });

  it('all fields have non-zero default size', () => {
    for (const f of FLYER1_BACK_FIELDS) {
      expect(f.defaultSize.width).toBeGreaterThan(0);
      expect(f.defaultSize.height).toBeGreaterThan(0);
    }
  });

  it('marks tshirt-body-paragraph as multiline', () => {
    const f = FLYER1_BACK_FIELDS.find(x => x.key === 'tshirt-body-paragraph');
    expect(f?.multiline).toBe(true);
  });

  it('other fields are not multiline (default)', () => {
    const others = FLYER1_BACK_FIELDS.filter(x => x.key !== 'tshirt-body-paragraph');
    for (const f of others) {
      expect(f.multiline).not.toBe(true);
    }
  });
});
