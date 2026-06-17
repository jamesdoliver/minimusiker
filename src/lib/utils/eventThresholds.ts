/**
 * Event Timeline Threshold Resolver
 *
 * Provides per-event overrides for timing thresholds with fallback to global defaults.
 * Overrides are stored as a JSON blob in the Events table `timeline_overrides` field.
 *
 * Usage:
 *   const overrides = parseOverrides(event.timeline_overrides);
 *   const earlyBirdDays = getThreshold('early_bird_deadline_days', overrides);
 */

import { EVENT_MILESTONES, Milestone, canOrderPersonalizedClothing } from './eventTimeline';

// Phase 1 thresholds (editable in settings)
export interface EventTimelineOverrides {
  early_bird_deadline_days?: number;
  personalized_clothing_cutoff_days?: number;
  schulsong_clothing_cutoff_days?: number;
  merchandise_deadline_days?: number;
  preview_available_days?: number;
  full_release_days?: number;
  // Audio visibility kill-switch (admin can hide all audio from parent portal)
  audio_hidden?: boolean;
  // Communications pause: when true, all automated timeline emails are suppressed for this event
  communications_paused?: boolean;
  // Per-product visibility: product IDs hidden from the parent portal shop
  hidden_products?: string[];
  // Phase 2 (stored but not wired yet)
  milestones?: Partial<Record<Milestone, number>>;
  clothing_order_day_offset?: number;
  clothing_visibility_window_days?: number;
  task_offsets?: Partial<Record<string, number>>;
}

export type ThresholdKey = keyof Omit<EventTimelineOverrides, 'milestones' | 'task_offsets' | 'audio_hidden' | 'communications_paused' | 'hidden_products'>;

export const GLOBAL_DEFAULTS: Record<ThresholdKey, number> = {
  early_bird_deadline_days: 19,
  personalized_clothing_cutoff_days: -4,
  schulsong_clothing_cutoff_days: -14,
  merchandise_deadline_days: 14,
  preview_available_days: 7,
  full_release_days: 14,
  clothing_order_day_offset: 18,
  clothing_visibility_window_days: 21,
};

/**
 * Safely parse a JSON timeline_overrides blob.
 * Returns null on invalid/empty input (consumers fall back to global defaults).
 */
export function parseOverrides(json: string | undefined | null): EventTimelineOverrides | null {
  if (!json || !json.trim()) return null;
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed as EventTimelineOverrides;
  } catch {
    return null;
  }
}

/**
 * Validate the per-key values of a parsed timeline_overrides object.
 *
 * Returns an error message for the first invalid key, or null if every value is valid.
 * Kept beside EventTimelineOverrides so a new key is validated the moment it is added —
 * the omission that let a boolean key fall through to the numeric guard.
 *
 * Rules (mirror EventTimelineOverrides):
 *  - milestones / task_offsets: nested Phase 2 objects, not validated here
 *  - audio_hidden / communications_paused: boolean kill-switches
 *  - hidden_products: array of product-id strings
 *  - everything else: a finite numeric day threshold/offset in [-365, 365]
 */
export function validateTimelineOverrideValues(parsed: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'milestones' || key === 'task_offsets') continue;
    if (key === 'audio_hidden' || key === 'communications_paused') {
      if (typeof value !== 'boolean') {
        return `Invalid value for ${key}: must be a boolean`;
      }
      continue;
    }
    if (key === 'hidden_products') {
      if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
        return `Invalid value for ${key}: must be an array of strings`;
      }
      continue;
    }
    if (typeof value !== 'number' || !isFinite(value) || Math.abs(value) > 365) {
      return `Invalid value for ${key}: must be a finite number between -365 and 365`;
    }
  }
  return null;
}

/**
 * Get a threshold value, preferring the per-event override, falling back to global default.
 */
export function getThreshold(key: ThresholdKey, overrides?: EventTimelineOverrides | null): number {
  const value = overrides?.[key];
  if (typeof value === 'number' && isFinite(value)) return value;
  return GLOBAL_DEFAULTS[key];
}

/**
 * Get a milestone offset, preferring per-event override, falling back to EVENT_MILESTONES.
 */
export function getMilestoneOffset(milestone: Milestone, overrides?: EventTimelineOverrides | null): number {
  const value = overrides?.milestones?.[milestone];
  if (typeof value === 'number' && isFinite(value)) return value;
  return EVENT_MILESTONES[milestone];
}

/**
 * Default hidden products based on launch date.
 * Before April 1 2026: Kinderliederbox (bluetooth-box) hidden — not yet launched.
 * From April 1 2026: all products visible by default.
 * Admins can override per-event via timeline_overrides hidden_products.
 */
const KINDERLIEDERBOX_LAUNCH = new Date('2026-04-01T00:00:00');

export function getDefaultHiddenProducts(now: Date = new Date()): string[] {
  return now < KINDERLIEDERBOX_LAUNCH ? ['bluetooth-box'] : [];
}

/**
 * Resolve which products are hidden for an event.
 * If the admin has explicitly set hidden_products (even []), use that.
 * Otherwise fall back to defaults (empty).
 */
export function getEffectiveHiddenProducts(overrides?: EventTimelineOverrides | null): string[] {
  if (overrides && 'hidden_products' in overrides) {
    return overrides.hidden_products || [];
  }
  return getDefaultHiddenProducts();
}

/**
 * Get a task template offset override, or return null to use template default.
 */
export function getTaskOffset(taskId: string, overrides?: EventTimelineOverrides | null): number | null {
  const value = overrides?.task_offsets?.[taskId];
  if (typeof value === 'number' && isFinite(value)) return value;
  return null;
}

// ---------------------------------------------------------------------------
// Personalized ("Schul") clothing order window
// ---------------------------------------------------------------------------

/**
 * Inputs for the personalized-clothing window. Available identically on the client
 * (from /api/parent/schulsong-status) and the server (from the Event record).
 */
export interface PersonalizedClothingWindowArgs {
  eventDate?: string | null;
  overrides?: EventTimelineOverrides | null;
  /** Schulsong-only event (no audio tier) — uses the extended clothing window. */
  isSchulsongOnly?: boolean;
  /** Under-100 / force-standard event — personalized is never offered. */
  isStandardMerchOnly?: boolean;
  /** Absolute schulsong merch cutoff (DateTime), when set. */
  schulsongMerchCutoff?: string | null;
}

/**
 * Whether PERSONALIZED ("Schul") clothing may still be ordered for an event.
 *
 * Personalized clothing is batch-produced per school, so it closes at a cutoff;
 * STANDARD clothing is rolling stock and is NOT governed by this (stays orderable).
 *
 * This mirrors the shop's existing `showPersonalized` computation
 * (src/app/familie/shop/page.tsx) exactly, so the server checkout enforcement and the
 * shop UI's personalized→standard switch never drift:
 *   1. standard-merch-only (under-100 / force-standard) → never personalized
 *   2. absolute schulsong_merch_cutoff → open while now < cutoff
 *   3. relative cutoff: schulsong_clothing_cutoff_days (schulsong-only) else
 *      personalized_clothing_cutoff_days, via canOrderPersonalizedClothing
 */
export function canOrderPersonalizedClothingForEvent(
  args: PersonalizedClothingWindowArgs,
  now: Date = new Date(),
): boolean {
  const { eventDate, overrides, isSchulsongOnly, isStandardMerchOnly, schulsongMerchCutoff } = args;

  if (isStandardMerchOnly) return false;

  if (schulsongMerchCutoff) {
    const cutoff = new Date(schulsongMerchCutoff);
    if (isFinite(cutoff.getTime())) return now.getTime() < cutoff.getTime();
  }

  const cutoffDays = isSchulsongOnly
    ? getThreshold('schulsong_clothing_cutoff_days', overrides)
    : getThreshold('personalized_clothing_cutoff_days', overrides);

  return canOrderPersonalizedClothing(eventDate ?? undefined, cutoffDays);
}
