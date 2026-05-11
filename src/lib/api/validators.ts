/**
 * API-layer validation helpers — guards designed to validate untrusted query
 * or body params before they're interpolated into formulas, used in branching
 * logic, or persisted.
 *
 * Distinct from:
 * - `@/lib/utils/validators` — pure ID/string format validators (e.g. event ID,
 *   class ID) that don't model an API boundary.
 * - `@/lib/validators/*` — domain-specific multi-field validation (e.g.
 *   registration form rules).
 *
 * Add new helpers here when they handle untrusted input at an API boundary.
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
