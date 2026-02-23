/**
 * Validation functions for parent registration system
 */

import {
  RegistrationData,
  RegistrationValidationResult,
  ChildRegistrationData,
} from '../types/registration';
import {
  validateEmail,
  sanitizeString,
  isValidEventId,
  isValidClassId,
} from '../utils/validators';

/**
 * Validates parent's first name
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

  const namePattern = /^[\p{L}\s\-'.]+$/u;
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

  // Allow letters (including Unicode: ä, ö, ü, ß, é, etc.), spaces, hyphens, apostrophes
  const namePattern = /^[\p{L}\s\-'.]+$/u;
  if (!namePattern.test(trimmed)) {
    return {
      valid: false,
      error: 'Child name contains invalid characters',
    };
  }

  return { valid: true };
}

/**
 * Validates grade/year level (optional field)
 */
export function validateGradeLevel(grade: string): {
  valid: boolean;
  error?: string;
} {
  if (!grade || typeof grade !== 'string') {
    return { valid: true }; // Optional field
  }

  const trimmed = grade.trim();

  if (trimmed.length === 0) {
    return { valid: true }; // Empty is OK (optional)
  }

  if (trimmed.length > 50) {
    return {
      valid: false,
      error: 'Grade level must be 50 characters or less',
    };
  }

  // Allow alphanumeric (including Unicode letters), spaces, and common punctuation
  const gradePattern = /^[\p{L}0-9\s\-'.()]+$/u;
  if (!gradePattern.test(trimmed)) {
    return {
      valid: false,
      error: 'Grade level contains invalid characters',
    };
  }

  return { valid: true };
}

/**
 * Checks for duplicate child names in the registration
 */
export function checkDuplicateChildren(
  children: ChildRegistrationData[]
): {
  valid: boolean;
  error?: string;
} {
  const names = children.map((c) => c.childName.toLowerCase().trim());
  const uniqueNames = new Set(names);

  if (names.length !== uniqueNames.size) {
    return {
      valid: false,
      error:
        'You have entered the same child name more than once. Please check your entries.',
    };
  }

  return { valid: true };
}

/**
 * Validates a single child registration data
 */
export function validateChildRegistration(
  child: ChildRegistrationData,
  index: number
): string[] {
  const errors: string[] = [];

  // Validate child name
  const nameValidation = validateChildName(child.childName);
  if (!nameValidation.valid) {
    errors.push(`Child ${index + 1}: ${nameValidation.error}`);
  }

  // Validate grade level (if provided)
  if (child.gradeLevel) {
    const gradeValidation = validateGradeLevel(child.gradeLevel);
    if (!gradeValidation.valid) {
      errors.push(`Child ${index + 1}: ${gradeValidation.error}`);
    }
  }

  return errors;
}

/**
 * Validates complete registration data
 */
export function validateRegistrationData(
  data: RegistrationData
): RegistrationValidationResult {
  const errors: string[] = [];

  // Validate parent email
  const emailValidation = validateEmail(data.parentEmail);
  if (!emailValidation.valid) {
    errors.push(emailValidation.error!);
  }

  // Validate parent first name
  const nameValidation = validateParentName(data.parentFirstName);
  if (!nameValidation.valid) {
    errors.push(nameValidation.error!);
  }

  // Validate phone (if provided)
  if (data.parentPhone) {
    const phoneValidation = validatePhoneNumber(data.parentPhone);
    if (!phoneValidation.valid) {
      errors.push(phoneValidation.error!);
    }
  }

  // Validate event ID
  if (!data.eventId || !isValidEventId(data.eventId)) {
    errors.push('Invalid event ID');
  }

  // Validate class ID
  if (!data.classId || !isValidClassId(data.classId)) {
    errors.push('Invalid class ID');
  }

  // Validate children array
  if (!data.children || !Array.isArray(data.children)) {
    errors.push('Children data is required');
  } else {
    // Must have at least one child
    if (data.children.length === 0) {
      errors.push('At least one child is required');
    }

    // Reasonable maximum (prevent abuse)
    if (data.children.length > 10) {
      errors.push('Maximum 10 children per registration');
    }

    // Validate each child
    data.children.forEach((child, index) => {
      const childErrors = validateChildRegistration(child, index);
      errors.push(...childErrors);
    });

    // Check for duplicate child names
    const duplicateCheck = checkDuplicateChildren(data.children);
    if (!duplicateCheck.valid) {
      errors.push(duplicateCheck.error!);
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Sanitizes registration data to prevent XSS
 */
export function sanitizeRegistrationData(
  data: RegistrationData
): RegistrationData {
  return {
    parentEmail: data.parentEmail.toLowerCase().trim(),
    parentFirstName: sanitizeString(data.parentFirstName),
    parentPhone: data.parentPhone ? sanitizeString(data.parentPhone) : undefined,
    eventId: sanitizeString(data.eventId),
    classId: sanitizeString(data.classId),
    children: data.children.map((child) => ({
      childName: sanitizeString(child.childName),
      gradeLevel: child.gradeLevel
        ? sanitizeString(child.gradeLevel)
        : undefined,
    })),
  };
}
