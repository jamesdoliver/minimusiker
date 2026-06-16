/**
 * Pure decision helpers for the parent audio download gate
 * (src/app/api/parent/audio-access/route.ts).
 *
 * These are deliberately dependency-free so the gate logic can be unit-tested
 * without mocking Airtable / R2 / sessions.
 */

/**
 * Does this event grant audio downloads to every parent without a Minicard purchase?
 *
 * Driven by the dedicated `audio_free_without_purchase` Events checkbox. The default
 * (unchecked) state is the SAFE one: purchase required. Airtable omits unchecked
 * checkbox fields from a record, so the field arrives `undefined` for any event where
 * an admin never ticked it — and `undefined === true` is `false`, i.e. fail-closed.
 *
 * Must stay a strict `=== true` check: a truthiness test (`!!x` / `x != null`) would
 * re-introduce the exact "unconfigured event gives audio away" bug this replaced, and
 * would wrongly grant access if the value ever arrived as a non-empty string.
 */
export function resolveAudioFreeForAll(
  event: { audio_free_without_purchase?: boolean } | null | undefined
): boolean {
  return event?.audio_free_without_purchase === true;
}

/**
 * Should the route emit full (downloadable) audio URLs?
 *
 * Audio is downloadable when the parent has access (either the event is explicitly
 * free-for-all OR the parent bought a Minicard) AND the release window has passed.
 * `isReleased` already folds in the time gate, the audio_hidden kill-switch, and the
 * schulsong gate, so this helper only combines the access axis with release.
 */
export function shouldEmitDownloads(
  audioFreeForAll: boolean,
  hasMinicard: boolean,
  isReleased: boolean
): boolean {
  return (audioFreeForAll || hasMinicard) && isReleased;
}
