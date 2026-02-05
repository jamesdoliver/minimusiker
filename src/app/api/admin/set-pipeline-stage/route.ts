import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';

const VALID_STAGES = ['not_started', 'in_progress', 'ready_for_review', 'approved'] as const;
type PipelineStage = typeof VALID_STAGES[number];

/**
 * POST /api/admin/set-pipeline-stage
 * Manually set the audio pipeline stage for an event.
 *
 * Request body: { eventId: string, stage: PipelineStage }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { eventId, stage } = await request.json();

    if (!eventId || typeof eventId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'eventId is required' },
        { status: 400 }
      );
    }

    if (!stage || !VALID_STAGES.includes(stage as PipelineStage)) {
      return NextResponse.json(
        { success: false, error: `stage must be one of: ${VALID_STAGES.join(', ')}` },
        { status: 400 }
      );
    }

    const airtableService = getAirtableService();

    // Verify event exists
    const event = await airtableService.getEventByEventId(eventId);
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    await airtableService.updateEventAudioPipelineStage(eventId, stage as PipelineStage);

    return NextResponse.json({
      success: true,
      message: `Pipeline stage set to "${stage}" for event ${eventId}`,
    });
  } catch (error) {
    console.error('Error setting pipeline stage:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set pipeline stage',
      },
      { status: 500 }
    );
  }
}
