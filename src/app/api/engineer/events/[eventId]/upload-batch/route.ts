import { NextRequest, NextResponse } from 'next/server';
import { verifyEngineerSession } from '@/lib/auth/verifyEngineerSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';
import { getAirtableService } from '@/lib/services/airtableService';
import { ENGINEER_IDS } from '@/lib/config/engineers';
import { autoMatchFiles, getMatchSummary } from '@/lib/utils/autoMatch';
import AdmZip from 'adm-zip';

export const dynamic = 'force-dynamic';

/**
 * POST /api/engineer/events/[eventId]/upload-batch
 * Upload ZIP file containing final WAV mixes, extract, and run auto-matching against event songs.
 * Returns match results for engineer to review and correct before confirming.
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

    const formData = await request.formData();
    const uploadedFile = formData.get('file') as File | null;

    if (!uploadedFile) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    if (!uploadedFile.name.endsWith('.zip') && uploadedFile.type !== 'application/zip') {
      return NextResponse.json(
        { error: 'Only ZIP files are accepted' },
        { status: 400 }
      );
    }

    // Extract WAV files from ZIP
    const zipBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    const filenames: string[] = [];
    const fileBuffers = new Map<string, Buffer>();

    for (const entry of zipEntries) {
      if (entry.isDirectory || entry.entryName.startsWith('.') || entry.entryName.includes('__MACOSX')) {
        continue;
      }

      const filename = entry.entryName.split('/').pop() || entry.entryName;

      // Skip hidden files (dot-files extracted from base name)
      if (filename.startsWith('.')) {
        continue;
      }

      const ext = filename.toLowerCase().split('.').pop();
      if (ext !== 'wav') {
        continue;
      }

      filenames.push(filename);
      fileBuffers.set(filename, entry.getData());
    }

    if (filenames.length === 0) {
      return NextResponse.json(
        { error: 'No WAV files found. This feature only supports .wav files.' },
        { status: 400 }
      );
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
    const matchResults = autoMatchFiles(filenames, allSongs);
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

    // Upload WAVs to temp R2 location
    const uploadId = `${session.engineerId}_${Date.now()}`;
    const r2 = getR2Service();
    const uploadPromises = Array.from(fileBuffers.entries()).map(async ([filename, buffer]) => {
      return r2.uploadToTemp(uploadId, filename, buffer, 'audio/wav');
    });

    const uploadResults = await Promise.all(uploadPromises);
    const failedUploads = uploadResults.filter((r) => !r.success);

    if (failedUploads.length > 0) {
      console.error('Some temp uploads failed:', failedUploads);
      return NextResponse.json(
        { error: `Failed to upload ${failedUploads.length} file(s) to temporary storage` },
        { status: 500 }
      );
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
      message: 'Files uploaded to temporary storage. Review matches and confirm.',
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

    for (const match of confirmedMatches) {
      const { filename, songId } = match;

      // Validate song exists
      const song = await teacherService.getSongById(songId);
      if (!song) {
        warnings.push(`Song not found for "${filename}" (songId: ${songId}), skipped`);
        continue;
      }

      // Generate final R2 key matching existing pattern
      const timestamp = Date.now();
      const finalKey = `recordings/${eventId}/${song.classId}/${songId}/final/final_${timestamp}.wav`;

      // Move file from temp to final location
      const tempKey = `temp/${uploadId}/${filename}`;
      const moved = await r2.moveFile(tempKey, finalKey);

      if (!moved) {
        warnings.push(`Failed to move file: ${filename}`);
        continue;
      }

      // Create AudioFile record
      const audioFile = await teacherService.createSongAudioFile({
        songId,
        classId: song.classId,
        eventId,
        type: 'final',
        r2Key: finalKey,
        filename,
        uploadedBy: session.engineerId,
        status: 'ready',
        isSchulsong: isMicha || false,
      });

      audioFiles.push(audioFile);
    }

    return NextResponse.json({
      success: true,
      audioFiles,
      count: audioFiles.length,
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
