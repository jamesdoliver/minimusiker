import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import { getActivityService, ActivityService } from '@/lib/services/activityService';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/admin/songs/[songId]
 * Update a song (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { songId: string } }
) {
  try {
    // Verify admin session
    const session = verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const songId = decodeURIComponent(params.songId);
    const { title, artist, notes } = await request.json();

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Song title is required' },
        { status: 400 }
      );
    }

    const teacherService = getTeacherService();
    const airtableService = getAirtableService();

    // Get song info for activity logging before update
    const songInfo = await teacherService.getSongById(songId);

    // Admins can update any song - no ownership check
    await teacherService.updateSong(songId, {
      title: title.trim(),
      artist: artist?.trim() || '',
      notes: notes?.trim() || '',
    });

    // Log activity (fire-and-forget) - resolve eventRecordId from songInfo.eventId
    if (songInfo?.eventId) {
      let eventRecordId = await airtableService.getEventsRecordIdByBookingId(songInfo.eventId);
      if (!eventRecordId && /^\d+$/.test(songInfo.eventId)) {
        const booking = await airtableService.getSchoolBookingBySimplybookId(songInfo.eventId);
        if (booking) {
          const eventRecord = await airtableService.getEventBySchoolBookingId(booking.id);
          if (eventRecord) {
            eventRecordId = eventRecord.id;
          }
        }
      }

      if (eventRecordId) {
        getActivityService().logActivity({
          eventRecordId,
          activityType: 'song_updated',
          description: ActivityService.generateDescription('song_updated', {
            songTitle: title.trim(),
          }),
          actorEmail: session.email,
          actorType: 'admin',
          metadata: { songId, title: title.trim(), artist, notes },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Song updated successfully',
    });
  } catch (error) {
    console.error('Error updating song (admin):', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update song',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/songs/[songId]
 * Delete a song (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { songId: string } }
) {
  try {
    // Verify admin session
    const session = verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const songId = decodeURIComponent(params.songId);
    const teacherService = getTeacherService();
    const airtableService = getAirtableService();

    // Get song info for activity logging before deletion
    const songInfo = await teacherService.getSongById(songId);

    // Admins can delete any song - no ownership check
    await teacherService.deleteSong(songId);

    // Log activity (fire-and-forget) - resolve eventRecordId from songInfo.eventId
    if (songInfo?.eventId) {
      let eventRecordId = await airtableService.getEventsRecordIdByBookingId(songInfo.eventId);
      if (!eventRecordId && /^\d+$/.test(songInfo.eventId)) {
        const booking = await airtableService.getSchoolBookingBySimplybookId(songInfo.eventId);
        if (booking) {
          const eventRecord = await airtableService.getEventBySchoolBookingId(booking.id);
          if (eventRecord) {
            eventRecordId = eventRecord.id;
          }
        }
      }

      if (eventRecordId) {
        getActivityService().logActivity({
          eventRecordId,
          activityType: 'song_deleted',
          description: ActivityService.generateDescription('song_deleted', {
            songTitle: songInfo.title || 'Unknown',
          }),
          actorEmail: session.email,
          actorType: 'admin',
          metadata: { songId, title: songInfo.title },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Song deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting song (admin):', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete song',
      },
      { status: 500 }
    );
  }
}
