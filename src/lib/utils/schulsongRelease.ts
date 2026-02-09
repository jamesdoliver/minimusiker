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
