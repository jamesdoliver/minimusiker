// src/lib/services/masterCdService.ts

/**
 * Master CD Service
 *
 * Provides tracklist data for the Master CD task completion UI.
 * Fetches songs, audio files, and class names for an event,
 * assembles them into a structured tracklist sorted by album_order,
 * and generates signed R2 download URLs for ready tracks.
 */

import { getTeacherService } from './teacherService';
import { getAirtableService } from './airtableService';
import { getR2Service } from './r2Service';
import type { Song, AudioFile } from '@/lib/types/teacher';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MasterCdTrack {
  trackNumber: number;          // From album_order
  songId: string;               // Songs table record ID
  title: string;                // Songs.title
  className: string;            // From linked Classes table
  audioFileId?: string;         // AudioFiles record ID
  r2Key?: string;               // AudioFiles.r2_key
  durationSeconds?: number;     // AudioFiles.duration_seconds
  status: 'ready' | 'pending' | 'processing' | 'error' | 'missing';
  downloadUrl?: string;         // Signed R2 URL
}

export interface MasterCdData {
  eventId: string;
  schoolName: string;
  tracks: MasterCdTrack[];
  allReady: boolean;            // True only if ALL tracks have status 'ready'
  readyCount: number;
  totalCount: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class MasterCdService {
  private teacherService = getTeacherService();
  private airtable = getAirtableService();
  private r2 = getR2Service();

  /**
   * Get the full tracklist for a Master CD, including audio status for each track.
   *
   * Data flow:
   * 1. Fetch songs via TeacherService.getSongsByEventId()
   * 2. Sort songs by album_order
   * 3. Fetch audio files via TeacherService.getAudioFilesByEventId()
   * 4. Match final audio files to songs via song_id
   * 5. Determine status per track
   * 6. Fetch event details (school_name)
   * 7. Get class names from getAlbumTracksData (reuses existing class lookup)
   * 8. Build MasterCdData
   */
  async getTracklist(eventId: string): Promise<MasterCdData> {
    // 1. Fetch songs for the event, excluding songs removed from album (albumOrder === 0)
    const allSongs = await this.teacherService.getSongsByEventId(eventId, { excludeHidden: true });
    const songs = allSongs.filter((s) => s.albumOrder !== 0);

    // 2. Sort by album_order (fallback to song order, then index)
    const sortedSongs = [...songs].sort((a, b) => {
      const orderA = a.albumOrder ?? a.order ?? 999;
      const orderB = b.albumOrder ?? b.order ?? 999;
      return orderA - orderB;
    });

    // 3. Fetch audio files for the event
    const audioFiles = await this.teacherService.getAudioFilesByEventId(eventId);

    // 4. Filter to only final audio files and index by song_id
    const finalAudioBySongId = new Map<string, AudioFile>();
    for (const af of audioFiles) {
      if (af.type === 'final' && af.songId) {
        // If multiple finals exist for the same song, prefer 'ready' ones
        const existing = finalAudioBySongId.get(af.songId);
        if (!existing || (af.status === 'ready' && existing.status !== 'ready')) {
          finalAudioBySongId.set(af.songId, af);
        }
      }
    }

    // 5-7. Get class names via getAlbumTracksData (reuses the full class/group lookup)
    const albumTracks = await this.teacherService.getAlbumTracksData(eventId);
    const classNameBySongId = new Map<string, string>();
    for (const at of albumTracks) {
      classNameBySongId.set(at.songId, at.className);
    }

    // 8. Fetch event details for school_name
    const event = await this.airtable.getEventByEventId(eventId);
    const schoolName = event?.school_name ?? 'Unknown School';

    // 9. Build tracks array
    const tracks: MasterCdTrack[] = sortedSongs.map((song: Song, index: number) => {
      const finalAudio = finalAudioBySongId.get(song.id);
      const className = classNameBySongId.get(song.id) ?? 'Unknown';

      let status: MasterCdTrack['status'];
      if (finalAudio) {
        status = finalAudio.status as MasterCdTrack['status'];
        // Ensure we only use known statuses
        if (!['ready', 'pending', 'processing', 'error'].includes(status)) {
          status = 'pending';
        }
      } else {
        status = 'missing';
      }

      return {
        trackNumber: song.albumOrder ?? index + 1,
        songId: song.id,
        title: song.title,
        className,
        audioFileId: finalAudio?.id,
        r2Key: finalAudio?.r2Key,
        durationSeconds: finalAudio?.durationSeconds,
        status,
      };
    });

    // Re-sort and renumber by trackNumber to ensure sequential
    tracks.sort((a, b) => a.trackNumber - b.trackNumber);
    tracks.forEach((track, idx) => {
      track.trackNumber = idx + 1;
    });

    const readyCount = tracks.filter((t) => t.status === 'ready').length;

    return {
      eventId,
      schoolName,
      tracks,
      allReady: tracks.length > 0 && readyCount === tracks.length,
      readyCount,
      totalCount: tracks.length,
    };
  }

  /**
   * Get signed R2 download URLs for all ready tracks.
   *
   * Returns an array of { trackNumber, filename, url } for tracks
   * with status 'ready'. The filename follows the format:
   *   "{trackNumber}. {title} - {className}.mp3"
   */
  async getDownloadUrls(
    eventId: string
  ): Promise<Array<{ trackNumber: number; filename: string; url: string }>> {
    const tracklist = await this.getTracklist(eventId);

    // Fetch audio files to access mp3R2Key for WAV→MP3 preference
    const audioFiles = await this.teacherService.getAudioFilesByEventId(eventId);
    const finalAudioBySongId = new Map<string, AudioFile>();
    for (const af of audioFiles) {
      if (af.type === 'final' && af.songId) {
        const existing = finalAudioBySongId.get(af.songId);
        if (!existing || (af.status === 'ready' && existing.status !== 'ready')) {
          finalAudioBySongId.set(af.songId, af);
        }
      }
    }

    const downloads: Array<{ trackNumber: number; filename: string; url: string }> = [];

    for (const track of tracklist.tracks) {
      if (track.status !== 'ready' || !track.r2Key) {
        continue;
      }

      // Prefer MP3 version if available, fall back to primary r2Key (may be WAV)
      const audioFile = finalAudioBySongId.get(track.songId);
      const downloadKey = audioFile?.mp3R2Key || track.r2Key;
      const isMp3 = downloadKey.toLowerCase().endsWith('.mp3') || !!audioFile?.mp3R2Key;
      const ext = isMp3 ? 'mp3' : 'wav';
      const padded = String(track.trackNumber).padStart(2, '0');
      const filename = `${padded}. ${track.title} - ${track.className}.${ext}`;

      const url = await this.r2.generateSignedUrl(downloadKey, 3600, filename);

      downloads.push({
        trackNumber: track.trackNumber,
        filename,
        url,
      });
    }

    return downloads;
  }

  /**
   * Check if all tracks are ready for the Master CD.
   * Returns true only if every track has status 'ready'.
   */
  async canComplete(eventId: string): Promise<boolean> {
    const tracklist = await this.getTracklist(eventId);
    return tracklist.allReady;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let masterCdServiceInstance: MasterCdService | null = null;

export function getMasterCdService(): MasterCdService {
  if (!masterCdServiceInstance) {
    masterCdServiceInstance = new MasterCdService();
  }
  return masterCdServiceInstance;
}
