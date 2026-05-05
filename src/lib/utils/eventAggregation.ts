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
