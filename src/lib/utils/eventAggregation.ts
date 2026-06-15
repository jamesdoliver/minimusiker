export interface AggregableClass {
  className: string;
  totalChildren: number;
  registeredParents: number;
  isDefault?: boolean;
  classType?: string;
}

/**
 * Returns true if this class is the auto-created "catch-all" (is_default=true)
 * created by the SimplyBook webhook so parents can register before the teacher
 * sets up real classes. Once real classes exist, this row should be excluded
 * from header totals to avoid double-counting children.
 *
 * NOTE: a user-created class named "Alle Kinder" is NOT a catch-all — only the
 * is_default flag distinguishes the system-generated row. Manual duplicates are
 * a data-entry issue handled outside this helper.
 */
export function isCatchAllClass(cls: AggregableClass): boolean {
  return cls.isDefault === true;
}

export interface DedupableClass {
  classId: string;
  className: string;
  isDefault?: boolean;
  classType?: string;
  numChildren?: number;
  songs?: unknown[];
}

/**
 * Collapse REDUNDANT duplicate class rows within a single event.
 *
 * Duplicates occur when createDefaultClass / createClass ran more than once with
 * a drifted class_id. The id is derived from generateClassId(school, date, name),
 * which changes when the booking is rescheduled (the date is baked in) or when
 * the slug-normalization code changes between deploys (e.g. "Straße" → strass vs
 * stra_e, "Alle Kinder" → alle_kinder vs allekinder). The idempotency guards key
 * on that id, so they miss the existing row and create a second one linked to the
 * same event. The teacher portal then renders e.g. "Alle Kinder" two or three
 * times, inflates class/song counts, and (for a same-class_id pair) emits
 * duplicate React list keys.
 *
 * Identity for collapsing: same class_id (pass 1), then same classType +
 * case-insensitive, whitespace-trimmed name (pass 2). To avoid hiding a teacher's
 * real class, we only drop a copy that is genuinely REDUNDANT — no songs AND
 * (a system default OR no expected-children). A copy that holds songs, or a
 * distinct non-default class that has a children count, is always kept (two such
 * same-named classes need data cleanup, not display hiding). Blank-named rows
 * can't be identified by name, so they are keyed by classId and never merged.
 *
 * First-appearance order of the surviving rows is preserved.
 */
export function dedupeClassViews<T extends DedupableClass>(classes: T[]): T[] {
  const order = new Map<T, number>();
  classes.forEach((c, i) => order.set(c, i));
  const score = (c: T) => (c.songs?.length || 0) * 1_000_000 + (c.numChildren || 0);

  // Pass 1 — collapse rows that share the same class_id. These are the SAME
  // record duplicated (the song filter assigns them identical songs, which is
  // why a name-only dedupe can't drop them), and they also emit duplicate React
  // list keys. Keep the richest copy.
  const byId = new Map<string, T>();
  for (const c of classes) {
    const prev = byId.get(c.classId);
    if (!prev || score(c) > score(prev)) byId.set(c.classId, c);
  }
  const afterId = [...byId.values()];

  // Pass 2 — collapse rows with the same classType + name (drifted class_id
  // duplicates, e.g. two "Alle Kinder" with different ids, OR a system default
  // alongside a manually-created class of the same name). isDefault is NOT part
  // of the key: a default "Alle Kinder" and a manual "Alle Kinder" are the same
  // thing to a viewer. Drop empty redundant copies but keep every copy that
  // carries real songs so two genuinely distinct same-named classes are never
  // merged (those need data cleanup, not display hiding — hiding would drop a
  // song). Blank-named rows can't be matched by name, so they stay keyed by
  // class_id (never merged). classType stays in the key so a choir/teacher_song
  // collection that happens to share a name with a regular class is untouched
  // (the UI renders those in separate sections).
  const groups = new Map<string, T[]>();
  for (const c of afterId) {
    const name = (c.className || '').trim().toLowerCase();
    const key = name
      ? `n:${c.classType || 'regular'}:${name}`
      : `i:${c.classId}`;
    const list = groups.get(key);
    if (list) list.push(c);
    else groups.set(key, [c]);
  }

  // A row is a REDUNDANT copy only if it carries no teacher data we'd hide by
  // dropping it: no songs AND (it's a system default — a nameless catch-all that
  // is excluded from header totals anyway — OR it has no expected-children).
  // createClass deliberately supports two distinct same-named regular classes
  // (it suffixes class_id), so a freshly-added class that has a children count
  // but no songs yet must NOT be dropped.
  const isRedundant = (c: T) =>
    (c.songs?.length || 0) === 0 && (c.isDefault === true || (c.numChildren || 0) === 0);

  const survivors: T[] = [];
  for (const list of groups.values()) {
    if (list.length === 1) {
      survivors.push(list[0]);
      continue;
    }
    const keepers = list.filter((c) => !isRedundant(c));
    if (keepers.length > 0) {
      survivors.push(...keepers);
    } else {
      // All redundant → keep the single best (most children, else first seen).
      const best = list.reduce((a, b) =>
        (b.numChildren || 0) > (a.numChildren || 0) ? b : a
      );
      survivors.push(best);
    }
  }

  return survivors.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

export interface EventTotals {
  totalChildren: number;
  totalParents: number;
  overallRegistrationRate: number; // 0–100, rounded
}

/**
 * Sum children + parent registrations across an event's classes.
 *
 * Rule: if any non-catch-all class exists, exclude catch-all rows. Otherwise
 * the catch-all is the only data we have, so include it.
 */
export function aggregateEventTotals(classes: AggregableClass[]): EventTotals {
  const realClasses = classes.filter(c => !isCatchAllClass(c));
  const counted = realClasses.length > 0 ? realClasses : classes;

  const totalChildren = counted.reduce((s, c) => s + (c.totalChildren || 0), 0);
  const totalParents = counted.reduce((s, c) => s + (c.registeredParents || 0), 0);
  const overallRegistrationRate = totalChildren > 0
    ? Math.round((totalParents / totalChildren) * 100)
    : 0;

  return { totalChildren, totalParents, overallRegistrationRate };
}

/**
 * Null-safe ascending comparator for sorting class views by display name.
 *
 * `className` is `undefined` whenever a Class row's `class_name` field is unset
 * in Airtable — e.g. leftover empty classes from a class merge (regression:
 * event 1776 Pleisterschule had 3 such rows). Calling `.localeCompare` directly
 * on `undefined` throws "Cannot read properties of undefined (reading
 * 'localeCompare')", which 500s every endpoint that sorts classes by name and
 * makes the admin event-detail page unreachable. Coerce a missing name to ''
 * (blanks sort first) — mirrors the already-guarded journey sorts.
 */
export function compareClassName(
  a: { className?: string },
  b: { className?: string },
): number {
  return (a.className || '').localeCompare(b.className || '');
}
