import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffSession } from '@/lib/auth/verifyStaffSession';
import { getTeacherService } from '@/lib/services/teacherService';

/**
 * GET /api/staff/events/[eventId]/logic-projects
 * Get upload status for both Logic Pro project types
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyStaffSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);

    const teacherService = getTeacherService();
    const allFiles = await teacherService.getAudioFilesByEventId(eventId);

    // Find the latest file for each project type
    const schulsongFiles = allFiles
      .filter(f => f.type === 'logic-project-schulsong')
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    const minimusikerFiles = allFiles
      .filter(f => f.type === 'logic-project-minimusiker')
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    const schulsong = schulsongFiles[0];
    const minimusiker = minimusikerFiles[0];

    return NextResponse.json({
      success: true,
      projects: {
        schulsong: schulsong
          ? {
              status: 'uploaded',
              filename: schulsong.filename,
              fileSizeBytes: schulsong.fileSizeBytes,
              uploadedAt: schulsong.uploadedAt,
            }
          : { status: 'pending' },
        minimusiker: minimusiker
          ? {
              status: 'uploaded',
              filename: minimusiker.filename,
              fileSizeBytes: minimusiker.fileSizeBytes,
              uploadedAt: minimusiker.uploadedAt,
            }
          : { status: 'pending' },
      },
    });
  } catch (error) {
    console.error('Error fetching logic project status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch project status',
      },
      { status: 500 }
    );
  }
}
