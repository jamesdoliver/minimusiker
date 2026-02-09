import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffSession } from '@/lib/auth/verifyStaffSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/staff/events/[eventId]/audio-files
 * Get all audio files for an event with signed URLs
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

    // Verify event exists
    const eventDetail = await getAirtableService().getSchoolEventDetail(eventId);
    if (!eventDetail) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Get audio files from Airtable
    const teacherService = getTeacherService();
    const audioFiles = await teacherService.getAudioFilesByEventId(eventId);

    // Generate signed URLs for each file
    const r2Service = getR2Service();
    const filesWithUrls = await Promise.all(
      audioFiles.map(async (file) => {
        let signedUrl: string | null = null;
        try {
          if (await r2Service.fileExists(file.r2Key)) {
            signedUrl = await r2Service.getRawAudioUrl(file.r2Key);
          }
        } catch (err) {
          console.error(`Error generating URL for ${file.r2Key}:`, err);
        }
        return {
          ...file,
          signedUrl,
        };
      })
    );

    return NextResponse.json({
      success: true,
      audioFiles: filesWithUrls,
    });
  } catch (error) {
    console.error('Error fetching audio files:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch audio files',
      },
      { status: 500 }
    );
  }
}
