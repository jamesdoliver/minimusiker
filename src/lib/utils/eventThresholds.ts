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

import { EVENT_MILESTONES, Milestone } from './eventTimeline';

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
  // Per-product visibility: product IDs hidden from the parent portal shop
  hidden_products?: string[];
  // Phase 2 (stored but not wired yet)
  milestones?: Partial<Record<Milestone, number>>;
  clothing_order_day_offset?: number;
  clothing_visibility_window_days?: number;
  task_offsets?: Partial<Record<string, number>>;
}

export type ThresholdKey = keyof Omit<EventTimelineOverrides, 'milestones' | 'task_offsets' | 'audio_hidden' | 'hidden_products'>;

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
 * Get a task template offset override, or return null to use template default.
 */
export function getTaskOffset(taskId: string, overrides?: EventTimelineOverrides | null): number | null {
  const value = overrides?.task_offsets?.[taskId];
  if (typeof value === 'number' && isFinite(value)) return value;
  return null;
}
