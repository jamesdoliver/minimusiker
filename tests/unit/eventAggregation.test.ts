import { isCatchAllClass, aggregateEventTotals } from '@/lib/utils/eventAggregation';

type C = {
  className: string;
  totalChildren: number;
  registeredParents: number;
  isDefault?: boolean;
  classType?: string;
};

describe('isCatchAllClass', () => {
  it('treats is_default classes as catch-all', () => {
    expect(isCatchAllClass({ className: 'Alle Kinder', totalChildren: 0, registeredParents: 0, isDefault: true })).toBe(true);
  });

  it('does NOT treat user-named classes as catch-all even if named "Alle Kinder"', () => {
    expect(isCatchAllClass({ className: 'Alle Kinder', totalChildren: 160, registeredParents: 3, isDefault: false })).toBe(false);
  });

  it('does NOT treat regular classes as catch-all', () => {
    expect(isCatchAllClass({ className: 'Bauwelt', totalChildren: 19, registeredParents: 1 })).toBe(false);
  });
});

describe('aggregateEventTotals', () => {
  it('sums all classes when only the catch-all exists', () => {
    const classes: C[] = [
      { className: 'Alle Kinder', totalChildren: 160, registeredParents: 3, isDefault: true },
    ];
    expect(aggregateEventTotals(classes)).toEqual({
      totalChildren: 160,
      totalParents: 3,
      overallRegistrationRate: 2, // 3/160 → 1.875 → rounds to 2
    });
  });

  it('excludes the catch-all from totals when real classes exist (the St. Michael bug)', () => {
    // Mirrors the screenshot: auto-default 160 + real per-class breakdown summing to 206.
    const classes: C[] = [
      { className: 'Alle Kinder', totalChildren: 160, registeredParents: 3, isDefault: true },
      { className: 'Bauwelt', totalChildren: 19, registeredParents: 1 },
      { className: 'Entdecker', totalChildren: 21, registeredParents: 2 },
      { className: 'Forscher', totalChildren: 23, registeredParents: 4 },
      { className: 'Krippe', totalChildren: 25, registeredParents: 1 },
    ];
    const result = aggregateEventTotals(classes);
    expect(result.totalChildren).toBe(88); // 19+21+23+25
    expect(result.totalParents).toBe(8);   // 1+2+4+1
  });

  it('returns zero rate when totalChildren is zero', () => {
    expect(aggregateEventTotals([]).overallRegistrationRate).toBe(0);
  });

  it('ignores collection class types (choir / teacher_song) in counts', () => {
    // Choirs & teacher-songs already have numChildren=0; sanity-check we're not counting them.
    const classes: C[] = [
      { className: 'Klasse 1a', totalChildren: 20, registeredParents: 5 },
      { className: 'Schulchor', totalChildren: 0, registeredParents: 0, classType: 'choir' },
    ];
    expect(aggregateEventTotals(classes).totalChildren).toBe(20);
  });
});
