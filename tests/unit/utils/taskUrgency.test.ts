import { calculateUrgencyScore } from '@/lib/utils/taskUrgency';

describe('calculateUrgencyScore', () => {
  beforeEach(() => {
    // Pin "today" for reproducibility — UTC midnight 2026-04-28
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-28T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns positive urgencyScore for future deadline', () => {
    const r = calculateUrgencyScore(new Date('2026-05-01T00:00:00Z'));
    expect(r.daysUntilDue).toBe(3);
    expect(r.isOverdue).toBe(false);
    expect(r.urgencyScore).toBe(3);
  });

  it('returns negative urgencyScore for overdue deadline', () => {
    const r = calculateUrgencyScore(new Date('2026-04-25T00:00:00Z'));
    expect(r.daysUntilDue).toBe(-3);
    expect(r.isOverdue).toBe(true);
    expect(r.urgencyScore).toBe(-1003);
  });

  it('treats today as not overdue', () => {
    const r = calculateUrgencyScore(new Date('2026-04-28T00:00:00Z'));
    expect(r.daysUntilDue).toBe(0);
    expect(r.isOverdue).toBe(false);
    expect(r.urgencyScore).toBe(0);
  });
});
