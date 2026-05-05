import {
  selectShortfallTier,
  getShortfallSlug,
  REGISTRATION_SHORTFALL_SLUGS,
} from './registrationShortfall';

describe('selectShortfallTier', () => {
  it('returns null at exactly 50%', () => {
    expect(selectShortfallTier(50, 100)).toBeNull();
  });

  it('returns null above 50%', () => {
    expect(selectShortfallTier(60, 100)).toBeNull();
  });

  it('returns "low" at 49.9%', () => {
    expect(selectShortfallTier(499, 1000)).toBe('low');
  });

  it('returns "low" at 33.0%', () => {
    expect(selectShortfallTier(33, 100)).toBe('low');
  });

  it('returns "critical" at 32.9%', () => {
    expect(selectShortfallTier(329, 1000)).toBe('critical');
  });

  it('returns "critical" at 0 registered with positive expected', () => {
    expect(selectShortfallTier(0, 100)).toBe('critical');
  });

  it('returns null when expected is 0 or negative', () => {
    expect(selectShortfallTier(0, 0)).toBeNull();
    expect(selectShortfallTier(5, 0)).toBeNull();
    expect(selectShortfallTier(0, -1)).toBeNull();
  });
});

describe('getShortfallSlug', () => {
  it('maps pre+low to T-7 low slug', () => {
    expect(getShortfallSlug('low', 'pre')).toBe('cron:registration_low_t7');
  });

  it('maps pre+critical to T-7 critical slug', () => {
    expect(getShortfallSlug('critical', 'pre')).toBe('cron:registration_critical_t7');
  });

  it('maps post+low to post4 low slug', () => {
    expect(getShortfallSlug('low', 'post')).toBe('cron:registration_low_post4');
  });

  it('maps post+critical to post4 critical slug', () => {
    expect(getShortfallSlug('critical', 'post')).toBe('cron:registration_critical_post4');
  });

  it('REGISTRATION_SHORTFALL_SLUGS shape exposes all 4 slugs', () => {
    expect(REGISTRATION_SHORTFALL_SLUGS.pre.low).toBe('cron:registration_low_t7');
    expect(REGISTRATION_SHORTFALL_SLUGS.pre.critical).toBe('cron:registration_critical_t7');
    expect(REGISTRATION_SHORTFALL_SLUGS.post.low).toBe('cron:registration_low_post4');
    expect(REGISTRATION_SHORTFALL_SLUGS.post.critical).toBe('cron:registration_critical_post4');
  });
});
