/**
 * Validation utilities for MiniMusiker platform
 * Provides validation functions for class_id, booking_id, and other identifiers
 */

/**
 * Validates if a string is a valid class_id
 * Expected format: cls_{school_slug}_{date}_{class_slug}_{hash}
 * Example: cls_calder_high_20251120_3rdgrade_a1b2c3
 *
 * @param classId - The class_id to validate
 * @returns True if valid, false otherwise
 */
export function isValidClassId(classId: string): boolean {
  if (!classId || typeof classId !== 'string') {
    return false;
  }

  // Pattern: cls_ + school_slug + _ + 8-digit date + _ + class_slug (may include underscores) + _ + 6-char hash
  const pattern = /^cls_[a-z0-9_]+_\d{8}_[a-z0-9_]+_[a-f0-9]{6}$/;
  return pattern.test(classId);
}

/**
 * Validates if a string is a valid booking_id/event_id
 * Expected format: evt_{school_slug}_{event_slug}_{date}_{hash}
 * Example: evt_calder_high_minimusiker_20251120_a1b2c3
 *
 * @param eventId - The event/booking ID to validate
 * @returns True if valid, false otherwise
 */
export function isValidEventId(eventId: string): boolean {
  if (!eventId || typeof eventId !== 'string') {
    return false;
  }

  // Pattern: evt_ + alphanumeric/underscore + 6-char hash (with optional date)
  const pattern = /^evt_[a-z0-9_]+_[a-f0-9]{6}$/;
  const patternWithDate = /^evt_[a-z0-9_]+_\d{8}_[a-f0-9]{6}$/;

  return pattern.test(eventId) || patternWithDate.test(eventId);
}

/**
 * Validates if a string is a valid school_id
 * Expected format: sch_{school_slug}_{hash}
 * Example: sch_calder_high_school_a1b2c3
 *
 * @param schoolId - The school ID to validate
 * @returns True if valid, false otherwise
 */
export function isValidSchoolId(schoolId: string): boolean {
  if (!schoolId || typeof schoolId !== 'string') {
    return false;
  }

  // Pattern: sch_ + alphanumeric/underscore + _ + 6-char hash
  const pattern = /^sch_[a-z0-9_]+_[a-f0-9]{6}$/;
  return pattern.test(schoolId);
}

/**
 * Validates class data for event creation
 *
 * @param className - The class name to validate
 * @returns Validation result with error message if invalid
 */
export function validateClassName(className: string): {
  valid: boolean;
  error?: string;
} {
  if (!className || typeof className !== 'string') {
    return { valid: false, error: 'Class name is required' };
  }

  const trimmed = className.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Class name cannot be empty' };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: 'Class name must be 100 characters or less' };
  }

  // Check for invalid characters (allow letters, numbers, spaces, hyphens, apostrophes, periods)
  const validPattern = /^[a-zA-Z0-9\s\-'.]+$/;
  if (!validPattern.test(trimmed)) {
    return {
      valid: false,
      error: 'Class name contains invalid characters',
    };
  }

  return { valid: true };
}

/**
 * Validates school name for event creation
 *
 * @param schoolName - The school name to validate
 * @returns Validation result with error message if invalid
 */
export function validateSchoolName(schoolName: string): {
  valid: boolean;
  error?: string;
} {
  if (!schoolName || typeof schoolName !== 'string') {
    return { valid: false, error: 'School name is required' };
  }

  const trimmed = schoolName.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'School name cannot be empty' };
  }

  if (trimmed.length < 3) {
    return { valid: false, error: 'School name must be at least 3 characters' };
  }

  if (trimmed.length > 200) {
    return { valid: false, error: 'School name must be 200 characters or less' };
  }

  return { valid: true };
}

/**
 * Validates event date
 *
 * @param eventDate - The event date to validate (ISO format YYYY-MM-DD)
 * @returns Validation result with error message if invalid
 */
export function validateEventDate(eventDate: string): {
  valid: boolean;
  error?: string;
} {
  if (!eventDate || typeof eventDate !== 'string') {
    return { valid: false, error: 'Event date is required' };
  }

  // Check ISO date format (YYYY-MM-DD)
  const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoPattern.test(eventDate)) {
    return {
      valid: false,
      error: 'Event date must be in YYYY-MM-DD format',
    };
  }

  // Validate actual date
  const date = new Date(eventDate);
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date' };
  }

  // Normalize all dates to midnight UTC for consistent comparison
  // This prevents edge cases where time components cause boundary issues
  const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // Check if date is not too far in the past (more than 2 years)
  const today = new Date();
  const twoYearsAgo = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate());

  if (normalizedDate < twoYearsAgo) {
    return {
      valid: false,
      error: 'Event date cannot be more than 2 years in the past',
    };
  }

  // Check if date is not too far in the future (more than 2 years)
  const twoYearsFromNow = new Date(today.getFullYear() + 2, today.getMonth(), today.getDate());

  if (normalizedDate > twoYearsFromNow) {
    return {
      valid: false,
      error: 'Event date cannot be more than 2 years in the future',
    };
  }

  return { valid: true };
}

/**
 * Validates teacher name
 *
 * @param teacherName - The teacher name to validate
 * @returns Validation result with error message if invalid
 */
export function validateTeacherName(teacherName: string): {
  valid: boolean;
  error?: string;
} {
  if (!teacherName || typeof teacherName !== 'string') {
    return { valid: false, error: 'Teacher name is required' };
  }

  const trimmed = teacherName.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Teacher name cannot be empty' };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: 'Teacher name must be 100 characters or less' };
  }

  return { valid: true };
}

/**
 * Validates email address
 *
 * @param email - The email to validate
 * @returns Validation result with error message if invalid
 */
export function validateEmail(email: string): {
  valid: boolean;
  error?: string;
} {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const trimmed = email.trim();

  // Basic email pattern
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }

  if (trimmed.length > 255) {
    return { valid: false, error: 'Email must be 255 characters or less' };
  }

  return { valid: true };
}

/**
 * Sanitizes a string to prevent XSS attacks
 *
 * @param input - The string to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validates a complete event creation request
 *
 * @param data - The event data to validate
 * @returns Validation result with array of errors
 */
export function validateEventCreation(data: {
  schoolName: string;
  eventDate: string;
  eventType: string;
  mainTeacher: string;
  otherTeachers?: string[];
  classes: { className: string; notes?: string }[];
}): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate school name
  const schoolValidation = validateSchoolName(data.schoolName);
  if (!schoolValidation.valid) {
    errors.push(schoolValidation.error!);
  }

  // Validate event date
  const dateValidation = validateEventDate(data.eventDate);
  if (!dateValidation.valid) {
    errors.push(dateValidation.error!);
  }

  // Validate event type
  if (!data.eventType || !['minimusiker', 'schulsong'].includes(data.eventType.toLowerCase())) {
    errors.push('Event type must be either Minimusiker or Schulsong');
  }

  // Validate main teacher
  const teacherValidation = validateTeacherName(data.mainTeacher);
  if (!teacherValidation.valid) {
    errors.push(teacherValidation.error!);
  }

  // Validate other teachers if provided
  if (data.otherTeachers && Array.isArray(data.otherTeachers)) {
    data.otherTeachers.forEach((teacher, index) => {
      const validation = validateTeacherName(teacher);
      if (!validation.valid) {
        errors.push(`Other teacher ${index + 1}: ${validation.error}`);
      }
    });
  }

  // Validate classes
  if (!data.classes || !Array.isArray(data.classes) || data.classes.length === 0) {
    errors.push('At least one class is required');
  } else {
    data.classes.forEach((classData, index) => {
      const validation = validateClassName(classData.className);
      if (!validation.valid) {
        errors.push(`Class ${index + 1}: ${validation.error}`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates parent's first name
 *
 * @param name - The parent's name to validate
 * @returns Validation result with error message if invalid
 */
export function validateParentName(name: string): {
  valid: boolean;
  error?: string;
} {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Parent name is required' };
  }

  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: 'Name must be 50 characters or less' };
  }

  const namePattern = /^[a-zA-Z\s\-'.]+$/;
  if (!namePattern.test(trimmed)) {
    return {
      valid: false,
      error: 'Name contains invalid characters',
    };
  }

  return { valid: true };
}

/**
 * Validates phone number (international format)
 *
 * @param phone - The phone number to validate
 * @returns Validation result with error message if invalid
 */
export function validatePhoneNumber(phone: string): {
  valid: boolean;
  error?: string;
} {
  if (!phone || typeof phone !== 'string') {
    return { valid: true }; // Optional field
  }

  const trimmed = phone.trim();

  if (trimmed.length === 0) {
    return { valid: true }; // Empty is OK (optional)
  }

  // Allow various phone formats
  const phonePattern = /^[\d\s\-+()]{8,20}$/;
  if (!phonePattern.test(trimmed)) {
    return { valid: false, error: 'Invalid phone number format' };
  }

  return { valid: true };
}

/**
 * Validates child's full name
 *
 * @param name - The child's name to validate
 * @returns Validation result with error message if invalid
 */
export function validateChildName(name: string): {
  valid: boolean;
  error?: string;
} {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Child name is required' };
  }

  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return { valid: false, error: 'Child name must be at least 2 characters' };
  }

  if (trimmed.length > 100) {
    return {
      valid: false,
      error: 'Child name must be 100 characters or less',
    };
  }

  // Allow letters, spaces, hyphens, apostrophes
  const namePattern = /^[a-zA-Z\s\-'.]+$/;
  if (!namePattern.test(trimmed)) {
    return {
      valid: false,
      error: 'Child name contains invalid characters',
    };
  }

  return { valid: true };
}
