import { buildFinalMp3Key, buildPreviewMp3Key } from '@/lib/utils/audioPath';

describe('audioPath', () => {
  describe('buildFinalMp3Key', () => {
    it('returns per-song path with displayName when songId provided', () => {
      const key = buildFinalMp3Key(
        'evt_test_20260101_abc123',
        'cls_test_3a_abc',
        'recSongIdAbc',
        'Mein Lied - 3a'
      );
      expect(key).toBe(
        'recordings/evt_test_20260101_abc123/cls_test_3a_abc/recSongIdAbc/final/Mein Lied - 3a.mp3'
      );
    });

    it('falls back to "final.mp3" filename when no displayName', () => {
      const key = buildFinalMp3Key(
        'evt_test_20260101_abc123',
        'cls_test_3a_abc',
        'recSongIdAbc'
      );
      expect(key).toBe(
        'recordings/evt_test_20260101_abc123/cls_test_3a_abc/recSongIdAbc/final/final.mp3'
      );
    });

    it('returns schulsong canonical path when songId is null', () => {
      const key = buildFinalMp3Key(
        'evt_test_20260101_abc123',
        'cls_test_schulsong_abc',
        null
      );
      expect(key).toBe(
        'recordings/evt_test_20260101_abc123/cls_test_schulsong_abc/final.mp3'
      );
    });

    it('returns schulsong canonical path when songId is empty string', () => {
      const key = buildFinalMp3Key(
        'evt_test_20260101_abc123',
        'cls_test_schulsong_abc',
        ''
      );
      expect(key).toBe(
        'recordings/evt_test_20260101_abc123/cls_test_schulsong_abc/final.mp3'
      );
    });

    it('ignores displayName for schulsongs (canonical filename only)', () => {
      // Schulsong final.wav lives at recordings/{event}/{class}/final.wav,
      // so the MP3 must mirror that path — not append a displayName.
      const key = buildFinalMp3Key(
        'evt_test_20260101_abc123',
        'cls_test_schulsong_abc',
        null,
        'Some Display Name'
      );
      expect(key).toBe(
        'recordings/evt_test_20260101_abc123/cls_test_schulsong_abc/final.mp3'
      );
    });
  });

  describe('buildPreviewMp3Key', () => {
    it('returns per-song preview path with displayName when songId provided', () => {
      const key = buildPreviewMp3Key(
        'evt_test_20260101_abc123',
        'cls_test_3a_abc',
        'recSongIdAbc',
        'Mein Lied - 3a'
      );
      expect(key).toBe(
        'recordings/evt_test_20260101_abc123/cls_test_3a_abc/recSongIdAbc/preview/Mein Lied - 3a.mp3'
      );
    });

    it('falls back to "preview.mp3" filename when no displayName', () => {
      const key = buildPreviewMp3Key(
        'evt_test_20260101_abc123',
        'cls_test_3a_abc',
        'recSongIdAbc'
      );
      expect(key).toBe(
        'recordings/evt_test_20260101_abc123/cls_test_3a_abc/recSongIdAbc/preview/preview.mp3'
      );
    });

    it('returns schulsong canonical preview path when songId is null', () => {
      const key = buildPreviewMp3Key(
        'evt_test_20260101_abc123',
        'cls_test_schulsong_abc',
        null
      );
      expect(key).toBe(
        'recordings/evt_test_20260101_abc123/cls_test_schulsong_abc/preview.mp3'
      );
    });
  });
});
