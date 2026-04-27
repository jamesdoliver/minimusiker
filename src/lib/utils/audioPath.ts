/**
 * Canonical R2 key paths for processed audio.
 *
 * Two shapes exist:
 *   - Per-song:  recordings/{eventId}/{classId}/{songId}/{kind}/{filename}.mp3
 *   - Schulsong: recordings/{eventId}/{classId}/{kind}.mp3   (no songId, no subfolder)
 *
 * Schulsong WAVs already live at recordings/{eventId}/{classId}/final.wav,
 * so the MP3 derivative mirrors that path.
 */

export function buildFinalMp3Key(
  eventId: string,
  classId: string,
  songId: string | null,
  displayName?: string
): string {
  if (songId) {
    const filename = displayName ? `${displayName}.mp3` : 'final.mp3';
    return `recordings/${eventId}/${classId}/${songId}/final/${filename}`;
  }
  return `recordings/${eventId}/${classId}/final.mp3`;
}

export function buildPreviewMp3Key(
  eventId: string,
  classId: string,
  songId: string | null,
  displayName?: string
): string {
  if (songId) {
    const filename = displayName ? `${displayName}.mp3` : 'preview.mp3';
    return `recordings/${eventId}/${classId}/${songId}/preview/${filename}`;
  }
  return `recordings/${eventId}/${classId}/preview.mp3`;
}
