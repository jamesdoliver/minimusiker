import { computeNewDeadline } from '@/lib/services/deadlineHelper';

describe('computeNewDeadline', () => {
  it('uses the timeline entry offset for known templates', () => {
    // ship_poster has offset -45 in TASK_TIMELINE.
    // The stored offset (999) should be IGNORED in favor of the canonical timeline value.
    expect(computeNewDeadline(new Date('2025-06-15T00:00:00Z'), 'ship_poster', 999)).toBe(
      '2025-05-01',
    );
  });

  it('falls back to stored offset for unknown (legacy) templates', () => {
    expect(computeNewDeadline(new Date('2025-06-15T00:00:00Z'), 'legacy_template', -10)).toBe(
      '2025-06-05',
    );
  });

  it('returns null when both lookup fails and stored offset is null', () => {
    expect(computeNewDeadline(new Date('2025-06-15T00:00:00Z'), 'legacy_template', null)).toBeNull();
  });

  it('returns null when both lookup fails and stored offset is undefined', () => {
    expect(
      computeNewDeadline(new Date('2025-06-15T00:00:00Z'), 'legacy_template', undefined),
    ).toBeNull();
  });

  it('returns null when templateId is undefined and stored offset is null', () => {
    expect(computeNewDeadline(new Date('2025-06-15T00:00:00Z'), undefined, null)).toBeNull();
  });

  it('crosses month boundary correctly via timeline lookup', () => {
    // ship_poster offset -45 from 2025-03-05 = 2025-01-19
    expect(computeNewDeadline(new Date('2025-03-05T00:00:00Z'), 'ship_poster', null)).toBe(
      '2025-01-19',
    );
  });

  it('crosses year boundary correctly via stored offset fallback', () => {
    // -10 from 2025-01-05 = 2024-12-26
    expect(computeNewDeadline(new Date('2025-01-05T00:00:00Z'), 'legacy_template', -10)).toBe(
      '2024-12-26',
    );
  });

  it('produces UTC-safe deadlines (no DST off-by-one)', () => {
    // Around DST boundary (Europe falls back end of October 2025).
    // ship_flyer_3 offset is -10 in the timeline.
    // -10 from 2025-11-01 = 2025-10-22 (must be exact regardless of host TZ).
    expect(computeNewDeadline(new Date('2025-11-01T00:00:00Z'), 'ship_flyer_3', null)).toBe(
      '2025-10-22',
    );
  });
});
