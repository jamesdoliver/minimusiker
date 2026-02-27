import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffSession } from '@/lib/auth/verifyStaffSession';
import { getR2Service } from '@/lib/services/r2Service';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import { notifyEngineerOfUpload } from '@/lib/services/notificationService';
import { AudioFileType } from '@/lib/types/teacher';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const PART_SIZE = 100 * 1024 * 1024; // 100MB

type LogicProjectType = 'schulsong' | 'minimusiker';

function audioFileTypeFromProjectType(projectType: LogicProjectType): AudioFileType {
  return projectType === 'schulsong' ? 'logic-project-schulsong' : 'logic-project-minimusiker';
}

/**
 * POST /api/staff/events/[eventId]/upload-logic-project/multipart
 * Initiate multipart upload — returns uploadId, r2Key, and presigned part URLs
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
    const { projectType, filename, fileSizeBytes } = await request.json();

    if (!projectType || !['schulsong', 'minimusiker'].includes(projectType)) {
      return NextResponse.json(
        { error: 'projectType must be "schulsong" or "minimusiker"' },
        { status: 400 }
      );
    }

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    if (!filename.toLowerCase().endsWith('.zip')) {
      return NextResponse.json(
        { error: 'Only .zip files are allowed' },
        { status: 400 }
      );
    }

    if (!fileSizeBytes || typeof fileSizeBytes !== 'number' || fileSizeBytes <= 0) {
      return NextResponse.json(
        { error: 'fileSizeBytes is required and must be positive' },
        { status: 400 }
      );
    }

    if (fileSizeBytes > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 2GB limit' },
        { status: 400 }
      );
    }

    // Verify event exists
    const eventDetail = await getAirtableService().getSchoolEventDetail(eventId);
    if (!eventDetail) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const r2Service = getR2Service();
    const totalParts = Math.ceil(fileSizeBytes / PART_SIZE);

    // Initiate multipart upload
    const { uploadId, key } = await r2Service.initiateLogicProjectMultipartUpload(
      eventId,
      projectType as LogicProjectType,
      filename
    );

    // Generate presigned URLs for each part
    const partUrls = await r2Service.generateUploadPartUrls(key, uploadId, totalParts);

    return NextResponse.json({
      success: true,
      uploadId,
      r2Key: key,
      partUrls,
      totalParts,
      partSizeBytes: PART_SIZE,
    });
  } catch (error) {
    console.error('Error initiating multipart upload:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate multipart upload',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/staff/events/[eventId]/upload-logic-project/multipart
 * Complete multipart upload — validate parts, create Airtable record
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
    const { projectType, uploadId, r2Key, filename, fileSizeBytes, parts } = await request.json();

    if (!projectType || !['schulsong', 'minimusiker'].includes(projectType)) {
      return NextResponse.json(
        { error: 'projectType must be "schulsong" or "minimusiker"' },
        { status: 400 }
      );
    }

    if (!uploadId || !r2Key || !filename || !parts || !Array.isArray(parts)) {
      return NextResponse.json(
        { error: 'uploadId, r2Key, filename, and parts array are required' },
        { status: 400 }
      );
    }

    const r2Service = getR2Service();

    // Complete the multipart upload — R2 validates ETags and part integrity
    await r2Service.completeMultipartUpload(r2Key, uploadId, parts);

    // Verify the assembled file exists
    const fileExists = await r2Service.fileExists(r2Key);
    if (!fileExists) {
      return NextResponse.json(
        { error: 'File assembly failed — file not found after completion' },
        { status: 500 }
      );
    }

    // Create audio file record (same logic as existing PUT handler)
    const teacherService = getTeacherService();
    const audioFile = await teacherService.createAudioFile({
      eventId,
      type: audioFileTypeFromProjectType(projectType as LogicProjectType),
      r2Key,
      filename,
      uploadedBy: session.staffId,
      fileSizeBytes,
      status: 'ready',
    });

    // Auto-assign engineer based on project type
    try {
      await getAirtableService().autoAssignEngineerForUpload(eventId, projectType === 'schulsong');
    } catch (error) {
      console.error('Error auto-assigning engineer:', error);
    }

    // Notify the appropriate engineer for this specific upload type
    notifyEngineerOfUpload(eventId, projectType as 'schulsong' | 'minimusiker').catch(err =>
      console.error('Engineer notification error:', err)
    );
    // Update pipeline stage when any project is uploaded
    await getAirtableService().updateEventAudioPipelineStage(eventId, 'staff_uploaded');

    return NextResponse.json({
      success: true,
      audioFile,
    });
  } catch (error) {
    console.error('Error completing multipart upload:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete multipart upload',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/staff/events/[eventId]/upload-logic-project/multipart
 * Abort a multipart upload — cleans up partial parts in R2
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyStaffSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { uploadId, r2Key } = await request.json();

    if (!uploadId || !r2Key) {
      return NextResponse.json(
        { error: 'uploadId and r2Key are required' },
        { status: 400 }
      );
    }

    const r2Service = getR2Service();
    await r2Service.abortMultipartUpload(r2Key, uploadId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error aborting multipart upload:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to abort multipart upload',
      },
      { status: 500 }
    );
  }
}
