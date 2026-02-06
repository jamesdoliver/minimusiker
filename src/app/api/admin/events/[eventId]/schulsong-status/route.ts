import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';

/**
 * GET /api/admin/events/[eventId]/schulsong-status
 * Returns schulsong status for the admin event page
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const airtableService = getAirtableService();
    const teacherService = getTeacherService();

    // Resolve event
    const eventDetail = await airtableService.getSchoolEventDetail(eventId);
    const resolvedEventId = eventDetail?.eventId || eventId;

    // Get event record for schulsong_released_at
    const event = await airtableService.getEventByEventId(resolvedEventId);

    // Find the schulsong audio file
    const schulsongFile = await teacherService.getSchulsongAudioFile(resolvedEventId);

    if (!schulsongFile) {
      return NextResponse.json({
        success: true,
        hasSchulsong: !!event?.is_schulsong,
      });
    }

    // Generate signed URL for playback
    let audioUrl: string | undefined;
    if (schulsongFile.r2Key) {
      try {
        const r2Service = getR2Service();
        audioUrl = await r2Service.generateSignedUrl(schulsongFile.r2Key, 3600);
      } catch (err) {
        console.error('Error generating schulsong signed URL:', err);
      }
    }

    return NextResponse.json({
      success: true,
      hasSchulsong: true,
      schulsongFile: {
        audioFileId: schulsongFile.id,
        filename: schulsongFile.filename,
        approvalStatus: schulsongFile.approvalStatus || 'pending',
        rejectionComment: schulsongFile.rejectionComment,
        teacherApprovedAt: schulsongFile.teacherApprovedAt,
        audioUrl,
      },
      releasedAt: event?.schulsong_released_at || undefined,
    });
  } catch (error) {
    console.error('Error fetching schulsong status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch schulsong status' },
      { status: 500 }
    );
  }
}
