import { calculateDeadline } from '@/lib/config/taskTimeline';

describe('calculateDeadline', () => {
  // Use ISO date strings that should produce predictable dates regardless of host TZ
  it('handles a string event date with negative offset (UTC-safe)', () => {
    const result = calculateDeadline('2025-06-15', -18);
    expect(result.toISOString().split('T')[0]).toBe('2025-05-28');
  });

  it('handles a string event date with positive offset', () => {
    const result = calculateDeadline('2025-06-15', 5);
    expect(result.toISOString().split('T')[0]).toBe('2025-06-20');
  });

  it('handles a Date object', () => {
    const result = calculateDeadline(new Date('2025-06-15T00:00:00Z'), -45);
    expect(result.toISOString().split('T')[0]).toBe('2025-05-01');
  });

  it('crosses month boundary correctly', () => {
    const result = calculateDeadline('2025-03-05', -10);
    expect(result.toISOString().split('T')[0]).toBe('2025-02-23');
  });

  it('crosses year boundary correctly', () => {
    const result = calculateDeadline('2025-01-05', -10);
    expect(result.toISOString().split('T')[0]).toBe('2024-12-26');
  });

  it('returns midnight UTC, not local midnight', () => {
    const result = calculateDeadline('2025-06-15', 0);
    expect(result.toISOString()).toBe('2025-06-15T00:00:00.000Z');
  });
});
