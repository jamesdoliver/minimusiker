/**
 * Shared input validators for API route handlers.
 *
 * Pure module — no Next.js or service imports. Safe to use anywhere on the
 * server (route handlers, services, jobs) and trivial to unit-test.
 */

/**
 * Creates a type-narrowing guard that returns true when the value is undefined
 * (treated as "not provided") or matches one of the allowed literal values.
 *
 * Designed for whitelisting query/body params before they're interpolated into
 * formulas or used in branching logic. The predicate signature lets callers
 * narrow the value type after a successful check, which keeps downstream code
 * type-safe without redundant casts.
 *
 * @example
 * const VALID = ['paid', 'pending'] as const;
 * const isValid = createWhitelistGuard(VALID);
 * if (!isValid(input)) return badRequest();
 * // input is now `'paid' | 'pending' | undefined`
 */
export function createWhitelistGuard<T extends string>(
  allowed: readonly T[],
): (value: unknown) => value is T | undefined {
  return (value: unknown): value is T | undefined => {
    if (value === undefined) return true;
    return typeof value === 'string' && (allowed as readonly string[]).includes(value);
  };
}
