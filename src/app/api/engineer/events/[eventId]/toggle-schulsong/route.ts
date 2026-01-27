import { NextRequest, NextResponse } from 'next/server';
import { verifyEngineerSession } from '@/lib/auth/verifyEngineerSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherService } from '@/lib/services/teacherService';

/**
 * POST /api/engineer/events/[eventId]/toggle-schulsong
 * Toggle is_schulsong on an AudioFile record
 *
 * Request body: { audioFileRecordId: string, isSchulsong: boolean }
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
    const { audioFileRecordId, isSchulsong } = await request.json();

    if (!audioFileRecordId || typeof audioFileRecordId !== 'string') {
      return NextResponse.json(
        { error: 'audioFileRecordId is required' },
        { status: 400 }
      );
    }

    if (typeof isSchulsong !== 'boolean') {
      return NextResponse.json(
        { error: 'isSchulsong must be a boolean' },
        { status: 400 }
      );
    }

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

    // Verify event has schulsong feature enabled
    const eventIsSchulsong = await getAirtableService().getEventIsSchulsong(eventId);
    if (!eventIsSchulsong) {
      return NextResponse.json(
        { error: 'This event does not have the Schulsong feature enabled' },
        { status: 400 }
      );
    }

    // Update the audio file's is_schulsong field
    const teacherService = getTeacherService();
    const updatedFile = await teacherService.updateAudioFile(audioFileRecordId, {
      isSchulsong,
    });

    return NextResponse.json({
      success: true,
      audioFile: updatedFile,
      message: isSchulsong ? 'Marked as Schulsong' : 'Unmarked as Schulsong',
    });
  } catch (error) {
    console.error('Error toggling schulsong:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle schulsong',
      },
      { status: 500 }
    );
  }
}
