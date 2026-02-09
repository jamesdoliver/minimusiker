import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';
import { AudioStatusData, TrackApprovalInfo, AdminApprovalStatus } from '@/lib/types/audio-status';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/events/[eventId]/audio-status
 * Get audio status data for an event, including track approval info
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);

    // Get event details
    const airtableService = getAirtableService();
    const eventDetail = await airtableService.getSchoolEventDetail(eventId);
    if (!eventDetail) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Use the resolved event_id (handles SimplyBook ID → real event_id resolution)
    const resolvedEventId = eventDetail.eventId;

    // Get songs for this event
    const teacherService = getTeacherService();
    const songs = await teacherService.getSongsByEventId(resolvedEventId);

    // Get audio files for this event
    const audioFiles = await teacherService.getAudioFilesByEventId(resolvedEventId);

    // Get R2 service for generating signed URLs
    const r2Service = getR2Service();

    // Build track approval info
    const tracks: TrackApprovalInfo[] = [];

    for (const song of songs) {
      // Find raw and final audio files for this song
      const songAudioFiles = audioFiles.filter(f => f.songId === song.id);
      const rawFile = songAudioFiles.find(f => f.type === 'raw');
      const finalFile = songAudioFiles.find(f => f.type === 'final');

      // Find class name
      const classDetail = eventDetail.classes.find(c => c.classId === song.classId);

      // Generate signed URL for final audio if exists
      let finalAudioUrl: string | undefined;
      if (finalFile?.r2Key) {
        try {
          finalAudioUrl = await r2Service.generateSignedUrl(finalFile.r2Key, 3600); // 1 hour expiry
        } catch (err) {
          console.error(`Error generating URL for ${finalFile.r2Key}:`, err);
        }
      }

      tracks.push({
        audioFileId: finalFile?.id || '',
        songId: song.id,
        songTitle: song.title,
        className: classDetail?.className || song.classId,
        classId: song.classId,
        hasRawAudio: !!rawFile,
        hasFinalAudio: !!finalFile,
        approvalStatus: finalFile?.approvalStatus || 'pending',
        rejectionComment: finalFile?.rejectionComment,
        finalAudioUrl,
        finalAudioR2Key: finalFile?.r2Key,
        isSchulsong: finalFile?.isSchulsong,
      });
    }

    // Schulsong is managed separately via /admin/events/[eventId]/approve-schulsong
    // and /admin/events/[eventId]/schulsong-status — excluded from this modal.

    // Calculate counts
    const expectedSongCount = songs.length;
    const staffUploadedCount = tracks.filter(t => t.hasRawAudio).length;
    const mixMasterUploadedCount = tracks.filter(t => t.hasFinalAudio).length;
    // For schulsong-only events (0 songs), upload gates pass if a schulsong final exists
    const hasSchulsongFinal = audioFiles.some(f => f.isSchulsong && f.type === 'final');
    const hasSchulsongOnly = expectedSongCount === 0 && hasSchulsongFinal;
    const staffUploadComplete = hasSchulsongOnly || (staffUploadedCount >= expectedSongCount && expectedSongCount > 0);
    const mixMasterUploadComplete = hasSchulsongOnly || (mixMasterUploadedCount >= expectedSongCount && expectedSongCount > 0);

    // Check if all tracks are approved
    const tracksWithFinal = tracks.filter(t => t.hasFinalAudio);
    const allTracksApproved = tracksWithFinal.length > 0 &&
      tracksWithFinal.every(t => t.approvalStatus === 'approved');

    // Determine overall approval status
    let approvalStatus: AdminApprovalStatus = 'pending';
    if (allTracksApproved) {
      approvalStatus = 'approved';
    } else if (mixMasterUploadComplete) {
      approvalStatus = 'ready_for_approval';
    }

    const statusData: AudioStatusData = {
      expectedSongCount,
      staffUploadedCount,
      mixMasterUploadedCount,
      staffUploadComplete,
      mixMasterUploadComplete,
      approvalStatus,
      allTracksApproved,
      tracks,
    };

    return NextResponse.json({
      success: true,
      data: statusData,
    });
  } catch (error) {
    console.error('Error fetching audio status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch audio status',
      },
      { status: 500 }
    );
  }
}
