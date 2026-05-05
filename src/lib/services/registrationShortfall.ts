/**
 * Pure tier selection for the registration-shortfall trigger emails.
 * Phase-aware: same gates apply pre-event (T-7) and post-event (T+4).
 * No side effects, no I/O — easy to unit test.
 */

export type RegistrationShortfallPhase = 'pre' | 'post';
export type RegistrationShortfallTier = 'low' | 'critical';

export const REGISTRATION_SHORTFALL_SLUGS = {
  pre: {
    low: 'cron:registration_low_t7',
    critical: 'cron:registration_critical_t7',
  },
  post: {
    low: 'cron:registration_low_post4',
    critical: 'cron:registration_critical_post4',
  },
} as const;

export type RegistrationShortfallSlug =
  | typeof REGISTRATION_SHORTFALL_SLUGS.pre.low
  | typeof REGISTRATION_SHORTFALL_SLUGS.pre.critical
  | typeof REGISTRATION_SHORTFALL_SLUGS.post.low
  | typeof REGISTRATION_SHORTFALL_SLUGS.post.critical;

/**
 * Pick the tier for a given (registered, expected) pair.
 * Same gates apply for pre and post phases:
 *   - ratio < 0.33   → 'critical'
 *   - 0.33 ≤ ratio < 0.50 → 'low'
 *   - otherwise (≥ 50% or expected ≤ 0) → null (no email)
 */
export function selectShortfallTier(
  registeredCount: number,
  expectedCount: number,
): RegistrationShortfallTier | null {
  if (expectedCount <= 0) return null;
  const ratio = registeredCount / expectedCount;
  if (ratio >= 0.5) return null;
  if (ratio < 0.33) return 'critical';
  return 'low';
}

/**
 * Look up the canonical slug for a (tier, phase) combination.
 */
export function getShortfallSlug(
  tier: RegistrationShortfallTier,
  phase: RegistrationShortfallPhase,
): RegistrationShortfallSlug {
  return REGISTRATION_SHORTFALL_SLUGS[phase][tier];
}
