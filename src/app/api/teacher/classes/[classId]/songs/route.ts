import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';

/**
 * GET /api/teacher/classes/[classId]/songs
 * Get all songs for a class
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { classId: string } }
) {
  try {
    const session = verifyTeacherSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const classId = decodeURIComponent(params.classId);
    const teacherService = getTeacherService();

    const songs = await teacherService.getSongsByClassId(classId);

    return NextResponse.json({
      success: true,
      songs,
    });
  } catch (error) {
    console.error('Error fetching songs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch songs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teacher/classes/[classId]/songs
 * Add a new song to a class
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { classId: string } }
) {
  try {
    const session = verifyTeacherSession(request);
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

    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      );
    }

    const teacherService = getTeacherService();

    // Verify teacher has access to this event
    const event = await teacherService.getTeacherEventDetail(eventId, session.email);
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found or you do not have access' },
        { status: 404 }
      );
    }

    // Verify the class or group belongs to this event
    const classExists = event.classes.some((c) => c.classId === classId);
    const isGroup = classId.startsWith('group_');

    // If it's a group, verify the group belongs to this event
    let groupExists = false;
    if (isGroup) {
      const groups = await teacherService.getGroupsByEventId(eventId);
      groupExists = groups.some((g) => g.groupId === classId);
    }

    if (!classExists && !groupExists) {
      return NextResponse.json(
        { error: isGroup ? 'Group not found in this event' : 'Class not found in this event' },
        { status: 404 }
      );
    }

    // Check if event is still editable (not completed)
    if (event.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot add songs to completed events' },
        { status: 400 }
      );
    }

    // Create the song
    const song = await teacherService.createSong({
      classId,
      eventId,
      title: title.trim(),
      artist: artist?.trim(),
      notes: notes?.trim(),
      createdBy: session.teacherId,
    });

    return NextResponse.json({
      success: true,
      song,
      message: 'Song added successfully',
    });
  } catch (error) {
    console.error('Error adding song:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add song',
      },
      { status: 500 }
    );
  }
}
