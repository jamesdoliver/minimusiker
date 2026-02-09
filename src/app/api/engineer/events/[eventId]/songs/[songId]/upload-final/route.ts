import { NextRequest, NextResponse } from 'next/server';
import { verifyEngineerSession } from '@/lib/auth/verifyEngineerSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/engineer/events/[eventId]/songs/[songId]/upload-final
 * Generate presigned URL for uploading final/mixed audio file for a specific song
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string; songId: string } }
) {
  try {
    // Verify engineer session
    const session = verifyEngineerSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const songId = decodeURIComponent(params.songId);

    const { filename, contentType } = await request.json();

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac', 'audio/x-m4a'];
    if (contentType && !validTypes.includes(contentType.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: MP3, WAV, M4A/AAC' },
        { status: 400 }
      );
    }

    // Get song to verify it exists and get classId
    const teacherService = getTeacherService();
    const song = await teacherService.getSongById(songId);

    if (!song) {
      return NextResponse.json(
        { error: 'Song not found' },
        { status: 404 }
      );
    }

    if (song.eventId !== eventId) {
      return NextResponse.json(
        { error: 'Song does not belong to this event' },
        { status: 400 }
      );
    }

    // Generate presigned URL for final upload
    const r2 = getR2Service();
    const { uploadUrl, key } = await r2.generateSongFinalUploadUrl(
      eventId,
      song.classId,
      songId,
      filename,
      contentType || 'audio/mpeg'
    );

    return NextResponse.json({
      success: true,
      uploadUrl,
      key,
      message: 'Presigned URL generated successfully',
    });
  } catch (error) {
    console.error('Error generating presigned URL for song final upload:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate upload URL',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/engineer/events/[eventId]/songs/[songId]/upload-final
 * Confirm successful upload and create AudioFile record in Airtable
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { eventId: string; songId: string } }
) {
  try {
    // Verify engineer session
    const session = verifyEngineerSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const songId = decodeURIComponent(params.songId);

    const { r2Key, filename, fileSizeBytes, durationSeconds } = await request.json();

    if (!r2Key || !filename) {
      return NextResponse.json(
        { error: 'r2Key and filename are required' },
        { status: 400 }
      );
    }

    // Get song to get classId
    const teacherService = getTeacherService();
    const song = await teacherService.getSongById(songId);

    if (!song) {
      return NextResponse.json(
        { error: 'Song not found' },
        { status: 404 }
      );
    }

    // Create AudioFile record in Airtable
    const audioFile = await teacherService.createSongAudioFile({
      songId,
      classId: song.classId,
      eventId,
      type: 'final',
      r2Key,
      filename,
      uploadedBy: session.engineerId,
      fileSizeBytes,
      durationSeconds,
      status: 'ready',
    });

    // Check if ALL songs now have final audio → transition to ready_for_review
    try {
      const allSongs = await teacherService.getSongsByEventId(eventId);
      const allAudioFiles = await teacherService.getAudioFilesByEventId(eventId);
      const finalFiles = allAudioFiles.filter(f => f.type === 'final');
      // Check: every class that has songs also has at least one final audio file
      const classIdsWithSongs = new Set(allSongs.map(s => s.classId));
      const classIdsWithFinal = new Set(finalFiles.map(f => f.classId));
      const allClassesHaveFinal = classIdsWithSongs.size > 0 &&
        [...classIdsWithSongs].every(cid => classIdsWithFinal.has(cid));

      const hasSchulsongOnly = classIdsWithSongs.size === 0 &&
        finalFiles.some(f => f.isSchulsong);

      if (allClassesHaveFinal || hasSchulsongOnly) {
        await getAirtableService().updateEventAudioPipelineStage(eventId, 'ready_for_review');
      }
    } catch (e) {
      console.error('Error checking/updating audio pipeline stage:', e);
    }

    return NextResponse.json({
      success: true,
      audioFile,
      message: 'Final audio file uploaded successfully',
    });
  } catch (error) {
    console.error('Error confirming song final upload:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to confirm upload',
      },
      { status: 500 }
    );
  }
}
