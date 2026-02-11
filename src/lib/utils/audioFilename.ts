/** Sanitize text for safe use in R2 keys and filenames. Preserves umlauts. */
export function sanitizeForFilename(text: string): string {
  return text
    .trim()
    .replace(/[/\\:*?"<>|#%&{}$!@+`=]/g, '_')
    .replace(/\s+/g, ' ')
    .substring(0, 100);
}

/** Generate "{SongTitle} - {ClassName}" (without extension, so callers append .wav / .mp3). */
export function generateAudioDisplayName(songTitle: string, className: string): string {
  const title = sanitizeForFilename(songTitle) || 'Untitled';
  const cls = sanitizeForFilename(className) || 'Unknown';
  return `${title} - ${cls}`;
}
