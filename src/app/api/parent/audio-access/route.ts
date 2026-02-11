import { NextRequest, NextResponse } from 'next/server';
import { verifyParentSession } from '@/lib/auth/verifyParentSession';
import { hasMinicardForEvent } from '@/lib/utils/minicardAccess';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/parent/audio-access
 *
 * Unified audio access endpoint for the parent portal.
 * Determines what audio content a parent can access based on:
 * - Whether audio has been released (all_tracks_approved + 7 days past event)
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

    // 1. Check release status (same pattern as class-audio-status route)
    const event = await airtableService.getEventByEventId(eventId);
    const allTracksApproved = event?.all_tracks_approved === true;
    const eventDate = event?.event_date ? new Date(event.event_date) : null;
    const sevenDaysAfter = eventDate ? new Date(eventDate) : null;
    if (sevenDaysAfter) {
      sevenDaysAfter.setDate(sevenDaysAfter.getDate() + 7);
    }
    const hasWaitingPeriodPassed = sevenDaysAfter ? new Date() >= sevenDaysAfter : false;
    const isReleased = allTracksApproved && hasWaitingPeriodPassed;

    // 2. Check minicard purchase status
    const hasMinicard = await hasMinicardForEvent(session.parentId, eventId);

    // 3. Build class preview info (always included when audio exists)
    const classPreview = await buildClassPreview(r2, teacherService, eventId, classId);

    // 4. Build response based on access level
    const response: Record<string, unknown> = {
      success: true,
      hasMinicard,
      isReleased,
      classPreview,
      releaseDate: sevenDaysAfter ? sevenDaysAfter.toISOString() : undefined,
    };

    // Only include full content when minicard buyer AND released
    if (hasMinicard && isReleased) {
      // Full class audio
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
