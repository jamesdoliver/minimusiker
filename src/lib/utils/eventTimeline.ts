/**
 * Event Timeline Utility
 *
 * Unified timeline system for tracking event lifecycle milestones.
 * Days are measured relative to event date:
 *   - Negative numbers = days BEFORE event
 *   - Zero = event day
 *   - Positive numbers = days AFTER event
 */

/**
 * Early-bird discount deadline: orders placed more than this many days
 * before the event qualify for the early-bird discount (10% off)
 */
export const EARLY_BIRD_DEADLINE_DAYS = 19;

/**
 * Personalized clothing cutoff: available up to 4 days after event.
 * Negative value means days AFTER the event.
 */
export const PERSONALIZED_CLOTHING_CUTOFF_DAYS = -4;

/**
 * Schulsong-only clothing cutoff: available up to 14 days after event.
 * Extended window since schulsong-only events don't have audio products.
 */
export const SCHULSONG_CLOTHING_CUTOFF_DAYS = -14;

/**
 * Event milestones with their timeline offsets (days relative to event)
 * Negative = before event, Positive = after event
 */
export const EVENT_MILESTONES = {
  // Pre-event milestones (negative = days before)
  BOOKING_CONFIRMED: -56, // 8 weeks before
  POSTER_DEADLINE: -58, // Poster & letter to school
  FLYER_ONE_DEADLINE: -42, // First flyer wave
  SONG_SELECTION_DEADLINE: -21, // 3 weeks before - teachers should have songs selected
  FLYER_TWO_DEADLINE: -22, // Second flyer wave
  TSHIRT_ORDER_DEADLINE: -19, // 19 days before - last chance for personalized items (aligns with early-bird)
  FLYER_THREE_DEADLINE: -14, // Third flyer wave
  FINAL_PREP: -7, // 1 week before - final preparation phase

  // Event day
  EVENT_DAY: 0,

  // Post-event milestones (positive = days after)
  MINICARD_ORDER: 1, // Order minicards with access code
  RECORDING_READY: 3, // Recordings typically available
  REMINDER_EMAIL: 7, // First reminder to check portal
  PORTAL_REMINDER: 14, // Second reminder
  PORTAL_CLOSES: 30, // Parent portal access ends
} as const;

export type Milestone = keyof typeof EVENT_MILESTONES;

/**
 * Event phase based on timeline position
 */
export type EventPhase = 'pre-event' | 'event-day' | 'post-event';

/**
 * Comprehensive timeline information for an event
 */
export interface EventTimelineInfo {
  eventDate: Date;
  daysUntilEvent: number; // Negative = after event, Positive = before event
  daysFromEvent: number; // Always positive (absolute distance)
  phase: EventPhase;
  currentMilestone: Milestone | null;
  nextMilestone: Milestone | null;
  passedMilestones: Milestone[];
  upcomingMilestones: Milestone[];
  isWithinPortalWindow: boolean; // Within active portal period (-56 to +30)
}

/**
 * Calculate days until event date (positive = future, negative = past)
 */
export function getDaysUntilEvent(eventDate: string | Date): number {
  const event = new Date(eventDate);
  const today = new Date();

  // Reset times to midnight for accurate day calculation
  event.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffMs = event.getTime() - today.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get the actual date of a milestone based on event date
 */
export function getMilestoneDate(
  eventDate: string | Date,
  milestone: Milestone
): Date {
  const event = new Date(eventDate);
  event.setHours(0, 0, 0, 0);

  const offset = EVENT_MILESTONES[milestone];
  const milestoneDate = new Date(event);
  milestoneDate.setDate(milestoneDate.getDate() + offset);

  return milestoneDate;
}

/**
 * Check if current date is within a milestone window
 * @param eventDate - The event date
 * @param milestone - The milestone to check
 * @param windowDays - Days before milestone to consider "within window" (default: 0)
 */
export function isWithinMilestoneWindow(
  eventDate: string | Date,
  milestone: Milestone,
  windowDays: number = 0
): boolean {
  const daysUntil = getDaysUntilEvent(eventDate);
  const milestoneOffset = EVENT_MILESTONES[milestone];

  // Calculate how many days until we reach this milestone
  // milestone happens at (eventDate + offset), we're at (eventDate - daysUntil)
  // So days to milestone = daysUntil + offset
  const daysToMilestone = daysUntil + milestoneOffset;

  // If milestone is in the past (negative), we're past it
  if (daysToMilestone < 0) return false;

  // If within window days of the milestone
  return daysToMilestone <= windowDays;
}

/**
 * Check if a milestone has passed
 */
export function isMilestonePassed(
  eventDate: string | Date,
  milestone: Milestone
): boolean {
  const daysUntil = getDaysUntilEvent(eventDate);
  const milestoneOffset = EVENT_MILESTONES[milestone];

  // Milestone offset is relative to event (e.g., -14 means 14 days before)
  // If daysUntil is 10 and milestoneOffset is -14, milestone was 4 days ago
  // Formula: daysToMilestone = daysUntil + milestoneOffset
  // Negative means passed
  return daysUntil + milestoneOffset < 0;
}

/**
 * Get event phase based on days until event
 */
export function getEventPhase(daysUntilEvent: number): EventPhase {
  if (daysUntilEvent > 0) return 'pre-event';
  if (daysUntilEvent === 0) return 'event-day';
  return 'post-event';
}

/**
 * Get German label for event phase
 */
export function getPhaseLabel(phase: EventPhase): string {
  switch (phase) {
    case 'pre-event':
      return 'Vor dem Event';
    case 'event-day':
      return 'Eventtag';
    case 'post-event':
      return 'Nach dem Event';
  }
}

/**
 * Get German label for a milestone
 */
export function getMilestoneLabel(milestone: Milestone): string {
  const labels: Record<Milestone, string> = {
    BOOKING_CONFIRMED: 'Buchung bestätigt',
    POSTER_DEADLINE: 'Poster-Versand',
    FLYER_ONE_DEADLINE: 'Flyer 1 Versand',
    SONG_SELECTION_DEADLINE: 'Liedauswahl-Frist',
    FLYER_TWO_DEADLINE: 'Flyer 2 Versand',
    TSHIRT_ORDER_DEADLINE: 'T-Shirt Bestellfrist',
    FLYER_THREE_DEADLINE: 'Flyer 3 Versand',
    FINAL_PREP: 'Letzte Vorbereitungen',
    EVENT_DAY: 'Eventtag',
    MINICARD_ORDER: 'Minikarten-Bestellung',
    RECORDING_READY: 'Aufnahmen verfügbar',
    REMINDER_EMAIL: 'Erinnerungs-E-Mail',
    PORTAL_REMINDER: 'Portal-Erinnerung',
    PORTAL_CLOSES: 'Portal schließt',
  };
  return labels[milestone];
}

/**
 * Calculate complete timeline information for an event
 */
export function calculateEventTimeline(
  eventDate: string | Date
): EventTimelineInfo {
  const event = new Date(eventDate);
  event.setHours(0, 0, 0, 0);

  const daysUntilEvent = getDaysUntilEvent(eventDate);
  const daysFromEvent = Math.abs(daysUntilEvent);
  const phase = getEventPhase(daysUntilEvent);

  // Sort milestones by their timeline position
  const sortedMilestones = (Object.keys(EVENT_MILESTONES) as Milestone[]).sort(
    (a, b) => EVENT_MILESTONES[a] - EVENT_MILESTONES[b]
  );

  const passedMilestones: Milestone[] = [];
  const upcomingMilestones: Milestone[] = [];
  let currentMilestone: Milestone | null = null;
  let nextMilestone: Milestone | null = null;

  for (const milestone of sortedMilestones) {
    const offset = EVENT_MILESTONES[milestone];
    const daysToMilestone = daysUntilEvent + offset;

    if (daysToMilestone < 0) {
      // Milestone has passed
      passedMilestones.push(milestone);
    } else if (daysToMilestone === 0) {
      // Milestone is today
      currentMilestone = milestone;
      passedMilestones.push(milestone); // Also count as passed
    } else {
      // Milestone is upcoming
      upcomingMilestones.push(milestone);
      if (!nextMilestone) {
        nextMilestone = milestone;
      }
    }
  }

  // Portal window is from booking confirmed (-56) to portal closes (+30)
  const isWithinPortalWindow =
    daysUntilEvent <= 56 && daysUntilEvent >= -30;

  return {
    eventDate: event,
    daysUntilEvent,
    daysFromEvent,
    phase,
    currentMilestone,
    nextMilestone,
    passedMilestones,
    upcomingMilestones,
    isWithinPortalWindow,
  };
}

/**
 * Format days until/since event for display (German)
 */
export function formatDaysDisplay(daysUntilEvent: number): string {
  if (daysUntilEvent === 0) {
    return 'Heute';
  }

  const absDays = Math.abs(daysUntilEvent);
  const unit = absDays === 1 ? 'Tag' : 'Tage';

  if (daysUntilEvent > 0) {
    return `Noch ${absDays} ${unit}`;
  } else {
    return `Vor ${absDays} ${unit}n`;
  }
}

/**
 * Check if personalized products can still be ordered
 * (used for t-shirt promo, based on TSHIRT_ORDER_DEADLINE)
 */
export function canOrderPersonalizedProducts(eventDate: string | Date): boolean {
  return !isMilestonePassed(eventDate, 'TSHIRT_ORDER_DEADLINE');
}

/**
 * Check if personalized clothing can still be ordered
 * Personalized products available from any time before event up to 4 days after.
 *
 * @param eventDate - The event date
 * @returns true if available (up to 4 days after event)
 */
export function canOrderPersonalizedClothing(
  eventDate: string | Date | undefined,
  cutoffDays: number = PERSONALIZED_CLOTHING_CUTOFF_DAYS
): boolean {
  if (!eventDate) return false; // No event date = default to standard

  const daysUntil = getDaysUntilEvent(eventDate);

  // Available from any time before event up to N days after
  // e.g. daysUntil >= -4 means: event is in future, today, or up to 4 days ago
  return daysUntil >= cutoffDays;
}

/**
 * Get countdown to personalized product deadline
 * Returns null if deadline has passed
 */
export function getPersonalizedProductCountdown(
  eventDate: string | Date
): { days: number; hours: number } | null {
  const deadline = getMilestoneDate(eventDate, 'TSHIRT_ORDER_DEADLINE');
  const now = new Date();

  const diff = deadline.getTime() - now.getTime();

  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return { days, hours };
}

/**
 * Get countdown to early-bird discount deadline (19 days before event)
 * Returns null if deadline has passed
 */
export function getEarlyBirdCountdown(
  eventDate: string | Date
): { days: number; hours: number; minutes: number; seconds: number } | null {
  const event = new Date(eventDate);
  const deadline = new Date(event);
  deadline.setDate(deadline.getDate() - EARLY_BIRD_DEADLINE_DAYS);
  // Set deadline to end of day (23:59:59)
  deadline.setHours(23, 59, 59, 999);

  const now = new Date();
  const diff = deadline.getTime() - now.getTime();

  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds };
}

/**
 * Get countdown to schulsong clothing order deadline
 * Returns null if deadline has passed
 */
export function getSchulsongClothingCountdown(
  eventDate: string | Date
): { days: number; hours: number; minutes: number; seconds: number } | null {
  const event = new Date(eventDate);
  const deadline = new Date(event);
  deadline.setDate(deadline.getDate() + Math.abs(SCHULSONG_CLOTHING_CUTOFF_DAYS));
  // Set deadline to end of day (23:59:59)
  deadline.setHours(23, 59, 59, 999);

  const now = new Date();
  const diff = deadline.getTime() - now.getTime();

  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds };
}
