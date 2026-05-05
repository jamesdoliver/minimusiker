/**
 * Configuration for the registration-shortfall trigger emails.
 *
 * Three independent triggers, each with its own date offset and ratio gate.
 * Same event can receive multiple emails over its lifecycle:
 *   - T-14: gentle reminder when <33% registered 14 days before the event
 *   - T-4:  urgent alarm when <33% registered 4 days before (independent check)
 *   - T+3:  post-event reflection when <50% registered 3 days after
 *
 * Each trigger fires at most once per event over its lifetime via the cron's
 * exact-date filter — same idempotency model as `checkStaffEventReminder`.
 */

export const REGISTRATION_SHORTFALL_TRIGGERS = {
  t_minus_14: {
    slug: 'cron:registration_t_minus_14',
    daysOffset: 14,    // event_date = today + 14
    threshold: 0.33,   // fire when ratio < 33%
  },
  t_minus_4: {
    slug: 'cron:registration_t_minus_4',
    daysOffset: 4,     // event_date = today + 4
    threshold: 0.33,   // fire when ratio < 33%
  },
  t_plus_3: {
    slug: 'cron:registration_t_plus_3',
    daysOffset: -3,    // event_date = today - 3 (event was 3 days ago)
    threshold: 0.50,   // fire when ratio < 50%
  },
} as const;

export type RegistrationShortfallTriggerKey = keyof typeof REGISTRATION_SHORTFALL_TRIGGERS;

export type RegistrationShortfallSlug =
  | typeof REGISTRATION_SHORTFALL_TRIGGERS.t_minus_14.slug
  | typeof REGISTRATION_SHORTFALL_TRIGGERS.t_minus_4.slug
  | typeof REGISTRATION_SHORTFALL_TRIGGERS.t_plus_3.slug;

export const REGISTRATION_SHORTFALL_TRIGGER_KEYS: ReadonlyArray<RegistrationShortfallTriggerKey> = [
  't_minus_14',
  't_minus_4',
  't_plus_3',
];

/**
 * Returns true if the registered/expected ratio falls below the trigger's threshold.
 * Returns false when expected ≤ 0 (no comparison possible) — caller must skip.
 */
export function shouldFire(
  registeredCount: number,
  expectedCount: number,
  triggerKey: RegistrationShortfallTriggerKey,
): boolean {
  if (expectedCount <= 0) return false;
  const ratio = registeredCount / expectedCount;
  return ratio < REGISTRATION_SHORTFALL_TRIGGERS[triggerKey].threshold;
}
