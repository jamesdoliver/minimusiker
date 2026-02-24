import { NextRequest, NextResponse } from 'next/server';
import { verifyEngineerSession } from '@/lib/auth/verifyEngineerSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherService } from '@/lib/services/teacherService';
import { EngineerEventSummary, EngineerMixingStatus } from '@/lib/types/engineer';

export const dynamic = 'force-dynamic';

/**
 * GET /api/engineer/events
 * Get all events assigned to the authenticated engineer.
 *
 * Optimized: Uses targeted engineer query + batched audio file lookup.
 * ~3-5 Airtable calls total (down from ~100).
 */
export async function GET(request: NextRequest) {
  try {
    const session = verifyEngineerSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Optimized: single query for only this engineer's events
    const events = await getAirtableService().getEngineerEventSummaries(
      session.engineerId
    );

    if (events.length === 0) {
      return NextResponse.json({
        success: true,
        events: [],
      });
    }

    // Batch audio file query: single OR formula for all event IDs
    const teacherService = getTeacherService();
    const eventIds = events.map((e) => e.eventId);
    const allAudioFiles = await teacherService.batchGetAudioFilesByEventIds(eventIds);

    // Group audio files by event_id
    const audioByEvent = new Map<string, typeof allAudioFiles>();
    for (const file of allAudioFiles) {
      const existing = audioByEvent.get(file.eventId) || [];
      existing.push(file);
      audioByEvent.set(file.eventId, existing);
    }

    // Build response with mixing status
    const eventsWithStatus: EngineerEventSummary[] = events.map((event) => {
      const audioFiles = audioByEvent.get(event.eventId) || [];

      const rawAudioCount = audioFiles.filter((f) => f.type === 'raw').length;
      const hasPreview = audioFiles.some((f) => f.type === 'preview');
      const hasFinal = audioFiles.some((f) => f.type === 'final');

      let mixingStatus: EngineerMixingStatus = 'pending';
      if (hasFinal && hasPreview) {
        mixingStatus = 'completed';
      } else if (hasPreview || (rawAudioCount > 0 && audioFiles.some((f) => f.type !== 'raw'))) {
        mixingStatus = 'in-progress';
      }

      return {
        eventId: event.eventId,
        schoolName: event.schoolName,
        eventDate: event.eventDate,
        eventType: event.eventType,
        classCount: event.classCount,
        rawAudioCount,
        hasPreview,
        hasFinal,
        mixingStatus,
      };
    });

    return NextResponse.json({
      success: true,
      events: eventsWithStatus,
    });
  } catch (error) {
    console.error('Error fetching engineer events:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch events',
      },
      { status: 500 }
    );
  }
}
