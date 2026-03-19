import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teacher/events/[eventId]/audio-downloads/[fileId]
 * Download a single audio track by redirecting to a signed R2 URL.
 *
 * The file must be type=final and status=ready. The browser receives a
 * redirect with a Content-Disposition header that suggests a friendly
 * filename derived from the class name (or "Schulsong").
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; fileId: string }> }
) {
  try {
    // 1. Auth
    const session = verifyTeacherSession(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId: rawEventId, fileId } = await params;
    const eventId = decodeURIComponent(rawEventId);
    const teacherService = getTeacherService();

    // 2. Event access
    const event = await teacherService.getTeacherEventDetail(eventId, session.email);

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found or you do not have access to this event' },
        { status: 404 }
      );
    }

    // 3. Fetch audio files and find the requested one
    const allAudioFiles = await teacherService.getAudioFilesByEventId(eventId);
    const audioFile = allAudioFiles.find(
      (f) => f.id === fileId && f.type === 'final' && f.status === 'ready'
    );

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file not found or not available for download' },
        { status: 404 }
      );
    }

    // 4. Build download filename
    let baseName: string;
    if (audioFile.isSchulsong) {
      baseName = 'Schulsong';
    } else {
      const matchingClass = event.classes.find((c) => c.classId === audioFile.classId);
      baseName = matchingClass?.className ?? 'Track';
    }

    const extension = audioFile.r2Key.endsWith('.wav') ? '.wav' : '.mp3';
    const downloadFilename = `${baseName}${extension}`;

    // 5. Generate signed URL with download disposition
    const r2Service = getR2Service();
    const signedUrl = await r2Service.generateSignedUrl(audioFile.r2Key, 3600, downloadFilename);

    // 6. Redirect
    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error('Error generating audio download URL:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate download URL',
      },
      { status: 500 }
    );
  }
}
