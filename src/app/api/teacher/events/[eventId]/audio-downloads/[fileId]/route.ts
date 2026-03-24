import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teacher/events/[eventId]/audio-downloads/[fileId]
 * Download or stream a single audio track via a signed R2 URL.
 *
 * Prefers mp3R2Key over r2Key for smaller/faster delivery.
 *
 * ?stream=1 — returns JSON { url } for audio element playback.
 * Default  — redirects with Content-Disposition to trigger download.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string; fileId: string }> }
) {
  try {
    const session = verifyTeacherSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId: rawEventId, fileId } = await params;
    const eventId = decodeURIComponent(rawEventId);
    const teacherService = getTeacherService();

    const event = await teacherService.getTeacherEventDetail(eventId, session.email);
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found or you do not have access to this event' },
        { status: 404 }
      );
    }

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

    const r2Service = getR2Service();

    // Prefer mp3R2Key over r2Key (mp3 is smaller, faster to stream/download)
    const r2Key = audioFile.mp3R2Key || audioFile.r2Key;

    // Stream mode: return signed URL as JSON
    const isStream = request.nextUrl.searchParams.get('stream') === '1';
    if (isStream) {
      const streamUrl = await r2Service.generateSignedUrl(r2Key, 3600);
      return NextResponse.json({ url: streamUrl });
    }

    // Download mode: build "SongTitle - ClassName.mp3" filename
    let baseName: string;
    if (audioFile.isSchulsong) {
      baseName = 'Schulsong';
    } else {
      const matchingClass = event.classes.find((c) => c.classId === audioFile.classId);
      const className = matchingClass?.className ?? 'Track';

      // Resolve song title
      const song = audioFile.songId && matchingClass
        ? matchingClass.songs.find((s) => s.id === audioFile.songId)
        : matchingClass && matchingClass.songs.length === 1
          ? matchingClass.songs[0]
          : undefined;

      baseName = song?.title
        ? `${song.title} - ${className}`
        : className;
    }

    const extension = r2Key.endsWith('.wav') ? '.wav' : '.mp3';
    const downloadFilename = `${baseName}${extension}`;
    const signedUrl = await r2Service.generateSignedUrl(r2Key, 3600, downloadFilename);

    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error('Error generating audio download URL:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to generate download URL' },
      { status: 500 }
    );
  }
}
