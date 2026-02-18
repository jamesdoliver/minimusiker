import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/events/[eventId]/replace-audio
 * Generate a presigned upload URL for replacing an existing audio file.
 * Body: { audioFileId: string, filename: string, contentType: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { audioFileId, filename, contentType } = await request.json();

    if (!audioFileId || !filename || !contentType) {
      return NextResponse.json(
        { error: 'audioFileId, filename, and contentType are required' },
        { status: 400 }
      );
    }

    const eventId = decodeURIComponent(params.eventId);

    // Resolve SimplyBook ID → real event_id (handles both formats)
    const airtableService = getAirtableService();
    const eventDetail = await airtableService.getSchoolEventDetail(eventId);
    if (!eventDetail) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    const resolvedEventId = eventDetail.eventId;

    const teacherService = getTeacherService();

    // Look up the existing audio file
    const audioFile = await teacherService.getAudioFileById(audioFileId);
    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 });
    }

    // Verify the audio file belongs to this event
    if (audioFile.eventId !== resolvedEventId) {
      return NextResponse.json({ error: 'Audio file does not belong to this event' }, { status: 403 });
    }

    // Generate a new R2 key for the replacement file
    const r2Service = getR2Service();
    const timestamp = Date.now();
    const ext = filename.split('.').pop()?.toLowerCase() || 'mp3';

    // Build the key based on whether this is a schulsong or regular track
    let newR2Key: string;
    if (audioFile.isSchulsong) {
      newR2Key = `recordings/${resolvedEventId}/schulsong/final/replaced_${timestamp}.${ext}`;
    } else {
      newR2Key = `recordings/${resolvedEventId}/${audioFile.classId}/${audioFile.songId}/final/replaced_${timestamp}.${ext}`;
    }

    const uploadUrl = await r2Service.generatePresignedUploadUrl(newR2Key, contentType);

    return NextResponse.json({
      success: true,
      uploadUrl,
      newR2Key,
      oldR2Key: audioFile.r2Key,
    });
  } catch (error) {
    console.error('Error generating replace upload URL:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/events/[eventId]/replace-audio
 * Confirm upload and update the AudioFile record with the new R2 key.
 * Body: { audioFileId: string, newR2Key: string, filename: string }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { audioFileId, newR2Key, filename } = await request.json();

    if (!audioFileId || !newR2Key || !filename) {
      return NextResponse.json(
        { error: 'audioFileId, newR2Key, and filename are required' },
        { status: 400 }
      );
    }

    const eventId = decodeURIComponent(params.eventId);

    // Resolve SimplyBook ID → real event_id (handles both formats)
    const airtableService = getAirtableService();
    const eventDetail = await airtableService.getSchoolEventDetail(eventId);
    if (!eventDetail) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    const resolvedEventId = eventDetail.eventId;

    const teacherService = getTeacherService();

    // Look up the existing audio file
    const audioFile = await teacherService.getAudioFileById(audioFileId);
    if (!audioFile) {
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 });
    }

    // Verify ownership
    if (audioFile.eventId !== resolvedEventId) {
      return NextResponse.json({ error: 'Audio file does not belong to this event' }, { status: 403 });
    }

    const oldR2Key = audioFile.r2Key;

    // Update the AudioFile record with the new file info
    await teacherService.updateAudioFile(audioFileId, {
      r2Key: newR2Key,
      filename,
    });

    // Delete the old R2 file (cleanup, non-blocking)
    if (oldR2Key) {
      const r2Service = getR2Service();
      await r2Service.deleteFile(oldR2Key).catch(err => {
        console.error(`Failed to delete old R2 file ${oldR2Key}:`, err);
      });
    }

    return NextResponse.json({
      success: true,
      audioFileId,
      newR2Key,
    });
  } catch (error) {
    console.error('Error confirming audio replacement:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to confirm replacement' },
      { status: 500 }
    );
  }
}
