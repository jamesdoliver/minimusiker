/**
 * Task Timeline Configuration (v2)
 *
 * This is the NEW task timeline for the redesigned task matrix system.
 * It defines all 11 tasks with their timeline offsets relative to event date.
 * The old taskTemplates.ts remains in use until migration is complete.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Category prefix for grouping tasks in the UI */
export type TaskPrefix = 'Ship' | 'Order' | 'Shipment' | 'Audio';

/**
 * How a task is completed:
 * - monetary: requires an amount (supplier order cost)
 * - orchestrated: coordinated shipment wave, completed as a batch
 * - tracklist: requires tracklist / audio master submission
 * - quantity_checkbox: per-item quantity confirmation
 */
export type TaskCompletionType =
  | 'monetary'
  | 'orchestrated'
  | 'tracklist'
  | 'quantity_checkbox';

/** A single entry in the task timeline */
export interface TaskTimelineEntry {
  /** Unique task identifier, e.g. "ship_poster" */
  id: string;
  /** Category prefix for UI grouping */
  prefix: TaskPrefix;
  /** Human-readable label shown in the matrix column header */
  label: string;
  /** Days relative to event date (negative = before, positive = after) */
  timeline_offset: number;
  /** How this task is completed */
  completion_type: TaskCompletionType;
  /** Whether completing this task should create a GuesstimateOrder record */
  creates_go_id: boolean;
}

// ---------------------------------------------------------------------------
// Timeline Data
// ---------------------------------------------------------------------------

/**
 * The canonical task timeline. Entries are ordered chronologically by offset.
 * This array is the single source of truth for which tasks exist and when
 * they are due relative to the event date.
 */
export const TASK_TIMELINE: readonly TaskTimelineEntry[] = [
  {
    id: 'ship_poster',
    prefix: 'Ship',
    label: 'Poster',
    timeline_offset: -45,
    completion_type: 'monetary',
    creates_go_id: true,
  },
  {
    id: 'ship_flyer_1',
    prefix: 'Ship',
    label: 'Flyer 1',
    timeline_offset: -43,
    completion_type: 'monetary',
    creates_go_id: true,
  },
  {
    id: 'order_schul_clothing',
    prefix: 'Order',
    label: 'Schul Clothing',
    timeline_offset: -18,
    completion_type: 'monetary',
    creates_go_id: true,
  },
  {
    id: 'ship_flyer_2',
    prefix: 'Ship',
    label: 'Flyer 2',
    timeline_offset: -18,
    completion_type: 'monetary',
    creates_go_id: true,
  },
  {
    id: 'ship_flyer_3',
    prefix: 'Ship',
    label: 'Flyer 3',
    timeline_offset: -10,
    completion_type: 'monetary',
    creates_go_id: true,
  },
  {
    id: 'shipment_welle_1',
    prefix: 'Shipment',
    label: 'Welle 1',
    timeline_offset: -9,
    completion_type: 'orchestrated',
    creates_go_id: false,
  },
  {
    id: 'order_minicard',
    prefix: 'Order',
    label: 'Minicard',
    timeline_offset: 5,
    completion_type: 'monetary',
    creates_go_id: true,
  },
  {
    id: 'order_schul_clothing_2',
    prefix: 'Order',
    label: 'Schul Clothing 2',
    timeline_offset: 7,
    completion_type: 'monetary',
    creates_go_id: true,
  },
  {
    id: 'audio_master_cd',
    prefix: 'Audio',
    label: 'Master CD',
    timeline_offset: 11,
    completion_type: 'tracklist',
    creates_go_id: false,
  },
  {
    id: 'audio_cd_production',
    prefix: 'Audio',
    label: 'CD Production',
    timeline_offset: 12,
    completion_type: 'quantity_checkbox',
    creates_go_id: false,
  },
  {
    id: 'shipment_welle_2',
    prefix: 'Shipment',
    label: 'Welle 2',
    timeline_offset: 14,
    completion_type: 'orchestrated',
    creates_go_id: false,
  },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ordered list of all task IDs (chronological by timeline offset) */
export const TASK_TIMELINE_ORDER: readonly string[] = TASK_TIMELINE.map(
  (entry) => entry.id
);

/** Look up a single timeline entry by its task id. Returns undefined if not found. */
export function getTimelineEntry(
  taskId: string
): TaskTimelineEntry | undefined {
  return TASK_TIMELINE.find((entry) => entry.id === taskId);
}

/** Get all timeline entries that belong to a given prefix category. */
export function getTimelineEntriesByPrefix(
  prefix: TaskPrefix
): TaskTimelineEntry[] {
  return TASK_TIMELINE.filter((entry) => entry.prefix === prefix);
}

/**
 * Calculate the concrete deadline for a task given an event date.
 * Returns a Date with time set to midnight UTC.
 */
export function calculateDeadline(
  eventDate: Date | string,
  timelineOffset: number
): Date {
  const base = typeof eventDate === 'string' ? new Date(eventDate) : new Date(eventDate);
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + timelineOffset);
  return base;
}

// ---------------------------------------------------------------------------
// UI Styles
// ---------------------------------------------------------------------------

export interface PrefixStyle {
  /** Tailwind text color class */
  text: string;
  /** Tailwind background + border classes */
  bg: string;
  /** Tailwind ring/outline color class (for focus states) */
  ring: string;
}

/** Visual styles for each task prefix category */
export const PREFIX_STYLES: Record<TaskPrefix, PrefixStyle> = {
  Ship: {
    text: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    ring: 'ring-blue-500',
  },
  Order: {
    text: 'text-purple-700',
    bg: 'bg-purple-50 border-purple-200',
    ring: 'ring-purple-500',
  },
  Shipment: {
    text: 'text-teal-700',
    bg: 'bg-teal-50 border-teal-200',
    ring: 'ring-teal-500',
  },
  Audio: {
    text: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    ring: 'ring-amber-500',
  },
};
