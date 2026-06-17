/**
 * Unit tests for canOrderPersonalizedClothingForEvent — the single source of truth
 * for whether PERSONALIZED ("Schul") clothing may still be ordered for an event.
 *
 * Policy (decided June 2026): personalized/school clothing is batch-produced and
 * closes at its cutoff; STANDARD clothing is rolling stock and stays available
 * indefinitely. This helper mirrors the shop's existing showPersonalized logic so the
 * server checkout enforcement and the shop UI never drift.
 */

import { canOrderPersonalizedClothingForEvent } from './eventThresholds';

// YYYY-MM-DD N days from today (local), matching eventTimeline.test.ts convention.
const dayOffset = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
};

describe('canOrderPersonalizedClothingForEvent', () => {
  it('is true for an upcoming event (personalized window open)', () => {
    expect(canOrderPersonalizedClothingForEvent({ eventDate: dayOffset(20) })).toBe(true);
  });

  it('is false well after the personalized cutoff (event+4 default)', () => {
    expect(canOrderPersonalizedClothingForEvent({ eventDate: dayOffset(-30) })).toBe(false);
  });

  it('is always false when standard-merch-only (under-100 / force-standard)', () => {
    expect(canOrderPersonalizedClothingForEvent({ eventDate: dayOffset(20), isStandardMerchOnly: true })).toBe(false);
  });

  it('uses the extended schulsong-only window (event+14) vs the regular +4', () => {
    // 10 days after the event: closed for a regular event (+4) but still open for schulsong-only (+14)
    expect(canOrderPersonalizedClothingForEvent({ eventDate: dayOffset(-10) })).toBe(false);
    expect(canOrderPersonalizedClothingForEvent({ eventDate: dayOffset(-10), isSchulsongOnly: true })).toBe(true);
  });

  it('honours a personalized_clothing_cutoff_days override', () => {
    // override extends the window to +30 → an event 20 days ago is still open
    expect(canOrderPersonalizedClothingForEvent({ eventDate: dayOffset(-20), overrides: { personalized_clothing_cutoff_days: -30 } })).toBe(true);
  });

  it('respects an absolute schulsong_merch_cutoff (open before, closed after)', () => {
    const args = { eventDate: dayOffset(-30), schulsongMerchCutoff: '2026-05-08T05:00:00.000Z' };
    expect(canOrderPersonalizedClothingForEvent(args, new Date('2026-05-07T00:00:00.000Z'))).toBe(true);
    expect(canOrderPersonalizedClothingForEvent(args, new Date('2026-05-08T06:00:00.000Z'))).toBe(false);
  });

  it('lets standard-merch-only override even an otherwise-open schulsong cutoff', () => {
    expect(canOrderPersonalizedClothingForEvent({
      eventDate: dayOffset(-30),
      isStandardMerchOnly: true,
      schulsongMerchCutoff: '2099-01-01T00:00:00.000Z',
    })).toBe(false);
  });

  it('is false when there is no event date and no cutoff (default to standard)', () => {
    expect(canOrderPersonalizedClothingForEvent({})).toBe(false);
  });
});
