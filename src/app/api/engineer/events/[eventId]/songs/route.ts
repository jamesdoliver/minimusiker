import { NextRequest, NextResponse } from 'next/server';
import { verifyEngineerSession } from '@/lib/auth/verifyEngineerSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import { getActivityService, ActivityService } from '@/lib/services/activityService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/engineer/events/[eventId]/songs
 * Create a new song (engineer only)
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
    const { title, classId } = await request.json();

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!classId || typeof classId !== 'string') {
      return NextResponse.json({ error: 'classId is required' }, { status: 400 });
    }

    const teacherService = getTeacherService();

    const newSong = await teacherService.createSong({
      classId,
      eventId,
      title: title.trim(),
      createdBy: session.email,
    });

    // Log activity (fire-and-forget)
    const airtableService = getAirtableService();
    const eventRecordId = await airtableService.getEventsRecordIdByBookingId(eventId);
    if (eventRecordId) {
      getActivityService().logActivity({
        eventRecordId,
        activityType: 'song_added',
        description: ActivityService.generateDescription('song_added', {
          songTitle: title.trim(),
        }),
        actorEmail: session.email,
        actorType: 'engineer',
        metadata: { songId: newSong.id, title: title.trim(), classId, createdBy: 'engineer' },
      });
    }

    return NextResponse.json({ success: true, song: newSong });
  } catch (error) {
    console.error('Error creating song:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create song' },
      { status: 500 }
    );
  }
}
