import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffSession } from '@/lib/auth/verifyStaffSession';
import { getR2Service } from '@/lib/services/r2Service';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import { AudioFileType } from '@/lib/types/teacher';

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

type LogicProjectType = 'schulsong' | 'minimusiker';

function audioFileTypeFromProjectType(projectType: LogicProjectType): AudioFileType {
  return projectType === 'schulsong' ? 'logic-project-schulsong' : 'logic-project-minimusiker';
}

/**
 * POST /api/staff/events/[eventId]/upload-logic-project
 * Generate presigned URL for Logic Pro project ZIP upload
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

    if (fileSizeBytes && fileSizeBytes > MAX_FILE_SIZE) {
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
    const { uploadUrl, key } = await r2Service.generateLogicProjectUploadUrl(
      eventId,
      projectType as LogicProjectType,
      filename
    );

    return NextResponse.json({
      success: true,
      uploadUrl,
      r2Key: key,
    });
  } catch (error) {
    console.error('Error generating logic project upload URL:', error);
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
 * PUT /api/staff/events/[eventId]/upload-logic-project
 * Confirm upload completion and create audio file record
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
    const { projectType, r2Key, filename, fileSizeBytes } = await request.json();

    if (!projectType || !['schulsong', 'minimusiker'].includes(projectType)) {
      return NextResponse.json(
        { error: 'projectType must be "schulsong" or "minimusiker"' },
        { status: 400 }
      );
    }

    if (!r2Key || !filename) {
      return NextResponse.json(
        { error: 'r2Key and filename are required' },
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

    // Create audio file record
    const teacherService = getTeacherService();
    const audioFile = await teacherService.createAudioFile({
      classId: '', // event-level, no class
      eventId,
      type: audioFileTypeFromProjectType(projectType),
      r2Key,
      filename,
      uploadedBy: session.staffId,
      fileSizeBytes,
      status: 'ready',
    });

    // Check if both project types now exist
    const allFiles = await teacherService.getAudioFilesByEventId(eventId);
    const hasSchulsong = allFiles.some(f => f.type === 'logic-project-schulsong');
    const hasMinimusiker = allFiles.some(f => f.type === 'logic-project-minimusiker');
    const bothUploaded = hasSchulsong && hasMinimusiker;

    if (bothUploaded) {
      await getAirtableService().updateEventAudioPipelineStage(eventId, 'in_progress');
    }

    return NextResponse.json({
      success: true,
      audioFile,
      bothUploaded,
    });
  } catch (error) {
    console.error('Error confirming logic project upload:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to confirm upload',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/staff/events/[eventId]/upload-logic-project
 * Delete a logic project for re-upload
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

    const eventId = decodeURIComponent(params.eventId);
    const { projectType } = await request.json();

    if (!projectType || !['schulsong', 'minimusiker'].includes(projectType)) {
      return NextResponse.json(
        { error: 'projectType must be "schulsong" or "minimusiker"' },
        { status: 400 }
      );
    }

    const fileType = audioFileTypeFromProjectType(projectType);

    // Find the audio file record for this project type
    const teacherService = getTeacherService();
    const allFiles = await teacherService.getAudioFilesByEventId(eventId);
    const projectFile = allFiles.find(f => f.type === fileType);

    if (!projectFile) {
      return NextResponse.json(
        { error: 'No project file found for this type' },
        { status: 404 }
      );
    }

    // Delete from R2
    const r2Service = getR2Service();
    await r2Service.deleteFile(projectFile.r2Key);

    // Delete Airtable record
    await teacherService.deleteAudioFile(projectFile.id);

    // Check remaining projects — only revert pipeline if BOTH are now deleted
    const remainingFiles = await teacherService.getAudioFilesByEventId(eventId);
    const hasSchulsong = remainingFiles.some(f => f.type === 'logic-project-schulsong');
    const hasMinimusiker = remainingFiles.some(f => f.type === 'logic-project-minimusiker');

    if (!hasSchulsong && !hasMinimusiker) {
      await getAirtableService().updateEventAudioPipelineStage(eventId, 'not_started');
    }

    return NextResponse.json({
      success: true,
      message: 'Logic project deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting logic project:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete project',
      },
      { status: 500 }
    );
  }
}
