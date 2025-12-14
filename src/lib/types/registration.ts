/**
 * Type definitions for parent registration system
 */

import { ParentSession } from './airtable';

/**
 * Data for a single child being registered
 */
export interface ChildRegistrationData {
  childName: string;       // Full name of the child (required)
  gradeLevel?: string;     // Grade/year level (optional)
}

/**
 * Complete registration form data
 */
export interface RegistrationData {
  // Parent information
  parentEmail: string;
  parentFirstName: string;
  parentPhone?: string;

  // Event context (from URL parameters)
  eventId: string;         // booking_id
  classId: string;         // class_id for the selected class

  // Children to register
  children: ChildRegistrationData[];
}

/**
 * API request body for registration endpoint
 */
export interface RegistrationRequest extends RegistrationData {
  // All fields from RegistrationData
}

/**
 * API response from successful registration
 */
export interface RegistrationResponse {
  success: true;
  data: {
    session: ParentSession;
    redirectUrl: string;
  };
  message: string;
}

/**
 * API response for registration errors
 */
export interface RegistrationErrorResponse {
  success: false;
  error: string;
  errors?: string[];      // Array of validation errors
  data?: {
    shouldLogin?: boolean;  // If true, parent should be logged in instead
    redirectUrl?: string;
  };
}

/**
 * Event and class details fetched for registration
 */
export interface EventClassDetails {
  schoolName: string;
  eventType: string;
  bookingDate?: string;
  className: string;
  teacherName: string;
  otherTeachers?: string;
  bookingId: string;
}

/**
 * Validation result from registration validators
 */
export interface RegistrationValidationResult {
  valid: boolean;
  errors?: string[];
}
