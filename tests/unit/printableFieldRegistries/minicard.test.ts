import { MINICARD_FIELDS, MINICARD_BACK_FIELDS } from '@/lib/config/printableFieldRegistries/minicard';

describe('MINICARD_FIELDS (front)', () => {
  it('declares exactly 1 field', () => {
    expect(MINICARD_FIELDS).toHaveLength(1);
  });

  it('song-list field uses songList computed source and is multiline', () => {
    const f = MINICARD_FIELDS.find(x => x.key === 'song-list')!;
    expect(f.kind).toBe('text');
    expect(f.multiline).toBe(true);
    expect(f.source).toEqual({ type: 'computed', name: 'songList' });
  });
});

describe('MINICARD_BACK_FIELDS (back)', () => {
  it('declares exactly 2 fields', () => {
    expect(MINICARD_BACK_FIELDS).toHaveLength(2);
  });

  it.each([
    ['qr-code',    'qr',   { type: 'computed', name: 'qrUrl' }],
    ['qr-caption', 'text', { type: 'computed', name: 'qrCaption' }],
  ])('field %s has kind %s and source %o', (key, kind, source) => {
    const f = MINICARD_BACK_FIELDS.find(x => x.key === key);
    expect(f).toBeDefined();
    expect(f?.kind).toBe(kind);
    expect(f?.source).toEqual(source);
  });

  it('all back fields draggable with non-zero size', () => {
    for (const f of MINICARD_BACK_FIELDS) {
      expect(f.draggable).toBe(true);
      expect(f.defaultSize.width).toBeGreaterThan(0);
      expect(f.defaultSize.height).toBeGreaterThan(0);
    }
  });
});
