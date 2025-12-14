import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffSession } from '@/lib/auth/verifyStaffSession';
import { getR2Service } from '@/lib/services/r2Service';
import { getTeacherService } from '@/lib/services/teacherService';
import airtableService from '@/lib/services/airtableService';

/**
 * POST /api/staff/events/[eventId]/upload-raw
 * Generate presigned URL for raw audio upload
 *
 * Request body: { classId: string, filename: string, contentType?: string }
 * Response: { uploadUrl: string, r2Key: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyStaffSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const { classId, filename, contentType } = await request.json();

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

    // Verify event exists
    const eventDetail = await airtableService.getSchoolEventDetail(eventId);
    if (!eventDetail) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Generate presigned URL for upload
    const r2Service = getR2Service();
    const { uploadUrl, key } = await r2Service.generateRawAudioUploadUrl(
      eventId,
      classId,
      filename,
      contentType || 'audio/mpeg'
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
 * PUT /api/staff/events/[eventId]/upload-raw
 * Confirm upload completion and create audio file record
 *
 * Request body: { classId: string, r2Key: string, filename: string, fileSizeBytes?: number }
 * Response: { audioFile: AudioFile }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyStaffSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const { classId, r2Key, filename, fileSizeBytes } = await request.json();

    if (!classId || !r2Key || !filename) {
      return NextResponse.json(
        { error: 'classId, r2Key, and filename are required' },
        { status: 400 }
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

    // Create audio file record in Airtable
    const teacherService = getTeacherService();
    const audioFile = await teacherService.createAudioFile({
      classId,
      eventId,
      type: 'raw',
      r2Key,
      filename,
      uploadedBy: session.staffId,
      fileSizeBytes,
      status: 'ready',
    });

    return NextResponse.json({
      success: true,
      audioFile,
      message: 'Audio file uploaded successfully',
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
