import { createWhitelistGuard } from '@/lib/api/validators';

describe('createWhitelistGuard', () => {
  const ALLOWED = ['paid', 'pending', 'refunded'] as const;
  const isAllowed = createWhitelistGuard(ALLOWED);

  it('accepts undefined (treated as "not provided")', () => {
    expect(isAllowed(undefined)).toBe(true);
  });

  it('accepts each allowed value', () => {
    for (const value of ALLOWED) {
      expect(isAllowed(value)).toBe(true);
    }
  });

  it('rejects unknown strings', () => {
    expect(isAllowed('authorized')).toBe(false);
    expect(isAllowed('voided')).toBe(false);
    expect(isAllowed('PAID')).toBe(false);
    expect(isAllowed('')).toBe(false);
    expect(isAllowed('paid"} OR {1}=1 OR {a}="b')).toBe(false);
  });

  it('rejects null', () => {
    expect(isAllowed(null)).toBe(false);
  });

  it('rejects numbers', () => {
    expect(isAllowed(0)).toBe(false);
    expect(isAllowed(1)).toBe(false);
    expect(isAllowed(NaN)).toBe(false);
  });

  it('rejects objects', () => {
    expect(isAllowed({})).toBe(false);
    expect(isAllowed({ paid: true })).toBe(false);
  });

  it('rejects arrays', () => {
    expect(isAllowed([])).toBe(false);
    expect(isAllowed(['paid'])).toBe(false);
  });

  it('rejects booleans', () => {
    expect(isAllowed(true)).toBe(false);
    expect(isAllowed(false)).toBe(false);
  });

  it('narrows the value type via the predicate', () => {
    const value: unknown = 'paid';
    if (isAllowed(value)) {
      // Compile-time assertion: value is now `'paid' | 'pending' | 'refunded' | undefined`.
      // This block must compile; the assignment exercises the narrowed union.
      const narrowed: 'paid' | 'pending' | 'refunded' | undefined = value;
      expect(narrowed === 'paid' || narrowed === undefined).toBe(true);
    } else {
      throw new Error('expected predicate to accept "paid"');
    }
  });

  it('returns independent guards per call', () => {
    const isStatus = createWhitelistGuard(['a', 'b'] as const);
    const isMode = createWhitelistGuard(['x', 'y'] as const);
    expect(isStatus('a')).toBe(true);
    expect(isStatus('x')).toBe(false);
    expect(isMode('x')).toBe(true);
    expect(isMode('a')).toBe(false);
  });
});
