import { isReadyEligible, assertReadyEligible } from '@/lib/utils/audioFileInvariants';

describe('audioFileInvariants', () => {
  describe('isReadyEligible', () => {
    it('returns true when r2Key is .mp3 (no conversion needed)', () => {
      expect(isReadyEligible({ r2Key: 'recordings/foo/bar.mp3', mp3R2Key: null })).toBe(true);
    });

    it('returns true when r2Key is .wav AND mp3R2Key is set', () => {
      expect(
        isReadyEligible({ r2Key: 'recordings/foo/bar.wav', mp3R2Key: 'recordings/foo/bar.mp3' })
      ).toBe(true);
    });

    it('returns false when r2Key is .wav AND mp3R2Key is null', () => {
      expect(isReadyEligible({ r2Key: 'recordings/foo/bar.wav', mp3R2Key: null })).toBe(false);
    });

    it('returns false when r2Key is .wav AND mp3R2Key is empty string', () => {
      expect(isReadyEligible({ r2Key: 'recordings/foo/bar.wav', mp3R2Key: '' })).toBe(false);
    });

    it('returns false when r2Key is .wav AND mp3R2Key is undefined', () => {
      expect(isReadyEligible({ r2Key: 'recordings/foo/bar.wav' })).toBe(false);
    });

    it('handles uppercase WAV extension (case-insensitive)', () => {
      expect(isReadyEligible({ r2Key: 'recordings/foo/bar.WAV', mp3R2Key: null })).toBe(false);
    });

    it('handles uppercase MP3 extension (case-insensitive)', () => {
      expect(isReadyEligible({ r2Key: 'recordings/foo/bar.MP3', mp3R2Key: null })).toBe(true);
    });
  });

  describe('assertReadyEligible', () => {
    it('does not throw when eligible', () => {
      expect(() =>
        assertReadyEligible({ r2Key: 'recordings/foo/bar.wav', mp3R2Key: 'recordings/foo/bar.mp3' })
      ).not.toThrow();
    });

    it('throws with descriptive message when not eligible', () => {
      expect(() =>
        assertReadyEligible({ r2Key: 'recordings/foo/bar.wav', mp3R2Key: null })
      ).toThrow(/Cannot mark AudioFile as 'ready'/);
    });
  });
});
