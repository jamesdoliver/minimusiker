import { NextRequest, NextResponse } from 'next/server';
import { verifyEngineerSession } from '@/lib/auth/verifyEngineerSession';
import { processAudioFile } from '@/lib/services/audioProcessingService';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

/**
 * POST /api/audio/process
 * Process an uploaded audio file: encode WAV→MP3 and generate 10-second preview snippet.
 * Called per-file after engineer batch upload confirmation.
 */
export async function POST(request: NextRequest) {
  try {
    const session = verifyEngineerSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId, classId, songId, r2Key } = await request.json();

    if (!eventId || !classId || !songId || !r2Key) {
      return NextResponse.json(
        { error: 'eventId, classId, songId, and r2Key are required' },
        { status: 400 }
      );
    }

    const result = await processAudioFile(r2Key, eventId, classId, songId);

    return NextResponse.json({
      success: true,
      mp3Key: result.mp3Key,
      previewKey: result.previewKey,
      durationSeconds: result.durationSeconds,
    });
  } catch (error) {
    console.error('Error processing audio file:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process audio file',
      },
      { status: 500 }
    );
  }
}
