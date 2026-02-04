import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import {
  ApproveTracksRequest,
  ApproveTracksResponse,
  AdminApprovalStatus,
} from '@/lib/types/audio-status';
import { AUDIO_FILES_FIELD_IDS } from '@/lib/types/teacher';

/**
 * POST /api/admin/events/[eventId]/approve-tracks
 * Approve or reject tracks for an event
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

    const eventId = decodeURIComponent(params.eventId);
    const body: ApproveTracksRequest = await request.json();

    if (!body.trackApprovals || !Array.isArray(body.trackApprovals)) {
      return NextResponse.json(
        { error: 'trackApprovals array is required' },
        { status: 400 }
      );
    }

    const teacherService = getTeacherService();
    const updatedTracks: { audioFileId: string; approvalStatus: 'pending' | 'approved' | 'rejected' }[] = [];

    // Update each track's approval status
    for (const approval of body.trackApprovals) {
      if (!approval.audioFileId || !approval.status) {
        continue;
      }

      try {
        await teacherService.updateAudioFileApprovalStatus(
          approval.audioFileId,
          approval.status,
          approval.comment
        );

        updatedTracks.push({
          audioFileId: approval.audioFileId,
          approvalStatus: approval.status,
        });
      } catch (err) {
        console.error(`Error updating track ${approval.audioFileId}:`, err);
      }
    }

    // Re-fetch all audio files for the event to check overall status
    const audioFiles = await teacherService.getAudioFilesByEventId(eventId);
    const finalFiles = audioFiles.filter(f => f.type === 'final');

    // Check if ALL final tracks are approved
    const allTracksApproved = finalFiles.length > 0 &&
      finalFiles.every(f => f.approvalStatus === 'approved');

    // Update event's all_tracks_approved and admin_approval_status
    const airtableService = getAirtableService();
    await airtableService.updateEventApprovalStatus(eventId, allTracksApproved);

    // Determine the overall approval status
    let adminApprovalStatus: AdminApprovalStatus = 'pending';
    if (allTracksApproved) {
      adminApprovalStatus = 'approved';
    } else if (finalFiles.length > 0) {
      adminApprovalStatus = 'ready_for_approval';
    }

    const response: ApproveTracksResponse = {
      success: true,
      allTracksApproved,
      adminApprovalStatus,
      updatedTracks,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error approving tracks:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve tracks',
      },
      { status: 500 }
    );
  }
}
