/**
 * Engineer Configuration
 *
 * Maps engineer roles to their Personen table record IDs.
 * - Micha: Handles schulsong tracks
 * - Jakob: Handles regular (non-schulsong) tracks
 */

export const ENGINEER_IDS = {
  /** Micha - assigned to schulsong tracks */
  MICHA: process.env.ENGINEER_MICHA_ID || '',
  /** Jakob - assigned to regular tracks */
  JAKOB: process.env.ENGINEER_JAKOB_ID || '',
} as const;

/**
 * Get the appropriate engineer ID based on whether the track is a schulsong
 */
export function getEngineerIdForTrack(isSchulsong: boolean): string {
  return isSchulsong ? ENGINEER_IDS.MICHA : ENGINEER_IDS.JAKOB;
}
