// Pure-helper tests for the parent audio download gate. The helper module imports
// nothing heavy (no airtableService), so no Airtable mock is needed here.
//
// These encode the revenue-leak regression directly: an event with the
// audio_free_without_purchase checkbox UNSET (Airtable omits unchecked checkboxes,
// so the field arrives undefined) must NOT grant free downloads — purchase required.
import { resolveAudioFreeForAll, shouldEmitDownloads } from '@/lib/utils/audioAccessGate';

describe('resolveAudioFreeForAll', () => {
  it('returns false when the flag is absent (unticked checkbox => undefined) — the leak guard', () => {
    expect(resolveAudioFreeForAll({})).toBe(false);
  });

  it('returns false for null / undefined event (lookup miss => fail-closed)', () => {
    expect(resolveAudioFreeForAll(null)).toBe(false);
    expect(resolveAudioFreeForAll(undefined)).toBe(false);
  });

  it('returns true only when explicitly checked (=== true)', () => {
    expect(resolveAudioFreeForAll({ audio_free_without_purchase: true })).toBe(true);
  });

  it('returns false for any non-true value (no truthiness footgun)', () => {
    expect(resolveAudioFreeForAll({ audio_free_without_purchase: false })).toBe(false);
    // A defensive guard against a stray non-boolean ever arriving from upstream.
    expect(resolveAudioFreeForAll({ audio_free_without_purchase: undefined })).toBe(false);
  });
});

describe('shouldEmitDownloads', () => {
  it('blocks downloads for an unconfigured event after release with no purchase (the bug)', () => {
    // audioFreeForAll=false (no flag), hasMinicard=false (no purchase), isReleased=true
    expect(shouldEmitDownloads(false, false, true)).toBe(false);
  });

  it('grants downloads when audio is explicitly free-for-all and released', () => {
    expect(shouldEmitDownloads(true, false, true)).toBe(true);
  });

  it('grants downloads to a real Minicard purchaser even when not free-for-all', () => {
    expect(shouldEmitDownloads(false, true, true)).toBe(true);
  });

  it('blocks downloads before release even when free-for-all or purchased', () => {
    expect(shouldEmitDownloads(true, true, false)).toBe(false);
    expect(shouldEmitDownloads(true, false, false)).toBe(false);
    expect(shouldEmitDownloads(false, true, false)).toBe(false);
  });

  it('blocks downloads when nothing applies', () => {
    expect(shouldEmitDownloads(false, false, false)).toBe(false);
  });
});
