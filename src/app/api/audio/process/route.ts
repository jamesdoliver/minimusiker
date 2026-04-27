import { NextRequest, NextResponse } from 'next/server';
import { verifyEngineerSession } from '@/lib/auth/verifyEngineerSession';
import { processAudioFile } from '@/lib/services/audioProcessingService';
import { getTeacherService } from '@/lib/services/teacherService';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * POST /api/audio/process
 * Process an uploaded audio file: encode WAV→MP3 and generate 10-second preview snippet.
 * Called per-file after engineer batch upload confirmation.
 *
 * On success: processAudioFile sets the AudioFile record to status='ready' (with mp3R2Key set).
 * On failure: this route flips matching AudioFile records to status='error' so the engineer
 *             UI can surface a clear retry affordance instead of leaving them stuck in 'processing'.
 */
export async function POST(request: NextRequest) {
  let parsedBody: { eventId?: string; classId?: string; songId?: string; r2Key?: string; displayName?: string } = {};
  try {
    const session = verifyEngineerSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    parsedBody = await request.json();
    const { eventId, classId, songId, r2Key, displayName } = parsedBody;

    if (!eventId || !classId || !r2Key) {
      return NextResponse.json(
        { error: 'eventId, classId, and r2Key are required' },
        { status: 400 }
      );
    }

    // songId is optional: per-song uploads include it, schulsong finals do not.
    const result = await processAudioFile(r2Key, eventId, classId, songId || null, displayName);

    return NextResponse.json({
      success: true,
      mp3Key: result.mp3Key,
      previewKey: result.previewKey,
      durationSeconds: result.durationSeconds,
    });
  } catch (error) {
    console.error('Error processing audio file:', error);

    // Mark every AudioFile pointing at this r2Key as 'error' so the engineer UI
    // can show a retry button. Best-effort; processAudioFile's lookup already
    // covered one record, but duplicates (multiple AudioFiles for same r2Key)
    // would be left in 'processing' otherwise.
    if (parsedBody.r2Key && parsedBody.classId) {
      try {
        const teacherService = getTeacherService();
        const candidates = parsedBody.songId
          ? await teacherService.getAudioFilesBySongId(parsedBody.songId, 'final')
          : (await teacherService.getAudioFilesByClassId(parsedBody.classId)).filter(af => af.type === 'final');
        const matching = candidates.filter(af => af.r2Key === parsedBody.r2Key && af.status !== 'ready');
        for (const af of matching) {
          await teacherService.updateAudioFile(af.id, { status: 'error' });
        }
      } catch (markErr) {
        console.error('Failed to mark AudioFile records as error:', markErr);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process audio file',
      },
      { status: 500 }
    );
  }
}
