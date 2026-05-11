import { withRetry } from '@/lib/utils/withRetry';

describe('withRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns immediately on first-try success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const promise = withRetry(fn);
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 and eventually succeeds', async () => {
    const error429 = Object.assign(new Error('rate limited'), { statusCode: 429 });
    const fn = jest.fn()
      .mockRejectedValueOnce(error429)
      .mockRejectedValueOnce(error429)
      .mockResolvedValueOnce('ok');
    const promise = withRetry(fn, { baseDelayMs: 100 });
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after maxAttempts', async () => {
    const error429 = Object.assign(new Error('rate limited'), { statusCode: 429 });
    const fn = jest.fn().mockRejectedValue(error429);
    const promise = withRetry(fn, { maxAttempts: 2, baseDelayMs: 100 });
    // Attach the rejection assertion BEFORE advancing timers so the rejected
    // promise has a handler attached, avoiding an unhandled-rejection warning.
    const assertion = expect(promise).rejects.toBe(error429);
    await jest.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry non-429 errors', async () => {
    const error500 = Object.assign(new Error('server'), { statusCode: 500 });
    const fn = jest.fn().mockRejectedValue(error500);
    const promise = withRetry(fn);
    const assertion = expect(promise).rejects.toBe(error500);
    await jest.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects a custom shouldRetry predicate', async () => {
    const error503 = Object.assign(new Error('unavailable'), { statusCode: 503 });
    const fn = jest.fn()
      .mockRejectedValueOnce(error503)
      .mockResolvedValueOnce('ok');
    const promise = withRetry(fn, {
      shouldRetry: (e) => (e as { statusCode?: number }).statusCode === 503,
      baseDelayMs: 50,
    });
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
