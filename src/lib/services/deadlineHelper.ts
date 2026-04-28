import {
  calculateDeadline as calculateDeadlineV2,
  getTimelineEntry,
} from '@/lib/config/taskTimeline';

/**
 * Compute a new deadline string (YYYY-MM-DD) for a task based on:
 * 1. The canonical timeline offset for `templateId` (preferred — single source of truth), or
 * 2. The stored `timeline_offset` value (fallback for legacy templates not in the v2 timeline).
 *
 * Returns `null` when neither a timeline entry nor a stored offset is available
 * (e.g. manually created tasks without a `timeline_offset`).
 *
 * Uses the v2 UTC-safe deadline calculator to avoid DST/timezone off-by-one bugs.
 */
export function computeNewDeadline(
  eventDate: Date,
  templateId: string | undefined,
  storedOffset: number | null | undefined,
): string | null {
  const entry = templateId ? getTimelineEntry(templateId) : undefined;
  const offset = entry?.offset ?? storedOffset;
  if (offset === null || offset === undefined) return null;
  const deadline = calculateDeadlineV2(eventDate, offset);
  return deadline.toISOString().split('T')[0];
}
