import { NextRequest, NextResponse } from 'next/server';
import { verifyEngineerSession } from '@/lib/auth/verifyEngineerSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';
import { getAirtableService } from '@/lib/services/airtableService';
import { ENGINEER_IDS } from '@/lib/config/engineers';
import { autoMatchFiles, getMatchSummary } from '@/lib/utils/autoMatch';
import { generateAudioDisplayName } from '@/lib/utils/audioFilename';

export const dynamic = 'force-dynamic';

/**
 * POST /api/engineer/events/[eventId]/upload-batch
 * Accept filenames extracted client-side from a ZIP, run auto-matching against event songs,
 * and return presigned upload URLs for direct browser-to-R2 uploads.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyEngineerSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);

    const body = await request.json();
    const { filenames } = body as { filenames?: string[] };

    if (!Array.isArray(filenames) || filenames.length === 0) {
      return NextResponse.json(
        { error: 'filenames array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Sanitize filenames: strip path components, reject path traversal
    const sanitized: string[] = [];
    for (const raw of filenames) {
      const name = raw.split('/').pop()?.split('\\').pop() || '';
      if (!name || name.includes('..') || !name.toLowerCase().endsWith('.wav')) {
        return NextResponse.json(
          { error: `Invalid filename: ${raw}` },
          { status: 400 }
        );
      }
      sanitized.push(name);
    }

    // Get all songs for the event
    const teacherService = getTeacherService();
    const allSongs = await teacherService.getSongsByEventId(eventId);

    if (allSongs.length === 0) {
      return NextResponse.json(
        { error: 'No songs found. Teachers must add songs before uploading finals.' },
        { status: 400 }
      );
    }

    // Run auto-matching against all event songs
    const matchResults = autoMatchFiles(sanitized, allSongs);
    const matchSummary = getMatchSummary(matchResults);

    // Get class names from event detail
    const airtableService = getAirtableService();
    const eventDetail = await airtableService.getSchoolEventDetail(eventId);
    const classNameMap = new Map<string, string>();
    if (eventDetail) {
      for (const cls of eventDetail.classes) {
        classNameMap.set(cls.classId, cls.className);
      }
    }

    // Build enriched matches with class info
    const enrichedMatches = matchResults.map((match) => {
      const song = match.songId ? allSongs.find(s => s.id === match.songId) : null;
      return {
        ...match,
        classId: song?.classId || null,
        className: song ? (classNameMap.get(song.classId) || song.classId) : null,
      };
    });

    // Build class list for dropdown grouping
    const classMap = new Map<string, { classId: string; className: string }>();
    for (const song of allSongs) {
      if (!classMap.has(song.classId)) {
        classMap.set(song.classId, {
          classId: song.classId,
          className: classNameMap.get(song.classId) || song.classId,
        });
      }
    }
    const allClasses = Array.from(classMap.values());

    // Generate presigned upload URLs for each filename
    const uploadId = `${session.engineerId}_${Date.now()}`;
    const r2 = getR2Service();
    const uploadUrls: Record<string, string> = {};
    for (const filename of sanitized) {
      const { uploadUrl } = await r2.generateTempUploadUrl(uploadId, filename);
      uploadUrls[filename] = uploadUrl;
    }

    return NextResponse.json({
      success: true,
      uploadId,
      matches: enrichedMatches,
      summary: matchSummary,
      allSongs: allSongs.map(s => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        classId: s.classId,
      })),
      allClasses,
      uploadUrls,
      message: 'Review matches and upload files directly.',
    });
  } catch (error) {
    console.error('Error processing engineer batch upload:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process batch upload',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/engineer/events/[eventId]/upload-batch
 * Confirm batch upload after engineer reviews and corrects auto-matching.
 * Moves files from temp to final location and creates AudioFile records.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyEngineerSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const { uploadId, confirmedMatches } = await request.json();

    if (!uploadId || !Array.isArray(confirmedMatches)) {
      return NextResponse.json(
        { error: 'uploadId and confirmedMatches array are required' },
        { status: 400 }
      );
    }

    // Validate all matches have a songId and filename
    const invalidMatches = confirmedMatches.filter((m: any) => !m.songId || !m.filename);
    if (invalidMatches.length > 0) {
      return NextResponse.json(
        { error: 'All files must be matched to a song before confirming' },
        { status: 400 }
      );
    }

    // Check for duplicate songId assignments
    const songIdCounts = new Map<string, number>();
    for (const match of confirmedMatches) {
      songIdCounts.set(match.songId, (songIdCounts.get(match.songId) || 0) + 1);
    }
    const duplicates = Array.from(songIdCounts.entries()).filter(([, count]) => count > 1);
    if (duplicates.length > 0) {
      return NextResponse.json(
        { error: 'Multiple files cannot be assigned to the same song' },
        { status: 400 }
      );
    }

    // Determine isSchulsong based on engineer role
    const isMicha = ENGINEER_IDS.MICHA && session.engineerId === ENGINEER_IDS.MICHA;

    const teacherService = getTeacherService();
    const r2 = getR2Service();
    const audioFiles = [];
    const warnings: string[] = [];

    // Fetch class names for meaningful filenames
    const airtableService = getAirtableService();
    const eventDetail = await airtableService.getSchoolEventDetail(eventId);
    const classNameMap = new Map<string, string>();
    if (eventDetail) {
      for (const cls of eventDetail.classes) {
        classNameMap.set(cls.classId, cls.className);
      }
    }

    for (const match of confirmedMatches) {
      const { filename, songId } = match;

      // Validate song exists
      const song = await teacherService.getSongById(songId);
      if (!song) {
        warnings.push(`Song not found for "${filename}" (songId: ${songId}), skipped`);
        continue;
      }

      // Generate meaningful R2 key: "{SongTitle} - {ClassName}.wav"
      const className = classNameMap.get(song.classId) || song.classId;
      const displayName = generateAudioDisplayName(song.title, className);
      const finalKey = `recordings/${eventId}/${song.classId}/${songId}/final/${displayName}.wav`;

      // Move file from temp to final location
      const tempKey = `temp/${uploadId}/${filename}`;
      const moved = await r2.moveFile(tempKey, finalKey);

      if (!moved) {
        warnings.push(`Failed to move file: ${filename}`);
        continue;
      }

      // Create AudioFile record with meaningful filename
      const audioFile = await teacherService.createSongAudioFile({
        songId,
        classId: song.classId,
        eventId,
        type: 'final',
        r2Key: finalKey,
        filename: `${displayName}.wav`,
        uploadedBy: session.engineerId,
        status: 'ready',
        isSchulsong: isMicha || false,
      });

      audioFiles.push(audioFile);
    }

    // Build list of files that need audio processing (WAV→MP3 + preview generation)
    const filesToProcess = audioFiles.map(af => ({
      audioFileId: af.id,
      r2Key: af.r2Key,
      eventId: af.eventId,
      classId: af.classId,
      songId: af.songId,
      displayName: af.filename.replace(/\.\w+$/, ''),
    }));

    return NextResponse.json({
      success: true,
      audioFiles,
      count: audioFiles.length,
      filesToProcess,
      warnings: warnings.length > 0 ? warnings : undefined,
      message: `Successfully uploaded ${audioFiles.length} final WAV file(s)`,
    });
  } catch (error) {
    console.error('Error confirming engineer batch upload:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to confirm batch upload',
      },
      { status: 500 }
    );
  }
}
