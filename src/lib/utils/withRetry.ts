/**
 * Retry a function on rate-limit errors with exponential backoff + jitter.
 *
 * Default behaviour: retry on HTTP 429 up to 4 times with delays of roughly
 * 200ms, 400ms, 800ms (plus up to 100ms of random jitter to avoid thundering
 * herds when several callers hit the limit at once).
 *
 * The helper is intentionally generic — it takes any function returning a
 * Promise and a configurable predicate to decide whether an error is
 * retryable. The default predicate matches Airtable's rate-limit response
 * (HTTP 429), which is the immediate motivation for this utility.
 *
 * @example
 * const records = await withRetry(() => airtableTable.select({ ... }).all());
 *
 * @example
 * // Retry on 503 instead of 429
 * await withRetry(fn, {
 *   shouldRetry: (e) => (e as { statusCode?: number }).statusCode === 503,
 * });
 */
export interface WithRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  /** Predicate returning true if the error is retryable. Default: HTTP 429. */
  shouldRetry?: (err: unknown) => boolean;
}

const isRateLimitError = (err: unknown): boolean => {
  const status =
    (err as { statusCode?: number; status?: number })?.statusCode ??
    (err as { status?: number })?.status;
  return status === 429;
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: WithRetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 4,
    baseDelayMs = 200,
    shouldRetry = isRateLimitError,
  } = opts;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!shouldRetry(err) || attempt === maxAttempts) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 100;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  // Unreachable — TS satisfaction
  throw new Error('withRetry: exhausted attempts without throw');
}
