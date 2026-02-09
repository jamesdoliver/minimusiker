import { NextRequest, NextResponse } from 'next/server';
import { verifyEngineerSession } from '@/lib/auth/verifyEngineerSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/engineer/events/[eventId]/download-urls
 * Returns presigned R2 URLs for raw audio files so the client can
 * build the ZIP in-browser, bypassing Vercel response-size limits.
 * Optional query param: classId - filter to specific class
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
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');

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

    // Get event details for filename + class names
    const eventDetail = await getAirtableService().getSchoolEventDetail(eventId);
    if (!eventDetail) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Get audio files
    const teacherService = getTeacherService();
    let audioFiles = await teacherService.getAudioFilesByEventId(eventId);

    // Filter to raw files only
    audioFiles = audioFiles.filter((f) => f.type === 'raw');

    // Filter by class if specified
    if (classId) {
      audioFiles = audioFiles.filter((f) => f.classId === classId);
    }

    if (audioFiles.length === 0) {
      return NextResponse.json(
        { error: 'No raw audio files found' },
        { status: 404 }
      );
    }

    // Build class name lookup
    const classMap = new Map<string, string>();
    eventDetail.classes.forEach((cls) => {
      classMap.set(cls.classId, cls.className);
    });

    // Generate presigned URLs for each file (1-hour expiry)
    const r2Service = getR2Service();
    const files = await Promise.all(
      audioFiles.map(async (file) => {
        const url = await r2Service.generateSignedUrl(file.r2Key, 3600);
        const className = classMap.get(file.classId) || file.classId;
        const safeName = className
          .replace(/[^a-zA-Z0-9-_\s]/g, '')
          .replace(/\s+/g, '_');
        const path = `${safeName}/${file.filename}`;

        return {
          url,
          filename: file.filename,
          path,
          fileSizeBytes: file.fileSizeBytes || 0,
        };
      })
    );

    // Generate ZIP filename (same logic as download-zip route)
    const schoolSlug = eventDetail.schoolName
      .replace(/[^a-zA-Z0-9-_\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 30);
    const dateStr = eventDetail.eventDate || 'no-date';
    const zipFilename = classId
      ? `${schoolSlug}_${classId}_raw_audio.zip`
      : `${schoolSlug}_${dateStr}_raw_audio.zip`;

    const totalSizeBytes = files.reduce((sum, f) => sum + f.fileSizeBytes, 0);

    return NextResponse.json({
      success: true,
      files,
      zipFilename,
      totalSizeBytes,
    });
  } catch (error) {
    console.error('Error generating download URLs:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate download URLs',
      },
      { status: 500 }
    );
  }
}
