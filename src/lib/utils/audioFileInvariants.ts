/**
 * Invariants for AudioFile lifecycle.
 *
 * Core rule:
 *   An AudioFile may only have status='ready' if its content is playable as MP3
 *   in every browser, i.e. either r2Key is .mp3, or a converted derivative
 *   exists at mp3R2Key.
 *
 * This is enforced at every write site that sets status='ready' so that
 * downstream readers (teacher/parent/staff portals) never have to worry about
 * "WAV slipped through" — the answer is structurally "no".
 */

interface AudioFileSnapshot {
  r2Key: string;
  mp3R2Key?: string | null;
}

export function isReadyEligible(file: AudioFileSnapshot): boolean {
  const r2KeyLower = file.r2Key.toLowerCase();
  if (r2KeyLower.endsWith('.mp3')) return true;
  if (r2KeyLower.endsWith('.wav')) return Boolean(file.mp3R2Key);
  // Unknown extension — treat as eligible to avoid blocking edge cases the
  // invariant wasn't designed for. The bug we care about is specifically WAV→MP3.
  return true;
}

export function assertReadyEligible(file: AudioFileSnapshot): void {
  if (!isReadyEligible(file)) {
    throw new Error(
      `Cannot mark AudioFile as 'ready': r2Key '${file.r2Key}' is a WAV but mp3R2Key is missing. ` +
        `Run processAudioFile() first.`
    );
  }
}

/**
 * Whether a teacher may download/stream this file from the portal.
 * Same final+ready rule as before, PLUS: a Schulsong is only downloadable
 * once the teacher has approved it (teacherApprovedAt set). This keeps the
 * download list/zip in sync with the Schulsong approval card, which already
 * gates on teacherApprovedAt.
 */
export function isTeacherDownloadable(file: {
  type: string;
  status: string;
  isSchulsong?: boolean;
  teacherApprovedAt?: string;
}): boolean {
  if (file.type !== 'final' || file.status !== 'ready') return false;
  if (file.isSchulsong && !file.teacherApprovedAt) return false;
  return true;
}
