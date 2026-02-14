import { NextRequest, NextResponse } from 'next/server';
import { verifyParentSession } from '@/lib/auth/verifyParentSession';
import { hasMinicardForEvent } from '@/lib/utils/minicardAccess';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';
import { parseOverrides, getThreshold } from '@/lib/utils/eventThresholds';
import type { Song, AudioFile } from '@/lib/types/teacher';

export const dynamic = 'force-dynamic';

// Types for the allAudio response
interface AllAudioResponse {
  parentClassId: string;
  sections: AudioSection[];
  totalTracks: number;
  totalSizeBytes: number;
}

interface AudioSection {
  sectionId: string;
  sectionName: string;
  sectionType: 'class' | 'choir' | 'teacher_song' | 'group';
  memberClasses?: Array<{ classId: string; className: string }>;
  tracks: TrackEntry[];
}

interface TrackEntry {
  songId?: string;
  title: string;
  artist?: string;
  order: number;
  durationSeconds?: number;
  fileSizeBytes?: number;
  audioUrl: string;
  downloadUrl: string;
  filename: string;
}

/**
 * GET /api/parent/audio-access
 *
 * Unified audio access endpoint for the parent portal.
 * Determines what audio content a parent can access based on:
 * - Time since event: +7 days = previews available, +14 days = fully released
 * - Whether the parent has purchased a Minicard for this event
 *
 * Non-buyers: only receive preview snippet URL (never the full file)
 * Minicard buyers (after release): receive full file URLs + collections + groups
 */
export async function GET(request: NextRequest) {
  try {
    const session = verifyParentSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const classId = searchParams.get('classId');

    if (!eventId || !classId) {
      return NextResponse.json(
        { error: 'eventId and classId are required' },
        { status: 400 }
      );
    }

    // Validate parent has access to this event
    const hasAccess = session.children?.some(
      (child) => child.eventId === eventId || child.bookingId === eventId
    );
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this event' },
        { status: 403 }
      );
    }

    const airtableService = getAirtableService();
    const teacherService = getTeacherService();
    const r2 = getR2Service();

    // 1. Check release timing (purely time-based, with per-event overrides)
    const event = await airtableService.getEventByEventId(eventId);
    const eventDate = event?.event_date ? new Date(event.event_date) : null;
    const overrides = parseOverrides(event?.timeline_overrides);
    const previewDays = getThreshold('preview_available_days', overrides);
    const releaseDays = getThreshold('full_release_days', overrides);

    const previewDate = eventDate ? new Date(eventDate) : null;
    if (previewDate) previewDate.setDate(previewDate.getDate() + previewDays);

    const releaseDate = eventDate ? new Date(eventDate) : null;
    if (releaseDate) releaseDate.setDate(releaseDate.getDate() + releaseDays);

    const now = new Date();

    // Audio visibility kill-switch: stored in timeline_overrides.audio_hidden.
    // Default (absent) = visible. Admin can toggle audio_hidden=true to block parent access.
    const audioHidden = overrides?.audio_hidden === true;

    const hasPreviewsAvailable = previewDate ? now >= previewDate && !audioHidden : false;
    const isReleased = releaseDate ? now >= releaseDate && !audioHidden : false;

    // 2. Check minicard purchase status
    const hasMinicard = await hasMinicardForEvent(session.parentId, eventId);

    // 3. Build class preview info (always included when audio exists)
    const classPreview = await buildClassPreview(r2, teacherService, eventId, classId);

    // 4. Build response based on access level
    const response: Record<string, unknown> = {
      success: true,
      hasMinicard,
      isReleased,
      hasPreviewsAvailable,
      classPreview,
      releaseDate: previewDate ? previewDate.toISOString() : undefined,
    };

    // Only include full content when minicard buyer AND released
    if (hasMinicard && isReleased) {
      // All audio tracklist (new unified approach)
      const allAudio = await buildAllAudio(r2, teacherService, airtableService, eventId, classId);
      if (allAudio) {
        response.allAudio = allAudio;
      }

      // Full class audio (kept for backward compatibility)
      const classFull = await buildClassFull(r2, teacherService, eventId, classId);
      if (classFull) {
        response.classFull = classFull;
      }

      // Collections (choir + teacher songs)
      const collections = await teacherService.getCollectionsForEvent(eventId);
      const collectionsWithAudio = [];
      for (const collection of collections) {
        const collectionAudio = await buildCollectionAudio(r2, teacherService, eventId, collection.classId);
        collectionsWithAudio.push({
          classId: collection.classId,
          name: collection.className,
          type: collection.classType,
          songs: collection.songs.map(s => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
          })),
          ...collectionAudio,
        });
      }
      if (collectionsWithAudio.length > 0) {
        response.collections = collectionsWithAudio;
      }

      // Groups
      try {
        const groupsResponse = await teacherService.getGroupsForClass(classId);
        const groupsWithAudio = [];
        for (const group of groupsResponse) {
          const groupAudio = await buildGroupAudio(r2, eventId, group.groupId);
          groupsWithAudio.push({
            groupId: group.groupId,
            groupName: group.groupName,
            memberClasses: group.memberClasses?.map(c => ({
              classId: c.classId,
              className: c.className,
            })) || [],
            ...groupAudio,
          });
        }
        if (groupsWithAudio.length > 0) {
          response.groups = groupsWithAudio;
        }
      } catch {
        // Groups are optional, don't fail the whole request
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in audio-access:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check audio access' },
      { status: 500 }
    );
  }
}

/**
 * Build preview info for a class (always returns preview snippet URL if available)
 */
async function buildClassPreview(
  r2: ReturnType<typeof getR2Service>,
  teacherService: ReturnType<typeof getTeacherService>,
  eventId: string,
  classId: string
): Promise<{ hasAudio: boolean; previewUrl?: string }> {
  // Look for song-level audio files with preview keys
  const audioFiles = await teacherService.getAudioFilesByClassId(classId);
  const finalFiles = audioFiles.filter(af => af.type === 'final' && af.status === 'ready');

  // Try to find a preview file
  for (const af of finalFiles) {
    if (af.previewR2Key) {
      try {
        const previewUrl = await r2.generateSignedUrl(af.previewR2Key, 1800); // 30 min
        return { hasAudio: true, previewUrl };
      } catch {
        // Key doesn't exist yet, continue
      }
    }

    // Also check the standard preview path
    const songId = af.songId;
    if (songId) {
      const previewKey = `recordings/${eventId}/${classId}/${songId}/preview/preview.mp3`;
      if (await r2.fileExists(previewKey)) {
        const previewUrl = await r2.generateSignedUrl(previewKey, 1800);
        return { hasAudio: true, previewUrl };
      }
    }
  }

  // Fallback: check legacy preview paths
  const legacyPreviewUrl = await r2.getRecordingUrlWithFallback(eventId, 'preview', classId);
  if (legacyPreviewUrl) {
    return { hasAudio: true, previewUrl: legacyPreviewUrl };
  }

  // Check if there are any final audio files at all (without preview)
  if (finalFiles.length > 0) {
    return { hasAudio: true };
  }

  return { hasAudio: false };
}

/**
 * Build full audio URLs for a class (only for minicard buyers after release)
 */
async function buildClassFull(
  r2: ReturnType<typeof getR2Service>,
  teacherService: ReturnType<typeof getTeacherService>,
  eventId: string,
  classId: string
): Promise<{ audioUrl: string; downloadUrl: string } | null> {
  const audioFiles = await teacherService.getAudioFilesByClassId(classId);
  const finalFiles = audioFiles.filter(af => af.type === 'final' && af.status === 'ready');

  // Try MP3 key first, then original r2Key
  for (const af of finalFiles) {
    const mp3Key = af.mp3R2Key;
    if (mp3Key && await r2.fileExists(mp3Key)) {
      const downloadFilename = mp3Key.split('/').pop() || 'audio.mp3';
      const audioUrl = await r2.generateSignedUrl(mp3Key, 3600); // 1 hour, streaming
      const downloadUrl = await r2.generateSignedUrl(mp3Key, 86400, downloadFilename); // 24 hours, download
      return { audioUrl, downloadUrl };
    }

    // Check the canonical final.mp3 path
    if (af.songId) {
      const canonicalKey = `recordings/${eventId}/${classId}/${af.songId}/final/final.mp3`;
      if (await r2.fileExists(canonicalKey)) {
        const audioUrl = await r2.generateSignedUrl(canonicalKey, 3600);
        const downloadUrl = await r2.generateSignedUrl(canonicalKey, 86400, 'final.mp3');
        return { audioUrl, downloadUrl };
      }
    }

    // Fall back to original r2Key
    if (af.r2Key && await r2.fileExists(af.r2Key)) {
      const downloadFilename = af.r2Key.split('/').pop() || 'audio.mp3';
      const audioUrl = await r2.generateSignedUrl(af.r2Key, 3600);
      const downloadUrl = await r2.generateSignedUrl(af.r2Key, 86400, downloadFilename);
      return { audioUrl, downloadUrl };
    }
  }

  // Legacy fallback: check old paths
  const isR2Enabled = process.env.ENABLE_DIGITAL_DELIVERY === 'true';
  if (isR2Enabled) {
    const recordingsKey = `recordings/${eventId}/${classId}/final.mp3`;
    if (await r2.fileExists(recordingsKey)) {
      const audioUrl = await r2.generateSignedUrl(recordingsKey, 3600);
      const downloadUrl = await r2.generateSignedUrl(recordingsKey, 86400, 'final.mp3');
      return { audioUrl, downloadUrl };
    }

    const legacyKey = `events/${eventId}/${classId}/full.mp3`;
    if (await r2.fileExists(legacyKey)) {
      const audioUrl = await r2.generateSignedUrl(legacyKey, 3600);
      const downloadUrl = await r2.generateSignedUrl(legacyKey, 86400, 'full.mp3');
      return { audioUrl, downloadUrl };
    }
  }

  return null;
}

/**
 * Build audio URLs for a collection (choir/teacher song)
 */
async function buildCollectionAudio(
  r2: ReturnType<typeof getR2Service>,
  teacherService: ReturnType<typeof getTeacherService>,
  eventId: string,
  collectionClassId: string
): Promise<{ audioUrl?: string; downloadUrl?: string }> {
  const result = await buildClassFull(r2, teacherService, eventId, collectionClassId);
  if (result) {
    return { audioUrl: result.audioUrl, downloadUrl: result.downloadUrl };
  }
  return {};
}

/**
 * Build audio URLs for a group
 */
async function buildGroupAudio(
  r2: ReturnType<typeof getR2Service>,
  eventId: string,
  groupId: string
): Promise<{ audioUrl?: string; downloadUrl?: string }> {
  // Check common paths for group audio
  const paths = [
    `recordings/${eventId}/${groupId}/final.mp3`,
    `events/${eventId}/${groupId}/full.mp3`,
  ];

  for (const key of paths) {
    if (await r2.fileExists(key)) {
      const downloadFilename = key.split('/').pop() || 'audio.mp3';
      const audioUrl = await r2.generateSignedUrl(key, 3600);
      const downloadUrl = await r2.generateSignedUrl(key, 86400, downloadFilename);
      return { audioUrl, downloadUrl };
    }
  }

  return {};
}

/**
 * Resolve the best available R2 key for an audio file.
 * Checks in order: mp3R2Key → canonical final path → r2Key
 */
async function resolveAudioFileUrl(
  r2: ReturnType<typeof getR2Service>,
  af: AudioFile,
  eventId: string,
  classId: string
): Promise<string | null> {
  // 1. Processed MP3
  if (af.mp3R2Key && await r2.fileExists(af.mp3R2Key)) {
    return af.mp3R2Key;
  }

  // 2. Canonical path
  if (af.songId) {
    const canonicalKey = `recordings/${eventId}/${classId}/${af.songId}/final/final.mp3`;
    if (await r2.fileExists(canonicalKey)) {
      return canonicalKey;
    }
  }

  // 3. Original upload
  if (af.r2Key && await r2.fileExists(af.r2Key)) {
    return af.r2Key;
  }

  return null;
}

/**
 * Build the full all-audio tracklist for an event.
 * Returns every class, collection, and group with per-song streaming/download URLs.
 */
async function buildAllAudio(
  r2: ReturnType<typeof getR2Service>,
  teacherService: ReturnType<typeof getTeacherService>,
  airtableService: ReturnType<typeof getAirtableService>,
  eventId: string,
  parentClassId: string
): Promise<AllAudioResponse | null> {
  try {
    // 1. Bulk fetch songs + audio files for the event (2 Airtable calls)
    const [allSongs, allAudioFiles, eventDetail] = await Promise.all([
      teacherService.getSongsByEventId(eventId),
      teacherService.getAudioFilesByEventId(eventId),
      airtableService.getSchoolEventDetail(eventId),
    ]);

    if (!eventDetail) {
      console.warn('[buildAllAudio] No event detail found for', eventId);
      return null;
    }

    // 2. Build lookup maps
    const songMap = new Map<string, Song>();
    for (const song of allSongs) {
      songMap.set(song.id, song);
    }

    // Group audio files by classId (only final + ready, not schulsong)
    // Deduplicate by songId within each class, keeping only the newest record
    // (allAudioFiles is sorted by uploaded_at desc, so first seen per songId wins)
    const audioFilesByClass = new Map<string, AudioFile[]>();
    const seenSongIds = new Set<string>();
    for (const af of allAudioFiles) {
      if (af.type !== 'final' || af.status !== 'ready' || af.isSchulsong) continue;
      if (af.songId && seenSongIds.has(af.songId)) continue;
      if (af.songId) seenSongIds.add(af.songId);
      const existing = audioFilesByClass.get(af.classId) || [];
      existing.push(af);
      audioFilesByClass.set(af.classId, existing);
    }

    // 3. Build sections from all classes
    const sections: AudioSection[] = [];

    for (const cls of eventDetail.classes) {
      const classAudioFiles = audioFilesByClass.get(cls.classId) || [];
      const tracks: TrackEntry[] = [];

      // Process each audio file for this class
      const trackPromises = classAudioFiles.map(async (af) => {
        const r2Key = await resolveAudioFileUrl(r2, af, eventId, cls.classId);
        if (!r2Key) {
          console.warn(`[buildAllAudio] No R2 key found for audio file ${af.id} in class ${cls.classId}`);
          return null;
        }

        // Match to song for metadata
        const song = af.songId ? songMap.get(af.songId) : undefined;
        const title = song?.title || cls.className;
        const artist = song?.artist;
        const order = song?.order || 0;
        const downloadFilename = song
          ? `${String(order).padStart(2, '0')} - ${title}.mp3`
          : `${cls.className}.mp3`;

        const [audioUrl, downloadUrl] = await Promise.all([
          r2.generateSignedUrl(r2Key, 3600),
          r2.generateSignedUrl(r2Key, 86400, downloadFilename),
        ]);

        return {
          songId: af.songId,
          title,
          artist,
          order,
          durationSeconds: af.durationSeconds,
          fileSizeBytes: af.fileSizeBytes,
          audioUrl,
          downloadUrl,
          filename: downloadFilename,
        } as TrackEntry;
      });

      const resolvedTracks = await Promise.all(trackPromises);
      for (const track of resolvedTracks) {
        if (track) tracks.push(track);
      }

      // Sort tracks by order
      tracks.sort((a, b) => a.order - b.order);

      const sectionType = (cls.classType === 'choir' || cls.classType === 'teacher_song')
        ? cls.classType as 'choir' | 'teacher_song'
        : 'class';

      sections.push({
        sectionId: cls.classId,
        sectionName: cls.className,
        sectionType,
        tracks,
      });
    }

    // 4. Get groups for parent's class
    try {
      const groups = await teacherService.getGroupsForClass(parentClassId);
      for (const group of groups) {
        const groupTracks: TrackEntry[] = [];

        // Check for song-level audio files first (preferred, has metadata)
        const groupAudioFiles = audioFilesByClass.get(group.groupId) || [];

        for (const af of groupAudioFiles) {
          const r2Key = await resolveAudioFileUrl(r2, af, eventId, group.groupId);
          if (!r2Key) continue;

          const song = af.songId ? songMap.get(af.songId) : undefined;
          const title = song?.title || group.groupName;
          const downloadFilename = song
            ? `${String(song.order).padStart(2, '0')} - ${title}.mp3`
            : `${group.groupName}.mp3`;

          const [audioUrl, downloadUrl] = await Promise.all([
            r2.generateSignedUrl(r2Key, 3600),
            r2.generateSignedUrl(r2Key, 86400, downloadFilename),
          ]);

          groupTracks.push({
            songId: af.songId,
            title,
            artist: song?.artist,
            order: song?.order || 0,
            durationSeconds: af.durationSeconds,
            fileSizeBytes: af.fileSizeBytes,
            audioUrl,
            downloadUrl,
            filename: downloadFilename,
          });
        }

        // Fallback: check legacy R2 paths only if no song-level files found
        if (groupTracks.length === 0) {
          const groupPaths = [
            `recordings/${eventId}/${group.groupId}/final.mp3`,
            `events/${eventId}/${group.groupId}/full.mp3`,
          ];

          for (const key of groupPaths) {
            if (await r2.fileExists(key)) {
              const downloadFilename = `${group.groupName}.mp3`;
              const [audioUrl, downloadUrl] = await Promise.all([
                r2.generateSignedUrl(key, 3600),
                r2.generateSignedUrl(key, 86400, downloadFilename),
              ]);

              groupTracks.push({
                title: group.groupName,
                order: 1,
                audioUrl,
                downloadUrl,
                filename: downloadFilename,
              });
              break;
            }
          }
        }

        groupTracks.sort((a, b) => a.order - b.order);

        const memberClasses = group.memberClasses?.map(c => ({
          classId: c.classId,
          className: c.className,
        })) || [];

        sections.push({
          sectionId: group.groupId,
          sectionName: group.groupName,
          sectionType: 'group',
          memberClasses,
          tracks: groupTracks,
        });
      }
    } catch {
      // Groups are optional
    }

    // 5. Sort sections: parent's class first, then regular classes (alphabetical),
    //    then choir, teacher songs, groups
    const sectionOrder: Record<string, number> = {
      class: 1,
      choir: 2,
      teacher_song: 3,
      group: 4,
    };
    sections.sort((a, b) => {
      // Parent's class always first
      if (a.sectionId === parentClassId) return -1;
      if (b.sectionId === parentClassId) return 1;

      // Then by type
      const typeA = sectionOrder[a.sectionType] || 99;
      const typeB = sectionOrder[b.sectionType] || 99;
      if (typeA !== typeB) return typeA - typeB;

      // Then alphabetical within same type
      return a.sectionName.localeCompare(b.sectionName);
    });

    // 6. Calculate totals
    let totalTracks = 0;
    let totalSizeBytes = 0;
    for (const section of sections) {
      totalTracks += section.tracks.length;
      for (const track of section.tracks) {
        totalSizeBytes += track.fileSizeBytes || 0;
      }
    }

    return {
      parentClassId,
      sections,
      totalTracks,
      totalSizeBytes,
    };
  } catch (error) {
    console.error('[buildAllAudio] Error:', error);
    return null;
  }
}
