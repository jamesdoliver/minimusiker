// Teacher Portal Type Definitions
// For school teachers who book events via SimplyBook

// =============================================================================
// AIRTABLE TABLE IDs
// =============================================================================

export const TEACHERS_TABLE_ID = 'tblLO2vXcgvNjrJ0T';
export const SONGS_TABLE_ID = 'tblPjGWQlHuG8jp5X';
export const AUDIO_FILES_TABLE_ID = 'tbloCM4tmH7mYoyXR';

// =============================================================================
// AIRTABLE FIELD IDs
// =============================================================================

export const TEACHERS_FIELD_IDS = {
  name: 'fld3GL8fRPSPhMw4J', // Contact person name
  email: 'fldkVlTMgLrLUrwlo', // Email (primary lookup)
  phone: 'fld68dyMBRoE2rMX4', // Phone number
  school_name: 'fldPWSqdRUVxzCOly', // School name
  simplybook_booking_id: 'fldoaHHkcyTgwaLO0', // Original SimplyBook booking reference
  magic_link_token: 'fld8HA5AkDtuLhwpY', // Current magic link token
  token_expires_at: 'fld5H6xvoPPN9wuDz', // Token expiration datetime
  events: 'fldJeROezAUX6zfA7', // Text field for event IDs (booking_ids)
  created_at: 'fldmnLMTKXgQFLh1W', // When teacher was created
  linked_bookings: 'fldxukHyKQ4KEBDWv', // Linked records to bookings
} as const;

export const SONGS_FIELD_IDS = {
  title: 'fldLjwkTwckDqT3Xl', // Song title
  class_id: 'fldK4wCT5oKZDN6sE', // Links to class (class_id)
  event_id: 'fldCKN3IXHPczIWfs', // Links to event (booking_id)
  artist: 'fld8kOwPLIscK51yH', // Original artist
  notes: 'fldZRLk0JP05VRDm6', // Special notes/arrangement details
  order: 'fld2RSJGY8pAqBaej', // Position in class setlist
  created_by: 'fldva8udIq88Syq0p', // Teacher record ID who added it
  created_at: 'fldw9R07novjsrvE5', // When song was added
} as const;

export const AUDIO_FILES_FIELD_IDS = {
  filename: 'fldOTWiFz8G1lE04c', // Original filename
  class_id: 'fldAYW88oxtF5L5Bf', // Which class this audio is for
  event_id: 'fldwtYA1GwhVf3Ia7', // booking_id
  song_id: 'fldehSfLpy3iozdBt', // Optional link to song record
  type: 'fldOMmFN7BqHVAqfH', // raw | preview | final
  r2_key: 'fldvzj75CspwfOfPX', // Path in R2 storage
  uploaded_by: 'fldJw0CU9eu3TOAY5', // Staff/Engineer record ID
  uploaded_at: 'fldKm5SbhEVVuGcFO', // Upload timestamp
  duration_seconds: 'fldNzuiQghH3FhmdU', // Audio duration
  file_size_bytes: 'fldGo0LsZEcy9X9jx', // File size
  status: 'fldCAcEMu0IF1bWgz', // pending | processing | ready | error
} as const;

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * Teacher - School teacher who books events via SimplyBook
 * NOT the same as MiniMusiker staff (Personen table)
 */
export interface Teacher {
  id: string; // Airtable record ID
  email: string; // Primary identifier (from SimplyBook)
  name: string; // Contact person name
  phone?: string; // Phone number
  schoolName: string; // School name
  simplybookBookingId?: string; // Original SimplyBook booking reference
  magicLinkToken?: string; // Current magic link token (null if no active token)
  tokenExpiresAt?: string; // Token expiration (ISO datetime)
  eventIds?: string[]; // Array of booking_ids they manage
  createdAt: string; // When teacher was created
}

/**
 * Song - A song assigned to a class for performance
 * Each class can have multiple songs
 */
export interface Song {
  id: string; // Airtable record ID
  classId: string; // Links to class (class_id from parent_journey)
  eventId: string; // Links to event (booking_id)
  title: string; // Song title
  artist?: string; // Original artist
  notes?: string; // Special notes/arrangement details
  order: number; // Position in class setlist (1, 2, 3...)
  createdBy?: string; // Teacher record ID who added it
  createdAt: string; // When song was added
}

/**
 * Audio file types
 */
export type AudioFileType = 'raw' | 'preview' | 'final';

/**
 * Audio file status
 */
export type AudioFileStatus = 'pending' | 'processing' | 'ready' | 'error';

/**
 * AudioFile - Tracks audio files in R2 storage
 * Links to class and optionally to specific song
 */
export interface AudioFile {
  id: string; // Airtable record ID
  classId: string; // Which class this audio is for
  eventId: string; // booking_id
  songId?: string; // Optional link to song record
  type: AudioFileType; // raw | preview | final
  r2Key: string; // Path in R2 storage
  filename: string; // Original filename
  uploadedBy: string; // Staff/Engineer record ID
  uploadedAt: string; // Upload timestamp (ISO datetime)
  durationSeconds?: number; // Audio duration
  fileSizeBytes?: number; // File size
  status: AudioFileStatus; // pending | processing | ready | error
}

// =============================================================================
// TEACHER SESSION (for JWT authentication)
// =============================================================================

/**
 * Teacher session stored in JWT
 */
export interface TeacherSession {
  teacherId: string; // Airtable record ID
  email: string;
  name: string;
  schoolName: string;
  loginTimestamp: number; // Unix timestamp of login
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Request to send magic link
 */
export interface MagicLinkRequest {
  email: string;
}

/**
 * Request to verify magic link token
 */
export interface VerifyTokenRequest {
  token: string;
}

/**
 * Create/Update song request
 */
export interface UpsertSongRequest {
  title: string;
  artist?: string;
  notes?: string;
  order?: number;
}

/**
 * Create/Update class request (for teacher portal)
 */
export interface UpsertClassRequest {
  name: string; // Class name (e.g., "Year 3")
  numChildren?: number; // Number of children in class
}

/**
 * Teacher's view of their event
 */
export interface TeacherEventView {
  eventId: string; // booking_id
  schoolName: string;
  eventDate: string;
  eventType: string;
  classes: TeacherClassView[];
  status: 'upcoming' | 'in-progress' | 'completed';
}

/**
 * Teacher's view of a class within their event
 */
export interface TeacherClassView {
  classId: string;
  className: string;
  numChildren?: number;
  songs: Song[];
  audioStatus: {
    hasRawAudio: boolean;
    hasPreview: boolean;
    hasFinal: boolean;
  };
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Airtable record wrapper
 */
export interface AirtableTeacherRecord {
  id: string;
  fields: {
    [key: string]: string | number | boolean | string[] | null | undefined;
  };
  createdTime?: string;
}

/**
 * Airtable list response
 */
export interface AirtableTeacherListResponse {
  records: AirtableTeacherRecord[];
  offset?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Magic link token expiration time (24 hours in milliseconds)
 */
export const MAGIC_LINK_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Teacher session expiration time (7 days in seconds for JWT)
 */
export const TEACHER_SESSION_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

/**
 * Cookie name for teacher session
 */
export const TEACHER_SESSION_COOKIE = 'teacher_session';
