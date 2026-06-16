import { localeCompareSafe } from './localeCompareSafe';

describe('localeCompareSafe', () => {
  it('does not throw when the first value is undefined', () => {
    expect(() => localeCompareSafe(undefined, 'Klasse 3a')).not.toThrow();
  });

  it('does not throw when the second value is undefined', () => {
    expect(() => localeCompareSafe('Klasse 3a', undefined)).not.toThrow();
  });

  it('treats undefined as an empty string, sorting it before a non-empty name', () => {
    expect(localeCompareSafe(undefined, 'Klasse 3a')).toBeLessThan(0);
    expect(localeCompareSafe('Klasse 3a', undefined)).toBeGreaterThan(0);
    expect(localeCompareSafe(undefined, undefined)).toBe(0);
  });

  it('compares two real names the same way String.localeCompare does', () => {
    expect(localeCompareSafe('a', 'b')).toBeLessThan(0);
    expect(localeCompareSafe('b', 'a')).toBeGreaterThan(0);
    expect(localeCompareSafe('a', 'a')).toBe(0);
  });

  // Regression for the admin event-detail 500 (event 1798): classes with an absent
  // class_name (undefined, not '') made Array.sort(a.className.localeCompare(...)) throw.
  it('sorts a list containing absent names without throwing', () => {
    const classes = [
      { className: 'Klasse 3b' },
      { className: undefined as unknown as string },
      { className: 'Klasse 3a' },
    ];
    expect(() =>
      classes.sort((a, b) => localeCompareSafe(a.className, b.className))
    ).not.toThrow();
    expect(classes.map((c) => c.className)).toEqual([
      undefined,
      'Klasse 3a',
      'Klasse 3b',
    ]);
  });
});
