import { NextRequest, NextResponse } from 'next/server';
import { verifyEngineerSession } from '@/lib/auth/verifyEngineerSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherService } from '@/lib/services/teacherService';
import { EngineerEventSummary, EngineerMixingStatus } from '@/lib/types/engineer';

export const dynamic = 'force-dynamic';

/**
 * GET /api/engineer/events
 * Get all events assigned to the authenticated engineer
 */
export async function GET(request: NextRequest) {
  try {
    const session = verifyEngineerSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get events assigned to this engineer
    const events = await getAirtableService().getSchoolEventSummariesByEngineer(
      session.engineerId
    );

    // Get audio file counts for each event to determine mixing status
    const teacherService = getTeacherService();

    const eventsWithStatus: EngineerEventSummary[] = await Promise.all(
      events.map(async (event) => {
        // Get all audio files for this event
        const audioFiles = await teacherService.getAudioFilesByEventId(event.eventId);

        const rawAudioCount = audioFiles.filter((f) => f.type === 'raw').length;
        const hasPreview = audioFiles.some((f) => f.type === 'preview');
        const hasFinal = audioFiles.some((f) => f.type === 'final');

        // Determine mixing status based on audio files
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
      })
    );

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
