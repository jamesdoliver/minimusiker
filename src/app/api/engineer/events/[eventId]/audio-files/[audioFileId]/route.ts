import { NextRequest, NextResponse } from 'next/server';
import { verifyEngineerSession } from '@/lib/auth/verifyEngineerSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/engineer/events/[eventId]/audio-files/[audioFileId]
 * Delete a single final audio file (R2 + Airtable record).
 * Auto-reverts pipeline stage from ready_for_review to in_progress if needed.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { eventId: string; audioFileId: string } }
) {
  try {
    const session = verifyEngineerSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const audioFileId = decodeURIComponent(params.audioFileId);

    const teacherService = getTeacherService();

    // Fetch the audio file record
    const audioFile = await teacherService.getAudioFileById(audioFileId);
    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 });
    }

    // Verify the audio file belongs to this event
    if (audioFile.eventId !== eventId) {
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 });
    }

    // Only final files can be deleted by engineers
    if (audioFile.type !== 'final') {
      return NextResponse.json(
        { error: 'Only final audio files can be deleted' },
        { status: 400 }
      );
    }

    // Check pipeline stage — block deletion if already approved
    const airtableService = getAirtableService();
    const event = await airtableService.getEventByEventId(eventId);
    if (event?.audio_pipeline_stage === 'approved') {
      return NextResponse.json(
        { error: 'Cannot delete files after approval' },
        { status: 403 }
      );
    }

    // Delete from R2
    const r2Service = getR2Service();
    await r2Service.deleteFile(audioFile.r2Key);

    // Delete Airtable record
    await teacherService.deleteAudioFile(audioFileId);

    // Auto-revert pipeline stage if currently ready_for_review
    if (event?.audio_pipeline_stage === 'ready_for_review') {
      await airtableService.updateEventAudioPipelineStage(eventId, 'in_progress');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting audio file:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete audio file',
      },
      { status: 500 }
    );
  }
}
