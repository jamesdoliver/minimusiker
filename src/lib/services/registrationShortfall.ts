/**
 * Pure tier selection for the T-7 registration shortfall trigger.
 * No side effects, no I/O — easy to unit test.
 */

export const REGISTRATION_SHORTFALL_SLUGS = {
  low: 'cron:registration_low_t7',
  critical: 'cron:registration_critical_t7',
} as const;

export type RegistrationShortfallSlug =
  | typeof REGISTRATION_SHORTFALL_SLUGS.low
  | typeof REGISTRATION_SHORTFALL_SLUGS.critical;

/**
 * Pick the tier slug for a given (registered, expected) pair.
 * Returns null when no email should fire (≥50%, or expected ≤ 0).
 */
export function selectShortfallSlug(
  registeredCount: number,
  expectedCount: number,
): RegistrationShortfallSlug | null {
  if (expectedCount <= 0) return null;
  const ratio = registeredCount / expectedCount;
  if (ratio >= 0.5) return null;
  if (ratio < 0.33) return REGISTRATION_SHORTFALL_SLUGS.critical;
  return REGISTRATION_SHORTFALL_SLUGS.low;
}
