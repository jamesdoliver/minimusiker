// Engineer Portal Type Definitions
// For audio engineers who mix raw recordings into final/preview versions

import { AudioFile } from './teacher';

// =============================================================================
// ENGINEER SESSION (for JWT authentication)
// =============================================================================

/**
 * Engineer session stored in JWT
 * Extends staff session with engineer-specific data
 */
export interface EngineerSession {
  engineerId: string; // Airtable record ID from Personen table
  email: string;
  name: string;
  loginTimestamp: number; // Unix timestamp of login
}

// =============================================================================
// EVENT/CLASS VIEWS FOR ENGINEER PORTAL
// =============================================================================

/**
 * Summary of an event assigned to an engineer
 * Used for the engineer dashboard list view
 */
export interface EngineerEventSummary {
  eventId: string; // booking_id
  schoolName: string;
  eventDate: string;
  eventType: string;
  classCount: number;
  rawAudioCount: number;
  hasPreview: boolean;
  hasFinal: boolean;
  mixingStatus: EngineerMixingStatus;
}

/**
 * Mixing status for an event
 */
export type EngineerMixingStatus = 'pending' | 'in-progress' | 'completed';

/**
 * Audio file with signed URL for download/playback
 */
export interface AudioFileWithUrl extends AudioFile {
  signedUrl?: string | null;
}

/**
 * Class view for engineer event detail page
 * Includes all audio files (raw, preview, final) with URLs
 */
export interface EngineerClassView {
  classId: string;
  className: string;
  rawFiles: AudioFileWithUrl[];
  previewFile?: AudioFileWithUrl;
  finalFile?: AudioFileWithUrl;
}

/**
 * Full event detail for engineer event page
 */
export interface EngineerEventDetail {
  eventId: string;
  schoolName: string;
  eventDate: string;
  eventType: string;
  classes: EngineerClassView[];
  mixingStatus: EngineerMixingStatus;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Engineer login request
 */
export interface EngineerLoginRequest {
  email: string;
  password: string; // Numeric ID from Personen table
}

/**
 * Request to upload mixed audio (preview or final)
 */
export interface UploadMixedRequest {
  classId: string;
  filename: string;
  type: 'preview' | 'final';
  contentType?: string;
}

/**
 * Response from upload URL generation
 */
export interface UploadMixedUrlResponse {
  uploadUrl: string;
  r2Key: string;
}

/**
 * Request to confirm mixed audio upload
 */
export interface ConfirmMixedUploadRequest {
  classId: string;
  r2Key: string;
  filename: string;
  type: 'preview' | 'final';
  fileSizeBytes?: number;
  durationSeconds?: number;
}

/**
 * ZIP download options
 */
export interface ZipDownloadOptions {
  classId?: string; // If specified, only include files from this class
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Engineer session expiration time (24 hours in seconds for JWT)
 */
export const ENGINEER_SESSION_EXPIRY_SECONDS = 24 * 60 * 60;

/**
 * Cookie name for engineer session
 */
export const ENGINEER_SESSION_COOKIE = 'engineer_session';
