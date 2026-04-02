import { NextRequest, NextResponse } from 'next/server';
import { verifyEngineerSession } from '@/lib/auth/verifyEngineerSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import { getActivityService, ActivityService } from '@/lib/services/activityService';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/engineer/events/[eventId]/songs/[songId]
 * Rename a song (engineer only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { eventId: string; songId: string } }
) {
  try {
    const session = verifyEngineerSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const songId = decodeURIComponent(params.songId);
    const { title, publicNotes, internalNotes } = await request.json();

    if (!title && publicNotes === undefined && internalNotes === undefined) {
      return NextResponse.json({ error: 'No update fields provided' }, { status: 400 });
    }

    const teacherService = getTeacherService();

    // Verify song belongs to this event
    const songs = await teacherService.getSongsByEventId(eventId);
    const song = songs.find(s => s.id === songId);
    if (!song) {
      return NextResponse.json({ error: 'Song not found in this event' }, { status: 404 });
    }

    const oldTitle = song.title;
    const updateFields: any = {};
    if (title && typeof title === 'string' && title.trim().length > 0) updateFields.title = title.trim();
    if (publicNotes !== undefined) updateFields.publicNotes = publicNotes?.trim() || '';
    if (internalNotes !== undefined) updateFields.internalNotes = internalNotes?.trim() || '';

    const updatedSong = await teacherService.updateSong(songId, updateFields);

    // Log activity (fire-and-forget)
    const airtableService = getAirtableService();
    const eventRecordId = await airtableService.getEventsRecordIdByBookingId(eventId);
    if (eventRecordId) {
      getActivityService().logActivity({
        eventRecordId,
        activityType: 'song_renamed',
        description: ActivityService.generateDescription('song_renamed', {
          oldTitle,
          newTitle: title.trim(),
        }),
        actorEmail: session.email,
        actorType: 'engineer',
        metadata: { songId, oldTitle, newTitle: title.trim() },
      });
    }

    return NextResponse.json({ success: true, song: updatedSong });
  } catch (error) {
    console.error('Error renaming song:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to rename song' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/engineer/events/[eventId]/songs/[songId]
 * Hide/unhide a song (engineer only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { eventId: string; songId: string } }
) {
  try {
    const session = verifyEngineerSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const songId = decodeURIComponent(params.songId);
    const { hidden } = await request.json();

    if (typeof hidden !== 'boolean') {
      return NextResponse.json({ error: 'hidden must be a boolean' }, { status: 400 });
    }

    const teacherService = getTeacherService();

    // Verify song belongs to this event
    const songs = await teacherService.getSongsByEventId(eventId);
    const song = songs.find(s => s.id === songId);
    if (!song) {
      return NextResponse.json({ error: 'Song not found in this event' }, { status: 404 });
    }

    await teacherService.updateSongHiddenByEngineer(songId, hidden);

    // Log activity (fire-and-forget)
    const airtableService = getAirtableService();
    const eventRecordId = await airtableService.getEventsRecordIdByBookingId(eventId);
    if (eventRecordId) {
      const activityType = hidden ? 'song_hidden' : 'song_unhidden';
      getActivityService().logActivity({
        eventRecordId,
        activityType,
        description: ActivityService.generateDescription(activityType, {
          songTitle: song.title,
        }),
        actorEmail: session.email,
        actorType: 'engineer',
        metadata: { songId, songTitle: song.title, hidden },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating song visibility:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update song' },
      { status: 500 }
    );
  }
}
