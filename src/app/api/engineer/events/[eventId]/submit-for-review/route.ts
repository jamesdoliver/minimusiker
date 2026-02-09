import { NextRequest, NextResponse } from 'next/server';
import { verifyEngineerSession } from '@/lib/auth/verifyEngineerSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/engineer/events/[eventId]/submit-for-review
 * Explicitly submit event for review after engineer has uploaded finals.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyEngineerSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);

    // Verify event exists and check current pipeline stage
    const airtableService = getAirtableService();
    const event = await airtableService.getEventByEventId(eventId);
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.audio_pipeline_stage === 'approved') {
      return NextResponse.json(
        { error: 'Event has already been approved' },
        { status: 400 }
      );
    }

    // Fetch songs and audio files for completeness check
    const teacherService = getTeacherService();
    const [allSongs, allAudioFiles] = await Promise.all([
      teacherService.getSongsByEventId(eventId),
      teacherService.getAudioFilesByEventId(eventId),
    ]);

    const finalFiles = allAudioFiles.filter(f => f.type === 'final');

    if (finalFiles.length === 0) {
      return NextResponse.json(
        { error: 'No final files uploaded yet' },
        { status: 400 }
      );
    }

    // Compute completeness: count classes with finals vs total classes with songs
    const classIdsWithSongs = new Set(allSongs.map(s => s.classId));
    const classIdsWithFinal = new Set(finalFiles.map(f => f.classId));
    const totalClasses = classIdsWithSongs.size;
    const classesWithFinals = [...classIdsWithSongs].filter(cid => classIdsWithFinal.has(cid)).length;

    // Set stage to ready_for_review
    await airtableService.updateEventAudioPipelineStage(eventId, 'ready_for_review');

    return NextResponse.json({
      success: true,
      classesWithFinals,
      totalClasses,
    });
  } catch (error) {
    console.error('Error submitting for review:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit for review',
      },
      { status: 500 }
    );
  }
}
