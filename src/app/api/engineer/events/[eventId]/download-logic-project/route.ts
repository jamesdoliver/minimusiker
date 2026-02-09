import { NextRequest, NextResponse } from 'next/server';
import { verifyEngineerSession } from '@/lib/auth/verifyEngineerSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/engineer/events/[eventId]/download-logic-project?projectType=schulsong|minimusiker
 * Generate signed download URL for a Logic Pro project ZIP
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyEngineerSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);

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

    const projectType = request.nextUrl.searchParams.get('projectType');
    if (!projectType || !['schulsong', 'minimusiker'].includes(projectType)) {
      return NextResponse.json(
        { error: 'projectType query param must be "schulsong" or "minimusiker"' },
        { status: 400 }
      );
    }

    const fileType = projectType === 'schulsong'
      ? 'logic-project-schulsong'
      : 'logic-project-minimusiker';

    // Find the audio file record
    const teacherService = getTeacherService();
    const allFiles = await teacherService.getAudioFilesByEventId(eventId);
    const projectFile = allFiles.find(f => f.type === fileType);

    if (!projectFile) {
      return NextResponse.json(
        { error: 'No project file found for this type' },
        { status: 404 }
      );
    }

    // Generate signed download URL (3-hour expiry)
    const r2Service = getR2Service();
    const downloadUrl = await r2Service.generateLogicProjectDownloadUrl(projectFile.r2Key);

    return NextResponse.json({
      success: true,
      downloadUrl,
      filename: projectFile.filename,
      fileSizeBytes: projectFile.fileSizeBytes,
    });
  } catch (error) {
    console.error('Error generating logic project download URL:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate download URL',
      },
      { status: 500 }
    );
  }
}
