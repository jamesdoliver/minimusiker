import { NextRequest, NextResponse } from 'next/server';
import { verifyEngineerSession } from '@/lib/auth/verifyEngineerSession';
import { getR2Service } from '@/lib/services/r2Service';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';

/**
 * POST /api/engineer/events/[eventId]/upload-mixed
 * Generate presigned URL for mixed audio upload (preview or final)
 *
 * Request body: { classId: string, filename: string, type: 'preview' | 'final', contentType?: string }
 * Response: { uploadUrl: string, r2Key: string }
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
    const { classId, filename, type, contentType, format } = await request.json();

    // Validate required fields
    if (!classId || typeof classId !== 'string') {
      return NextResponse.json(
        { error: 'Class ID is required' },
        { status: 400 }
      );
    }

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    if (!type || (type !== 'preview' && type !== 'final')) {
      return NextResponse.json(
        { error: 'Type must be "preview" or "final"' },
        { status: 400 }
      );
    }

    // Verify engineer is assigned to this event
    const isAssigned = await getAirtableService().isEngineerAssignedToEvent(
      session.engineerId,
      eventId
    );

    if (!isAssigned) {
      return NextResponse.json(
        { error: 'You are not assigned to this event' },
        { status: 403 }
      );
    }

    // Verify event exists
    const eventDetail = await getAirtableService().getSchoolEventDetail(eventId);
    if (!eventDetail) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Generate presigned URL for upload
    const r2Service = getR2Service();
    const resolvedFormat = (format === 'wav' ? 'wav' : 'mp3') as 'mp3' | 'wav';
    const resolvedContentType = contentType || (resolvedFormat === 'wav' ? 'audio/wav' : 'audio/mpeg');
    const { uploadUrl, key } = await r2Service.generateMixedAudioUploadUrl(
      eventId,
      classId,
      type,
      resolvedContentType,
      resolvedFormat
    );

    return NextResponse.json({
      success: true,
      uploadUrl,
      r2Key: key,
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
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
 * PUT /api/engineer/events/[eventId]/upload-mixed
 * Confirm upload completion and create/update audio file record
 * Also triggers notifications to teacher and parents
 *
 * Request body: { classId: string, r2Key: string, filename: string, type: 'preview' | 'final', fileSizeBytes?: number, durationSeconds?: number }
 * Response: { audioFile: AudioFile }
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
    const { classId, r2Key, filename, type, fileSizeBytes, durationSeconds, isSchulsong } =
      await request.json();

    // Validate required fields
    if (!classId || !r2Key || !filename || !type) {
      return NextResponse.json(
        { error: 'classId, r2Key, filename, and type are required' },
        { status: 400 }
      );
    }

    if (type !== 'preview' && type !== 'final') {
      return NextResponse.json(
        { error: 'Type must be "preview" or "final"' },
        { status: 400 }
      );
    }

    // Verify engineer is assigned to this event
    const isAssigned = await getAirtableService().isEngineerAssignedToEvent(
      session.engineerId,
      eventId
    );

    if (!isAssigned) {
      return NextResponse.json(
        { error: 'You are not assigned to this event' },
        { status: 403 }
      );
    }

    // Verify the file was uploaded to R2
    const r2Service = getR2Service();
    const fileExists = await r2Service.fileExists(r2Key);
    if (!fileExists) {
      return NextResponse.json(
        { error: 'File not found in storage. Upload may have failed.' },
        { status: 400 }
      );
    }

    // Check if an existing audio file record exists for this class, type, and exact R2 key
    // Match by r2Key to allow separate MP3 and WAV final files
    const teacherService = getTeacherService();
    const existingFiles = await teacherService.getAudioFilesByClassId(classId);
    const existingFile = existingFiles.find((f) => f.type === type && f.r2Key === r2Key);

    let audioFile;
    if (existingFile) {
      // Update existing record
      audioFile = await teacherService.updateAudioFile(existingFile.id, {
        r2Key,
        filename,
        uploadedBy: session.engineerId,
        fileSizeBytes,
        durationSeconds,
        status: 'ready',
        isSchulsong: isSchulsong ?? undefined,
      });
    } else {
      // Create new audio file record
      audioFile = await teacherService.createAudioFile({
        classId,
        eventId,
        type,
        r2Key,
        filename,
        uploadedBy: session.engineerId,
        fileSizeBytes,
        durationSeconds,
        status: 'ready',
        isSchulsong: isSchulsong ?? undefined,
      });
    }

    // Note: Email notifications removed - will be configured separately via publish toggle

    // If this is a final upload, check if all songs now have final audio → ready_for_review
    if (type === 'final') {
      try {
        const allSongs = await teacherService.getSongsByEventId(eventId);
        const allAudioFiles = await teacherService.getAudioFilesByEventId(eventId);
        const finalFiles = allAudioFiles.filter(f => f.type === 'final');
        // Check: every class that has songs also has at least one final audio file
        const classIdsWithSongs = new Set(allSongs.map(s => s.classId));
        const classIdsWithFinal = new Set(finalFiles.map(f => f.classId));
        const allClassesHaveFinal = classIdsWithSongs.size > 0 &&
          [...classIdsWithSongs].every(cid => classIdsWithFinal.has(cid));

        if (allClassesHaveFinal) {
          await getAirtableService().updateEventAudioPipelineStage(eventId, 'ready_for_review');
        }
      } catch (e) {
        console.error('Error checking/updating audio pipeline stage:', e);
      }
    }

    return NextResponse.json({
      success: true,
      audioFile,
      message: `${type === 'preview' ? 'Preview' : 'Final'} audio uploaded successfully`,
    });
  } catch (error) {
    console.error('Error confirming upload:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to confirm upload',
      },
      { status: 500 }
    );
  }
}
