import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffSession } from '@/lib/auth/verifyStaffSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import { getR2Service } from '@/lib/services/r2Service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/staff/events/[eventId]/audio-downloads/[fileId]
 * Download or stream a single audio track via signed R2 URL.
 *
 * ?stream=1 — returns JSON { url } for audio element playback.
 * Default   — redirects with Content-Disposition for download.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string; fileId: string } }
) {
  try {
    const session = verifyStaffSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const fileId = params.fileId;
    const teacherService = getTeacherService();

    // Fetch audio files for this event and find the requested one
    const allAudioFiles = await teacherService.getAudioFilesByEventId(eventId);
    const audioFile = allAudioFiles.find(
      (f) => f.id === fileId && f.type === 'final' && f.status === 'ready'
    );

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file not found or not available' },
        { status: 404 }
      );
    }

    const r2Service = getR2Service();

    // Read-time guard: refuse to silently serve a raw .wav.
    if (!audioFile.mp3R2Key && audioFile.r2Key.toLowerCase().endsWith('.wav')) {
      console.error('[staff audio-downloads] mp3R2Key missing for WAV source', {
        audioFileId: audioFile.id,
        r2Key: audioFile.r2Key,
        eventId,
        classId: audioFile.classId,
        songId: audioFile.songId,
      });
      return NextResponse.json(
        {
          error: 'Audio wird gerade verarbeitet. Bitte in einigen Minuten erneut versuchen.',
          code: 'mp3_not_ready',
        },
        { status: 503 }
      );
    }

    // Prefer mp3R2Key over r2Key (mp3 is smaller, faster to stream/download)
    const r2Key = audioFile.mp3R2Key || audioFile.r2Key;

    // Stream mode
    const isStream = request.nextUrl.searchParams.get('stream') === '1';
    if (isStream) {
      const streamUrl = await r2Service.generateSignedUrl(r2Key, 3600);
      return NextResponse.json({ url: streamUrl });
    }

    // Download mode — build filename from class name
    let baseName: string;
    if (audioFile.isSchulsong) {
      baseName = 'Schulsong';
    } else {
      const eventDetail = await getAirtableService().getSchoolEventDetail(eventId);
      const matchingClass = eventDetail?.classes.find(c => c.classId === audioFile.classId);
      baseName = matchingClass?.className ?? 'Track';
    }

    const extension = r2Key.endsWith('.wav') ? '.wav' : '.mp3';
    const downloadFilename = `${baseName}${extension}`;
    const signedUrl = await r2Service.generateSignedUrl(r2Key, 3600, downloadFilename);

    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error('Error generating staff audio download URL:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to generate download URL' },
      { status: 500 }
    );
  }
}
