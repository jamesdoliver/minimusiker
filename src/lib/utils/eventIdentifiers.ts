import crypto from 'crypto';

/**
 * Generate a unique event ID from school name, event type, and booking date
 * This creates a deterministic ID that's the same for the same input values
 *
 * @param schoolName - Name of the school (e.g., "Calder High School")
 * @param eventType - Type of event (e.g., "minimusiker", "spring concert")
 * @param bookingDate - Date of the event in ISO format (e.g., "2025-11-20")
 * @returns Unique event ID (e.g., "evt_calder_high_minimusiker_20251120")
 */
export function generateEventId(
  schoolName: string,
  eventType: string,
  bookingDate?: string
): string {
  // Create slugs from school and event type
  const schoolSlug = schoolName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 30); // Limit length for readability

  const eventSlug = eventType
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 20); // Limit length

  // Format date as YYYYMMDD
  let dateStr = '';
  if (bookingDate) {
    // Handle both YYYY-MM-DD and ISO datetime formats
    const dateOnly = bookingDate.split('T')[0];
    dateStr = dateOnly.replace(/-/g, '');
  }

  // Generate a short hash for uniqueness (in case of similar names)
  const hashInput = `${schoolName}|${eventType}|${bookingDate || ''}`;
  const hash = crypto.createHash('md5').update(hashInput).digest('hex').substring(0, 6);

  // Combine parts to create event ID
  if (dateStr) {
    return `evt_${schoolSlug}_${eventSlug}_${dateStr}_${hash}`;
  }

  // Fallback without date (shouldn't happen in normal use)
  return `evt_${schoolSlug}_${eventSlug}_${hash}`;
}

/**
 * Generate a school ID from school name
 * Creates a consistent ID for the same school name
 *
 * @param schoolName - Name of the school
 * @returns School ID (e.g., "sch_calder_high_school_a1b2c3")
 */
export function generateSchoolId(schoolName: string): string {
  const slug = schoolName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 40);

  // Add hash for uniqueness
  const hash = crypto.createHash('md5').update(schoolName).digest('hex').substring(0, 6);

  return `sch_${slug}_${hash}`;
}

/**
 * Generate a slug from a class name
 * Converts class names to URL-safe slugs
 *
 * @param className - Class name (e.g., "3rd Grade", "Year 5", "Mrs. Smith's Class")
 * @returns Slug (e.g., "3rd-grade", "year-5", "mrs-smiths-class")
 */
export function generateClassSlug(className: string): string {
  return className
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);
}

/**
 * Generate a unique class ID from school name, event date, and class name
 * This creates a deterministic ID that's the same for the same input values
 * Used to uniquely identify a class within an event for recording organization
 *
 * @param schoolName - Name of the school (e.g., "Calder High School")
 * @param bookingDate - Date of the event in ISO format (e.g., "2025-11-20")
 * @param className - Class name (e.g., "3rd Grade", "Year 5")
 * @returns Unique class ID (e.g., "cls_calder_high_20251120_3rdgrade_a1b2c3")
 */
export function generateClassId(
  schoolName: string,
  bookingDate: string,
  className: string
): string {
  // Create school slug
  const schoolSlug = schoolName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 30);

  // Create class slug
  const classSlug = className
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 15); // Shorter for class names

  // Format date as YYYYMMDD
  const dateOnly = bookingDate.split('T')[0];
  const dateStr = dateOnly.replace(/-/g, '');

  // Generate a short hash for uniqueness
  const hashInput = `${schoolName}|${bookingDate}|${className}`;
  const hash = crypto.createHash('md5').update(hashInput).digest('hex').substring(0, 6);

  // Combine parts to create class ID
  return `cls_${schoolSlug}_${dateStr}_${classSlug}_${hash}`;
}

/**
 * Generate R2 storage path for a class-specific event recording
 * LEGACY: Use generateRecordingPathByClassId for new implementations
 *
 * @param eventId - Unique event identifier
 * @param className - Class name (e.g., "3rd Grade")
 * @param type - Type of recording ('preview' or 'full')
 * @returns R2 storage path (e.g., "events/evt_xxx/3rd-grade/preview.mp3")
 */
export function generateRecordingPath(
  eventId: string,
  type: 'preview' | 'full',
  className?: string
): string {
  if (className) {
    const classSlug = generateClassSlug(className);
    return `events/${eventId}/${classSlug}/${type}.mp3`;
  }
  // Fallback for backward compatibility
  return `events/${eventId}/${type}.mp3`;
}

/**
 * Generate R2 storage path using class_id (recommended for new implementations)
 * Provides more reliable path structure with unique identifiers
 *
 * @param eventId - Unique event identifier (booking_id)
 * @param classId - Unique class identifier
 * @param type - Type of recording ('preview' or 'full')
 * @returns R2 storage path (e.g., "events/evt_xxx/cls_xxx/preview.mp3")
 */
export function generateRecordingPathByClassId(
  eventId: string,
  classId: string,
  type: 'preview' | 'full'
): string {
  return `events/${eventId}/${classId}/${type}.mp3`;
}

/**
 * Parse event ID to extract components
 *
 * @param eventId - Event ID to parse
 * @returns Parsed components or null if invalid
 */
export function parseEventId(eventId: string): {
  schoolSlug: string;
  eventSlug: string;
  date?: string;
  hash: string;
} | null {
  const pattern = /^evt_([^_]+(?:_[^_]+)*)_([^_]+(?:_[^_]+)*)_(\d{8})?_?([a-f0-9]{6})$/;
  const match = eventId.match(pattern);

  if (!match) {
    // Try without date
    const simplePattern = /^evt_([^_]+(?:_[^_]+)*)_([^_]+(?:_[^_]+)*)_([a-f0-9]{6})$/;
    const simpleMatch = eventId.match(simplePattern);

    if (!simpleMatch) return null;

    return {
      schoolSlug: simpleMatch[1],
      eventSlug: simpleMatch[2],
      hash: simpleMatch[3],
    };
  }

  return {
    schoolSlug: match[1],
    eventSlug: match[2],
    date: match[3],
    hash: match[4],
  };
}

/**
 * Format a booking date for display
 *
 * @param bookingDate - Date string in ISO or YYYY-MM-DD format
 * @returns Formatted date string
 */
export function formatEventDate(bookingDate?: string): string {
  if (!bookingDate) return '';

  try {
    const date = new Date(bookingDate);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return bookingDate;
  }
}