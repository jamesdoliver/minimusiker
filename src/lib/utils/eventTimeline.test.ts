/**
 * Unit tests for eventTimeline.ts
 * Testing the canOrderPersonalizedClothing function
 */

import {
  canOrderPersonalizedClothing,
  PERSONALIZED_CLOTHING_CUTOFF_DAYS,
  getDaysUntilEvent,
} from './eventTimeline';

describe('canOrderPersonalizedClothing', () => {
  // Helper to create a date N days from today
  const daysFromToday = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(0, 0, 0, 0);
    return date.toISOString().split('T')[0];
  };

  // Events in the future - all should return true
  it('returns true for events 10 days away', () => {
    const eventDate = daysFromToday(10);
    expect(canOrderPersonalizedClothing(eventDate)).toBe(true);
  });

  it('returns true for events 25 days away', () => {
    const eventDate = daysFromToday(25);
    expect(canOrderPersonalizedClothing(eventDate)).toBe(true);
  });

  it('returns true for events 1 day away', () => {
    const eventDate = daysFromToday(1);
    expect(canOrderPersonalizedClothing(eventDate)).toBe(true);
  });

  // Event day - should return true
  it('returns true for events on the same day (event day)', () => {
    const eventDate = daysFromToday(0);
    expect(canOrderPersonalizedClothing(eventDate)).toBe(true);
  });

  // Events in the recent past (within 4 days) - should return true
  it('returns true for events 1 day ago', () => {
    const eventDate = daysFromToday(-1);
    expect(canOrderPersonalizedClothing(eventDate)).toBe(true);
  });

  it('returns true for events 2 days ago', () => {
    const eventDate = daysFromToday(-2);
    expect(canOrderPersonalizedClothing(eventDate)).toBe(true);
  });

  it('returns true for events 3 days ago', () => {
    const eventDate = daysFromToday(-3);
    expect(canOrderPersonalizedClothing(eventDate)).toBe(true);
  });

  // Boundary test: exactly 4 days ago - should return true (boundary)
  it('returns true for events exactly 4 days ago (boundary)', () => {
    const eventDate = daysFromToday(-4);
    expect(canOrderPersonalizedClothing(eventDate)).toBe(true);
  });

  // Past the cutoff - should return false
  it('returns false for events 5 days ago', () => {
    const eventDate = daysFromToday(-5);
    expect(canOrderPersonalizedClothing(eventDate)).toBe(false);
  });

  it('returns false for events far in the past (30 days)', () => {
    const eventDate = daysFromToday(-30);
    expect(canOrderPersonalizedClothing(eventDate)).toBe(false);
  });

  // Edge cases
  it('returns false when eventDate is undefined', () => {
    expect(canOrderPersonalizedClothing(undefined)).toBe(false);
  });

  it('returns false when eventDate is empty string', () => {
    // Empty string will result in invalid date
    expect(canOrderPersonalizedClothing('')).toBe(false);
  });

  // Verify the cutoff constant
  it('uses PERSONALIZED_CLOTHING_CUTOFF_DAYS = -4', () => {
    expect(PERSONALIZED_CLOTHING_CUTOFF_DAYS).toBe(-4);

    // At exactly the threshold (-4 days), should return true
    const atThreshold = daysFromToday(PERSONALIZED_CLOTHING_CUTOFF_DAYS);
    expect(canOrderPersonalizedClothing(atThreshold)).toBe(true);

    // One day past threshold (-5 days), should return false
    const pastThreshold = daysFromToday(PERSONALIZED_CLOTHING_CUTOFF_DAYS - 1);
    expect(canOrderPersonalizedClothing(pastThreshold)).toBe(false);
  });

  it('accepts Date objects as input', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 25);
    expect(canOrderPersonalizedClothing(futureDate)).toBe(true);

    const recentPastDate = new Date();
    recentPastDate.setDate(recentPastDate.getDate() - 2);
    expect(canOrderPersonalizedClothing(recentPastDate)).toBe(true);

    const farPastDate = new Date();
    farPastDate.setDate(farPastDate.getDate() - 10);
    expect(canOrderPersonalizedClothing(farPastDate)).toBe(false);
  });
});

describe('getDaysUntilEvent', () => {
  const daysFromToday = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(0, 0, 0, 0);
    return date.toISOString().split('T')[0];
  };

  it('returns positive number for future events', () => {
    const eventDate = daysFromToday(10);
    expect(getDaysUntilEvent(eventDate)).toBe(10);
  });

  it('returns 0 for today', () => {
    const eventDate = daysFromToday(0);
    expect(getDaysUntilEvent(eventDate)).toBe(0);
  });

  it('returns negative number for past events', () => {
    const eventDate = daysFromToday(-5);
    expect(getDaysUntilEvent(eventDate)).toBe(-5);
  });
});
