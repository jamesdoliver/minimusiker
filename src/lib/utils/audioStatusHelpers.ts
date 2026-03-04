import { AudioStage, AudioStatusSummary, AudioStatusData } from '@/lib/types/audio-status';

/**
 * Derive the highest audio stage from simple boolean flags
 * (used by collection/group audioStatus objects)
 */
export function deriveStageFromSimple(status: {
  hasRawAudio: boolean;
  hasPreview: boolean;
  hasFinal: boolean;
}): AudioStage {
  if (status.hasFinal) return 'final';
  if (status.hasPreview) return 'preview';
  if (status.hasRawAudio) return 'raw';
  return 'none';
}

/**
 * Derive a full AudioStatusSummary from the rich AudioStatusData
 * (used by admin bookings which have per-track detail)
 */
export function deriveSummaryFromRich(data: AudioStatusData): AudioStatusSummary {
  const tracks = data.tracks;
  const total = tracks.length;

  const approved = tracks.filter((t) => t.approvalStatus === 'approved').length;
  const final = tracks.filter((t) => t.hasFinalAudio).length;
  const raw = tracks.filter((t) => t.hasRawAudio).length;
  // Preview count: use mixMasterUploadedCount from the aggregate data
  const preview = data.mixMasterUploadedCount;

  let stage: AudioStage = 'none';
  if (approved > 0 && approved === total) {
    stage = 'approved';
  } else if (final > 0) {
    stage = 'final';
  } else if (preview > 0) {
    stage = 'preview';
  } else if (raw > 0) {
    stage = 'raw';
  }

  return {
    stage,
    counts: { total, raw, preview, final, approved },
    audioHidden: data.audioHidden,
  };
}
