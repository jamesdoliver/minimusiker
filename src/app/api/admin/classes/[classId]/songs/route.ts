import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import { getActivityService, ActivityService } from '@/lib/services/activityService';

/**
 * POST /api/admin/classes/[classId]/songs
 * Add a new song to a class or group (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { classId: string } }
) {
  try {
    // Verify admin session
    const session = verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const classId = decodeURIComponent(params.classId);
    const { title, artist, notes, eventId } = await request.json();

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Song title is required' },
        { status: 400 }
      );
    }

    if (!eventId || typeof eventId !== 'string') {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    const teacherService = getTeacherService();
    const airtableService = getAirtableService();

    // Verify event exists
    const event = await airtableService.getSchoolEventDetail(eventId);
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Verify the class or group belongs to this event
    const isGroup = classId.startsWith('group_');

    if (isGroup) {
      // Verify group belongs to this event
      const groups = await teacherService.getGroupsByEventId(eventId);
      const groupExists = groups.some((g) => g.groupId === classId);
      if (!groupExists) {
        return NextResponse.json(
          { error: 'Group not found in this event' },
          { status: 404 }
        );
      }
    } else {
      // Verify class belongs to this event
      const classExists = event.classes.some((c) => c.classId === classId);
      if (!classExists) {
        return NextResponse.json(
          { error: 'Class not found in this event' },
          { status: 404 }
        );
      }
    }

    // Create the song
    const newSong = await teacherService.createSong({
      classId,
      eventId,
      title: title.trim(),
      artist: artist?.trim() || '',
      notes: notes?.trim() || '',
    });

    // Resolve eventRecordId for activity logging
    let eventRecordId = await airtableService.getEventsRecordIdByBookingId(eventId);
    if (!eventRecordId && /^\d+$/.test(eventId)) {
      const booking = await airtableService.getSchoolBookingBySimplybookId(eventId);
      if (booking) {
        const eventRecord = await airtableService.getEventBySchoolBookingId(booking.id);
        if (eventRecord) {
          eventRecordId = eventRecord.id;
        }
      }
    }

    // Log activity (fire-and-forget)
    if (eventRecordId) {
      // Determine target type and name
      const targetType = isGroup ? 'group' : 'class';
      const targetName = isGroup
        ? (await teacherService.getGroupsByEventId(eventId)).find(g => g.groupId === classId)?.groupName || 'Unknown'
        : event.classes.find(c => c.classId === classId)?.className || 'Unknown';

      getActivityService().logActivity({
        eventRecordId,
        activityType: 'song_added',
        description: ActivityService.generateDescription('song_added', {
          songTitle: title.trim(),
          targetType,
          targetName,
        }),
        actorEmail: session.email,
        actorType: 'admin',
        metadata: { songId: newSong.id, title: title.trim(), classId, targetType, targetName },
      });
    }

    return NextResponse.json({
      success: true,
      song: newSong,
      message: 'Song added successfully',
    });
  } catch (error) {
    console.error('Error adding song (admin):', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add song',
      },
      { status: 500 }
    );
  }
}
