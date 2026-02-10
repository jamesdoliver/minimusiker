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
 * Per-song audio files for engineer view
 */
export interface EngineerSongView {
  songId: string;
  songTitle: string;
  artist?: string;
  order: number;
  previewFile?: AudioFileWithUrl;
  finalMp3File?: AudioFileWithUrl;
  finalWavFile?: AudioFileWithUrl;
}

/**
 * Class view for engineer event detail page
 * Songs nested under each class, each with its own upload slots
 */
export interface EngineerClassView {
  classId: string;
  className: string;
  songs: EngineerSongView[];
  rawFiles: AudioFileWithUrl[];  // Legacy files without songId
  // Class-level fields used only by schulsong dedicated section
  previewFile?: AudioFileWithUrl;
  finalMp3File?: AudioFileWithUrl;
  finalWavFile?: AudioFileWithUrl;
}

/**
 * Full event detail for engineer event page
 */
export interface LogicProjectInfo {
  projectType: 'schulsong' | 'minimusiker';
  filename: string;
  fileSizeBytes?: number;
  uploadedAt?: string;
}

export interface EngineerEventDetail {
  eventId: string;
  schoolName: string;
  eventDate: string;
  eventType: string;
  classes: EngineerClassView[];
  mixingStatus: EngineerMixingStatus;
  isSchulsong?: boolean;
  schulsongClass?: EngineerClassView;
  audioPipelineStage?: 'not_started' | 'in_progress' | 'ready_for_review' | 'approved';
  logicProjects?: LogicProjectInfo[];
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
  songId?: string;
  filename: string;
  type: 'preview' | 'final';
  contentType?: string;
  format?: 'mp3' | 'wav';
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
  songId?: string;
  r2Key: string;
  filename: string;
  type: 'preview' | 'final';
  fileSizeBytes?: number;
  durationSeconds?: number;
  isSchulsong?: boolean;
  format?: 'mp3' | 'wav';
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
