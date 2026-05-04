import { selectShortfallSlug, REGISTRATION_SHORTFALL_SLUGS } from './registrationShortfall';

describe('selectShortfallSlug', () => {
  it('returns null at exactly 50%', () => {
    expect(selectShortfallSlug(50, 100)).toBeNull();
  });

  it('returns null above 50%', () => {
    expect(selectShortfallSlug(60, 100)).toBeNull();
  });

  it('returns "low" slug at 49.9%', () => {
    expect(selectShortfallSlug(499, 1000)).toBe(REGISTRATION_SHORTFALL_SLUGS.low);
  });

  it('returns "low" slug at 33.0%', () => {
    expect(selectShortfallSlug(33, 100)).toBe(REGISTRATION_SHORTFALL_SLUGS.low);
  });

  it('returns "critical" slug at 32.9%', () => {
    expect(selectShortfallSlug(329, 1000)).toBe(REGISTRATION_SHORTFALL_SLUGS.critical);
  });

  it('returns "critical" slug at 0 registered with positive expected', () => {
    expect(selectShortfallSlug(0, 100)).toBe(REGISTRATION_SHORTFALL_SLUGS.critical);
  });

  it('returns null when expected is 0 (skip — no comparison possible)', () => {
    expect(selectShortfallSlug(0, 0)).toBeNull();
    expect(selectShortfallSlug(5, 0)).toBeNull();
  });

  it('returns null when expected is negative or undefined-as-0', () => {
    expect(selectShortfallSlug(0, -1)).toBeNull();
  });
});
