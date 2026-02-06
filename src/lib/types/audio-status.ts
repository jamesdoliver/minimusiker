/**
 * Audio Status Types
 *
 * Types for the admin audio status section and approval workflow.
 */

/**
 * Approval status for individual tracks
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

/**
 * Admin approval status for the entire event
 */
export type AdminApprovalStatus = 'pending' | 'ready_for_approval' | 'approved';

/**
 * Information about a single track for approval
 */
export interface TrackApprovalInfo {
  audioFileId: string;
  songId: string;
  songTitle: string;
  className: string;
  classId: string;
  hasRawAudio: boolean;
  hasFinalAudio: boolean;
  approvalStatus: ApprovalStatus;
  rejectionComment?: string;
  finalAudioUrl?: string;
  finalAudioR2Key?: string;
  isSchulsong?: boolean;
  teacherApprovedAt?: string;
}

/**
 * Overall audio status data for an event
 */
export interface AudioStatusData {
  /** Number of songs expected (from Songs table) */
  expectedSongCount: number;
  /** Number of raw audio files uploaded by staff */
  staffUploadedCount: number;
  /** Number of final audio files uploaded by mix master */
  mixMasterUploadedCount: number;
  /** Whether all expected raw files have been uploaded */
  staffUploadComplete: boolean;
  /** Whether all expected final files have been uploaded */
  mixMasterUploadComplete: boolean;
  /** Overall approval status for the event */
  approvalStatus: AdminApprovalStatus;
  /** Whether all tracks have been approved */
  allTracksApproved: boolean;
  /** Detailed information about each track */
  tracks: TrackApprovalInfo[];
}

/**
 * Request body for approving/rejecting tracks
 */
export interface TrackApprovalRequest {
  audioFileId: string;
  status: 'approved' | 'rejected';
  comment?: string;
}

/**
 * Request body for the approve-tracks API endpoint
 */
export interface ApproveTracksRequest {
  trackApprovals: TrackApprovalRequest[];
}

/**
 * Response from the approve-tracks API endpoint
 */
export interface ApproveTracksResponse {
  success: boolean;
  allTracksApproved: boolean;
  adminApprovalStatus: AdminApprovalStatus;
  updatedTracks: {
    audioFileId: string;
    approvalStatus: ApprovalStatus;
  }[];
}
