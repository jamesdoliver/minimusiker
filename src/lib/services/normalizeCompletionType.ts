import {
  getTimelineEntry,
  type TaskCompletionType,
} from '@/lib/config/taskTimeline';

/**
 * Normalize a stored Airtable `completion_type` value into the canonical v2 union.
 *
 * Airtable still holds legacy values (`'checkbox'`, `'submit_only'`) written before
 * the type system was unified. They are ambiguous (orchestrated vs quantity_checkbox
 * both stored as `'checkbox'`), so we resolve them by looking up the task's template
 * in `TASK_TIMELINE` — the authoritative source of truth for completion type.
 *
 * Lives in its own module (rather than `taskService.ts`) so unit tests can import
 * it without dragging in the Airtable SDK / service singletons.
 */
export function normalizeCompletionType(
  storedValue: string | undefined,
  templateId: string,
): TaskCompletionType {
  // V2 values pass through unchanged
  if (
    storedValue === 'monetary' ||
    storedValue === 'orchestrated' ||
    storedValue === 'tracklist' ||
    storedValue === 'quantity_checkbox'
  ) {
    return storedValue;
  }
  // Legacy storage values are ambiguous; resolve via the template
  const entry = getTimelineEntry(templateId);
  if (entry) return entry.completion;
  // Fallback for unknown legacy templates (already on the way out)
  return 'monetary';
}
