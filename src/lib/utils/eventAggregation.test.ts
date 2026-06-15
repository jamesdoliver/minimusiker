import { dedupeClassViews, DedupableClass, compareClassName } from './eventAggregation';

function cls(overrides: Partial<DedupableClass> = {}): DedupableClass {
  return {
    classId: 'cls_x',
    className: 'Klasse 1a',
    classType: 'regular',
    isDefault: false,
    numChildren: 0,
    songs: [],
    ...overrides,
  };
}

describe('dedupeClassViews', () => {
  it('collapses duplicate empty default "Alle Kinder" rows (different class_id) to one', () => {
    // Real case: createDefaultClass ran twice with a drifted class_id.
    const input = [
      cls({ classId: 'cls_a_20260310_allekinder', className: 'Alle Kinder', isDefault: true }),
      cls({ classId: 'cls_a_20260326_allekinder', className: 'Alle Kinder', isDefault: true }),
    ];
    const out = dedupeClassViews(input);
    expect(out).toHaveLength(1);
    expect(out[0].className).toBe('Alle Kinder');
  });

  it('collapses three duplicate defaults to one', () => {
    const input = [
      cls({ classId: 'id1', className: 'Alle Kinder', isDefault: true }),
      cls({ classId: 'id2', className: 'Alle Kinder', isDefault: true }),
      cls({ classId: 'id3', className: 'Alle Kinder', isDefault: true }),
    ];
    expect(dedupeClassViews(input)).toHaveLength(1);
  });

  it('drops the EMPTY duplicate and keeps the one that has songs (Ochsenfurt "4b" same class_id)', () => {
    const input = [
      cls({ classId: 'cls_4b', className: '4b', songs: [] }),
      cls({ classId: 'cls_4b', className: '4b', songs: [{ id: 's1' } as never] }),
    ];
    const out = dedupeClassViews(input);
    expect(out).toHaveLength(1);
    expect(out[0].songs).toHaveLength(1);
  });

  it('collapses same class_id rows even when BOTH appear songful (Ochsenfurt "4b": the song filter assigns identical songs to each copy)', () => {
    const shared = [{ id: 's1' } as never];
    const input = [
      cls({ classId: 'cls_4b_9edd99', className: '4b', songs: shared }),
      cls({ classId: 'cls_4b_9edd99', className: '4b', songs: shared }),
    ];
    expect(dedupeClassViews(input)).toHaveLength(1);
  });

  it('keeps both same-named classes when BOTH carry real songs (no data loss)', () => {
    const input = [
      cls({ classId: 'a', className: '4b', songs: [{ id: 's1' } as never] }),
      cls({ classId: 'b', className: '4b', songs: [{ id: 's2' } as never] }),
    ];
    expect(dedupeClassViews(input)).toHaveLength(2);
  });

  it('does NOT drop a distinct, freshly-added same-named class that has children but no songs yet (createClass suffixes class_id for legit same-name classes)', () => {
    const input = [
      cls({ classId: '2c', className: '2c', songs: [{ id: 's1' } as never], numChildren: 20 }),
      cls({ classId: '2c_a1b2', className: '2c', songs: [], numChildren: 25 }), // distinct, song not assigned yet
    ];
    const out = dedupeClassViews(input);
    expect(out).toHaveLength(2);
    expect(out.reduce((s, c) => s + (c.numChildren || 0), 0)).toBe(45);
  });

  it('still drops a truly-empty (no songs, no children) redundant copy', () => {
    const input = [
      cls({ classId: '2c', className: '2c', songs: [{ id: 's1' } as never], numChildren: 20 }),
      cls({ classId: '2c_a1b2', className: '2c', songs: [], numChildren: 0 }),
    ];
    expect(dedupeClassViews(input)).toHaveLength(1);
  });

  it('merges a system-default "Alle Kinder" with a same-named MANUAL class, keeping the one with songs (Kindergarten St. Michael)', () => {
    const input = [
      cls({ classId: 'def', className: 'Alle Kinder', isDefault: true, songs: [{ id: 's1' } as never] }),
      cls({ classId: 'manual', className: 'Alle Kinder', isDefault: false, songs: [] }),
    ];
    const out = dedupeClassViews(input);
    expect(out).toHaveLength(1);
    expect(out[0].isDefault).toBe(true);
    expect(out[0].songs).toHaveLength(1);
  });

  it('does NOT merge two different blank-named classes (keyed by class_id)', () => {
    const input = [
      cls({ classId: 'blank1', className: '', isDefault: false }),
      cls({ classId: 'blank2', className: '   ', isDefault: false }),
    ];
    expect(dedupeClassViews(input)).toHaveLength(2);
  });

  it('does NOT merge classes that share a name but differ in classType (regular vs choir)', () => {
    const input = [
      cls({ classId: 'reg', className: '1a', classType: 'regular' }),
      cls({ classId: 'cho', className: '1a', classType: 'choir' }),
    ];
    expect(dedupeClassViews(input)).toHaveLength(2);
  });

  it('is case/whitespace-insensitive on the name', () => {
    const input = [
      cls({ classId: 'a', className: 'Alle Kinder', isDefault: true }),
      cls({ classId: 'b', className: '  alle kinder ', isDefault: true }),
    ];
    expect(dedupeClassViews(input)).toHaveLength(1);
  });

  it('preserves first-appearance order of the surviving rows', () => {
    const input = [
      cls({ classId: 'k1a', className: 'Klasse 1a' }),
      cls({ classId: 'd1', className: 'Alle Kinder', isDefault: true }),
      cls({ classId: 'k1b', className: 'Klasse 1b' }),
      cls({ classId: 'd2', className: 'Alle Kinder', isDefault: true }),
    ];
    const out = dedupeClassViews(input);
    expect(out.map((c) => c.className)).toEqual(['Klasse 1a', 'Alle Kinder', 'Klasse 1b']);
  });

  it('returns a single class unchanged', () => {
    const input = [cls({ classId: 'only', className: '2a' })];
    expect(dedupeClassViews(input)).toEqual(input);
  });

  it('when all duplicates are empty, keeps the one with the most children', () => {
    const input = [
      cls({ classId: 'a', className: '3c', numChildren: 0 }),
      cls({ classId: 'b', className: '3c', numChildren: 22 }),
    ];
    const out = dedupeClassViews(input);
    expect(out).toHaveLength(1);
    expect(out[0].numChildren).toBe(22);
  });
});

describe('compareClassName', () => {
  // Regression: event 1776 (Pleisterschule) had 3 classes with an unset
  // class_name (reads back as undefined). The old `a.className.localeCompare(...)`
  // sorts threw "Cannot read properties of undefined (reading 'localeCompare')",
  // 500ing getSchoolEventDetail and making the admin event page unreachable.
  it('does not throw when a className is undefined', () => {
    expect(() => compareClassName({ className: undefined }, { className: 'Klasse 1a' })).not.toThrow();
    expect(() => compareClassName({ className: 'Klasse 1a' }, { className: undefined })).not.toThrow();
    expect(() => compareClassName({ className: undefined }, { className: undefined })).not.toThrow();
  });

  it('sorts a mixed list (incl. undefined names) without throwing; blanks sort first', () => {
    const input = [
      { className: 'Klasse 2a' },
      { className: undefined },
      { className: 'Klasse 1a' },
      { className: undefined },
    ];
    const sorted = [...input].sort(compareClassName);
    expect(sorted.map((c) => c.className)).toEqual([undefined, undefined, 'Klasse 1a', 'Klasse 2a']);
  });

  it('orders normal names alphabetically', () => {
    expect(compareClassName({ className: 'Klasse 1a' }, { className: 'Klasse 2a' })).toBeLessThan(0);
    expect(compareClassName({ className: 'Klasse 2a' }, { className: 'Klasse 1a' })).toBeGreaterThan(0);
    expect(compareClassName({ className: 'Klasse 1a' }, { className: 'Klasse 1a' })).toBe(0);
  });
});
