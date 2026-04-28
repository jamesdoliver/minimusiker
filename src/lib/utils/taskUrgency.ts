/**
 * Calculate urgency score for sorting tasks.
 *
 * Lower score = more urgent. Overdue tasks get strongly negative scores so they
 * naturally sort to the top of any deadline-ordered list.
 *
 * Day-boundary math is performed in UTC (`setUTCHours`) for consistency with
 * the v2 deadline calculator in `taskTimeline.calculateDeadline`. This avoids
 * DST/timezone off-by-one bugs when computing days-until-due near midnight.
 */
export function calculateUrgencyScore(deadline: Date): {
  urgencyScore: number;
  daysUntilDue: number;
  isOverdue: boolean;
} {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const deadlineNormalized = new Date(deadline);
  deadlineNormalized.setUTCHours(0, 0, 0, 0);

  const diffTime = deadlineNormalized.getTime() - today.getTime();
  const daysUntilDue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const isOverdue = daysUntilDue < 0;

  // Overdue tasks get priority: -1000 + daysOverdue (so -5 days overdue = -1005)
  const urgencyScore = isOverdue ? -1000 + daysUntilDue : daysUntilDue;

  return { urgencyScore, daysUntilDue, isOverdue };
}
