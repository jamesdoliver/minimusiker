import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffSession } from '@/lib/auth/verifyStaffSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';
import { getAirtableService } from '@/lib/services/airtableService';
import { notifyEngineerOfFirstUpload } from '@/lib/services/notificationService';
import { autoMatchFiles, getMatchSummary } from '@/lib/utils/autoMatch';
import AdmZip from 'adm-zip';

export const dynamic = 'force-dynamic';

/**
 * POST /api/staff/events/[eventId]/classes/[classId]/upload-batch
 * Upload ZIP file or multiple files, extract, and run auto-matching
 * Returns match results for staff to review and correct
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string; classId: string } }
) {
  try {
    // Verify staff session
    const session = verifyStaffSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const classId = decodeURIComponent(params.classId);

    // Parse multipart form data
    const formData = await request.formData();
    const uploadedFile = formData.get('file') as File | null;

    if (!uploadedFile) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    const teacherService = getTeacherService();

    // Get songs for this class
    const songs = await teacherService.getSongsByClassId(classId);

    if (songs.length === 0) {
      return NextResponse.json(
        { error: 'No songs found for this class. Please add songs first.' },
        { status: 400 }
      );
    }

    // Extract files from ZIP or handle single file
    let filenames: string[] = [];
    let fileBuffers: Map<string, Buffer> = new Map();

    if (uploadedFile.type === 'application/zip' || uploadedFile.name.endsWith('.zip')) {
      // Handle ZIP file
      const zipBuffer = Buffer.from(await uploadedFile.arrayBuffer());
      const zip = new AdmZip(zipBuffer);
      const zipEntries = zip.getEntries();

      for (const entry of zipEntries) {
        // Skip directories and hidden files
        if (entry.isDirectory || entry.entryName.startsWith('.') || entry.entryName.includes('__MACOSX')) {
          continue;
        }

        // Only process audio files
        const filename = entry.entryName.split('/').pop() || entry.entryName;
        const ext = filename.toLowerCase().split('.').pop();
        const validExtensions = ['mp3', 'wav', 'm4a', 'aac'];

        if (ext && validExtensions.includes(ext)) {
          filenames.push(filename);
          fileBuffers.set(filename, entry.getData());
        }
      }
    } else {
      // Handle single file
      const filename = uploadedFile.name;
      const buffer = Buffer.from(await uploadedFile.arrayBuffer());
      filenames.push(filename);
      fileBuffers.set(filename, buffer);
    }

    if (filenames.length === 0) {
      return NextResponse.json(
        { error: 'No valid audio files found in upload. Supported formats: MP3, WAV, M4A/AAC' },
        { status: 400 }
      );
    }

    // Run auto-matching
    const matchResults = autoMatchFiles(filenames, songs);
    const matchSummary = getMatchSummary(matchResults);

    // Generate upload ID for temporary storage
    const uploadId = `${session.staffId}_${Date.now()}`;

    // Upload files to temporary location in R2
    const r2 = getR2Service();
    const uploadPromises = Array.from(fileBuffers.entries()).map(async ([filename, buffer]) => {
      const ext = filename.toLowerCase().split('.').pop() || 'mp3';
      const contentType = ext === 'mp3' ? 'audio/mpeg' :
                         ext === 'wav' ? 'audio/wav' :
                         ext === 'm4a' || ext === 'aac' ? 'audio/mp4' :
                         'audio/mpeg';

      return r2.uploadToTemp(uploadId, filename, buffer, contentType);
    });

    const uploadResults = await Promise.all(uploadPromises);

    // Check for upload failures
    const failedUploads = uploadResults.filter((r) => !r.success);
    if (failedUploads.length > 0) {
      console.error('Some uploads failed:', failedUploads);
      return NextResponse.json(
        { error: `Failed to upload ${failedUploads.length} file(s) to temporary storage` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      uploadId,
      matches: matchResults,
      summary: matchSummary,
      message: 'Files uploaded to temporary storage. Review matches and confirm.',
    });
  } catch (error) {
    console.error('Error processing batch upload:', error);
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
 * PUT /api/staff/events/[eventId]/classes/[classId]/upload-batch
 * Confirm batch upload after staff reviews and corrects auto-matching
 * Moves files from temp to final location and creates AudioFile records
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { eventId: string; classId: string } }
) {
  try {
    // Verify staff session
    const session = verifyStaffSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const classId = decodeURIComponent(params.classId);

    const { uploadId, confirmedMatches, isSchulsong } = await request.json();

    if (!uploadId || !Array.isArray(confirmedMatches)) {
      return NextResponse.json(
        { error: 'uploadId and confirmedMatches array are required' },
        { status: 400 }
      );
    }

    // Validate all matches have a songId
    const invalidMatches = confirmedMatches.filter((m: any) => !m.songId || !m.filename);
    if (invalidMatches.length > 0) {
      return NextResponse.json(
        { error: 'All files must be matched to a song before confirming' },
        { status: 400 }
      );
    }

    const teacherService = getTeacherService();
    const r2 = getR2Service();
    const audioFiles = [];

    // Move files from temp to final location and create AudioFile records
    for (const match of confirmedMatches) {
      const { filename, songId } = match;

      // Get song to verify it exists
      const song = await teacherService.getSongById(songId);
      if (!song) {
        console.error(`Song not found: ${songId}`);
        continue;
      }

      // Generate final R2 key
      const timestamp = Date.now();
      const sanitizedFilename = filename
        .toLowerCase()
        .replace(/[^a-z0-9.-]/g, '_')
        .substring(0, 50);
      const finalKey = `recordings/${eventId}/${classId}/${songId}/raw/${timestamp}_${sanitizedFilename}`;

      // Move file from temp to final location
      const tempKey = `temp/${uploadId}/${filename}`;
      const moved = await r2.moveFile(tempKey, finalKey);

      if (!moved) {
        console.error(`Failed to move file: ${filename}`);
        continue;
      }

      // Create AudioFile record
      const audioFile = await teacherService.createSongAudioFile({
        songId,
        classId,
        eventId,
        type: 'raw',
        r2Key: finalKey,
        filename,
        uploadedBy: session.staffId,
        status: 'ready',
        isSchulsong: isSchulsong || false,
      });

      audioFiles.push(audioFile);
    }

    // Auto-assign engineer and update pipeline stage
    if (audioFiles.length > 0) {
      try {
        await getAirtableService().autoAssignEngineerForUpload(eventId, isSchulsong || false);
      } catch (error) {
        console.error('Error auto-assigning engineer:', error);
      }
      notifyEngineerOfFirstUpload(eventId).catch(err => console.error('Engineer notification error:', err));
      try {
        await getAirtableService().updateEventAudioPipelineStage(eventId, 'in_progress');
      } catch (error) {
        console.error('Error updating audio pipeline stage:', error);
      }
    }

    return NextResponse.json({
      success: true,
      audioFiles,
      count: audioFiles.length,
      message: `Successfully uploaded ${audioFiles.length} file(s)`,
    });
  } catch (error) {
    console.error('Error confirming batch upload:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to confirm batch upload',
      },
      { status: 500 }
    );
  }
}
