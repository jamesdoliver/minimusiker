import {
  shouldFire,
  REGISTRATION_SHORTFALL_TRIGGERS,
  REGISTRATION_SHORTFALL_TRIGGER_KEYS,
} from './registrationShortfall';

describe('REGISTRATION_SHORTFALL_TRIGGERS shape', () => {
  it('exposes 3 triggers with the expected slugs', () => {
    expect(REGISTRATION_SHORTFALL_TRIGGERS.t_minus_14.slug).toBe('cron:registration_t_minus_14');
    expect(REGISTRATION_SHORTFALL_TRIGGERS.t_minus_4.slug).toBe('cron:registration_t_minus_4');
    expect(REGISTRATION_SHORTFALL_TRIGGERS.t_plus_3.slug).toBe('cron:registration_t_plus_3');
  });

  it('day offsets are signed correctly (positive = future, negative = past)', () => {
    expect(REGISTRATION_SHORTFALL_TRIGGERS.t_minus_14.daysOffset).toBe(14);
    expect(REGISTRATION_SHORTFALL_TRIGGERS.t_minus_4.daysOffset).toBe(4);
    expect(REGISTRATION_SHORTFALL_TRIGGERS.t_plus_3.daysOffset).toBe(-3);
  });

  it('thresholds match the design (33% pre, 50% post)', () => {
    expect(REGISTRATION_SHORTFALL_TRIGGERS.t_minus_14.threshold).toBe(0.33);
    expect(REGISTRATION_SHORTFALL_TRIGGERS.t_minus_4.threshold).toBe(0.33);
    expect(REGISTRATION_SHORTFALL_TRIGGERS.t_plus_3.threshold).toBe(0.50);
  });

  it('REGISTRATION_SHORTFALL_TRIGGER_KEYS includes all 3 keys in chronological order', () => {
    expect(REGISTRATION_SHORTFALL_TRIGGER_KEYS).toEqual(['t_minus_14', 't_minus_4', 't_plus_3']);
  });
});

describe('shouldFire', () => {
  // T-14 / T-4 share the 33% gate
  it('t_minus_14: returns true at 32%', () => {
    expect(shouldFire(32, 100, 't_minus_14')).toBe(true);
  });

  it('t_minus_14: returns false at 33%', () => {
    expect(shouldFire(33, 100, 't_minus_14')).toBe(false);
  });

  it('t_minus_14: returns false at 50%', () => {
    expect(shouldFire(50, 100, 't_minus_14')).toBe(false);
  });

  it('t_minus_4: returns true at 32%', () => {
    expect(shouldFire(32, 100, 't_minus_4')).toBe(true);
  });

  it('t_minus_4: returns false at 33%', () => {
    expect(shouldFire(33, 100, 't_minus_4')).toBe(false);
  });

  // T+3 has the 50% gate
  it('t_plus_3: returns true at 49%', () => {
    expect(shouldFire(49, 100, 't_plus_3')).toBe(true);
  });

  it('t_plus_3: returns false at 50%', () => {
    expect(shouldFire(50, 100, 't_plus_3')).toBe(false);
  });

  it('t_plus_3: returns true at 0% (zero registered)', () => {
    expect(shouldFire(0, 100, 't_plus_3')).toBe(true);
  });

  it('returns false when expected is 0 or negative (regardless of trigger)', () => {
    expect(shouldFire(0, 0, 't_minus_14')).toBe(false);
    expect(shouldFire(50, 0, 't_minus_4')).toBe(false);
    expect(shouldFire(0, -1, 't_plus_3')).toBe(false);
  });
});
