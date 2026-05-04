import { CD_JACKET_FIELDS } from '@/lib/config/printableFieldRegistries/cd-jacket';

describe('CD_JACKET_FIELDS', () => {
  it('declares exactly 3 fields', () => {
    expect(CD_JACKET_FIELDS).toHaveLength(3);
  });

  it.each([
    ['song-list',               'text', { type: 'computed', name: 'songList' }],
    ['event-date-postheadline', 'text', { type: 'computed', name: 'eventDateShort' }],
    ['school-name-display',     'text', { type: 'computed', name: 'schoolName' }],
  ])('field %s has kind %s and source %o', (key, kind, source) => {
    const f = CD_JACKET_FIELDS.find(x => x.key === key);
    expect(f).toBeDefined();
    expect(f?.kind).toBe(kind);
    expect(f?.source).toEqual(source);
  });

  it('all fields are draggable, multiline, with non-zero size', () => {
    for (const f of CD_JACKET_FIELDS) {
      expect(f.draggable).toBe(true);
      expect(f.multiline).toBe(true);
      expect(f.defaultSize.width).toBeGreaterThan(0);
      expect(f.defaultSize.height).toBeGreaterThan(0);
    }
  });
});
