/**
 * Compute the schulsong release date: next workday at 7am CET/CEST
 *
 * Rules:
 * - Always advance to at least the next day (never same-day release)
 * - Skip weekends: if next day is Saturday → Monday; Sunday → Monday
 * - Set time to 07:00:00 in Europe/Berlin timezone
 * - Return as UTC Date
 */
export function computeSchulsongReleaseDate(now: Date = new Date()): Date {
  // Work in Europe/Berlin timezone
  const berlinFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  // Get current date parts in Berlin timezone
  const berlinDateStr = berlinFormatter.format(now); // YYYY-MM-DD
  const [year, month, day] = berlinDateStr.split('-').map(Number);

  // Start from tomorrow in Berlin time
  const candidate = new Date(Date.UTC(year, month - 1, day + 1));

  // Get the day of week for the candidate in Berlin timezone
  const candidateDay = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
  }).format(candidate);

  // Skip weekends
  if (candidateDay === 'Sat') {
    candidate.setUTCDate(candidate.getUTCDate() + 2); // Saturday → Monday
  } else if (candidateDay === 'Sun') {
    candidate.setUTCDate(candidate.getUTCDate() + 1); // Sunday → Monday
  }

  // Now set the time to 07:00 Berlin time by computing the UTC offset
  // Create a date string in Berlin timezone at 07:00
  const releaseDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(candidate);

  // Parse the Berlin date and create a Date at 07:00 Berlin time
  // We use a trick: create a date string with time and parse it using the timezone
  const [rYear, rMonth, rDay] = releaseDateStr.split('-').map(Number);

  // Calculate UTC offset for Berlin at this date by comparing
  // Create a reference point at midnight UTC on this date
  const midnightUtc = new Date(Date.UTC(rYear, rMonth - 1, rDay, 0, 0, 0));

  // Get the Berlin hour at this UTC midnight
  const berlinHourAtMidnight = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin',
      hour: 'numeric',
      hour12: false,
    }).format(midnightUtc)
  );

  // The offset in hours: if Berlin shows 1 at UTC midnight, offset is +1
  // So to get 07:00 Berlin = 07:00 - offset in UTC
  const utcHour = 7 - berlinHourAtMidnight;

  return new Date(Date.UTC(rYear, rMonth - 1, rDay, utcHour, 0, 0));
}

/**
 * Compute the unified schulsong release date based on event type.
 *
 * Schulsong-only: next day at 7am Berlin (approval + 1 day)
 * Combined (M/PLUS + Schulsong): max(event_date + full_release_days, next day 7am Berlin)
 */
export function computeUnifiedReleaseDate(
  eventDate: string | undefined,
  fullReleaseDays: number,
  isCombined: boolean,
  now: Date = new Date()
): Date {
  const nextDay7am = computeSchulsongReleaseDate(now);

  if (!isCombined || !eventDate) {
    // Schulsong-only: always next day 7am
    return nextDay7am;
  }

  // Combined: max(event_date + full_release_days at 7am Berlin, next day 7am)
  const normalGate = new Date(eventDate);
  normalGate.setDate(normalGate.getDate() + fullReleaseDays);

  // Set normal gate to 7am Berlin for fair comparison
  const berlinFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [gYear, gMonth, gDay] = berlinFormatter.format(normalGate).split('-').map(Number);
  const midnightUtc = new Date(Date.UTC(gYear, gMonth - 1, gDay, 0, 0, 0));
  const berlinHourAtMidnight = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin',
      hour: 'numeric',
      hour12: false,
    }).format(midnightUtc)
  );
  const normalGate7am = new Date(Date.UTC(gYear, gMonth - 1, gDay, 7 - berlinHourAtMidnight, 0, 0));

  return normalGate7am > nextDay7am ? normalGate7am : nextDay7am;
}

/**
 * Compute the schulsong merch cutoff date.
 *
 * Schulsong-only: release_date + 10 days
 * Combined: max(event_date + 14, release_date + 7 days)
 */
export function computeSchulsongMerchCutoff(
  releaseDate: Date,
  eventDate: string | undefined,
  isCombined: boolean
): Date {
  if (!isCombined || !eventDate) {
    // Schulsong-only: release + 10 days
    const cutoff = new Date(releaseDate);
    cutoff.setDate(cutoff.getDate() + 10);
    return cutoff;
  }

  // Combined: max(event_date + 14, release + 7)
  const eventGate = new Date(eventDate);
  eventGate.setDate(eventGate.getDate() + 14);

  const releaseGate = new Date(releaseDate);
  releaseGate.setDate(releaseGate.getDate() + 7);

  return eventGate > releaseGate ? eventGate : releaseGate;
}
