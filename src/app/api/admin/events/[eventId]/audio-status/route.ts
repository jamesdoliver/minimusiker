import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';
import { AudioStatusData, TrackApprovalInfo, AdminApprovalStatus } from '@/lib/types/audio-status';

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

    // Get songs for this event
    const teacherService = getTeacherService();
    const songs = await teacherService.getSongsByEventId(eventId);

    // Get audio files for this event
    const audioFiles = await teacherService.getAudioFilesByEventId(eventId);

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

    // Calculate counts
    const expectedSongCount = songs.length;
    const staffUploadedCount = tracks.filter(t => t.hasRawAudio).length;
    const mixMasterUploadedCount = tracks.filter(t => t.hasFinalAudio).length;
    const staffUploadComplete = staffUploadedCount >= expectedSongCount && expectedSongCount > 0;
    const mixMasterUploadComplete = mixMasterUploadedCount >= expectedSongCount && expectedSongCount > 0;

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
