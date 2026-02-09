import { NextRequest, NextResponse } from 'next/server';
import { verifyParentSession } from '@/lib/auth/verifyParentSession';
import { getTeacherService } from '@/lib/services/teacherService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/parent/collections
 * Get collections (Choir and Teacher Song) for a parent's event
 * These collections are visible to ALL parents in the event
 */
export async function GET(request: NextRequest) {
  try {
    const session = verifyParentSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const typeParam = searchParams.get('type');

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId is required' },
        { status: 400 }
      );
    }

    // Validate that the parent has access to this event
    // Check if any of their children's events match this eventId
    const hasAccess = session.children?.some(
      (child) => child.eventId === eventId || child.bookingId === eventId
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this event' },
        { status: 403 }
      );
    }

    const teacherService = getTeacherService();

    // Get optional type filter
    const type = typeParam === 'choir' || typeParam === 'teacher_song' ? typeParam : undefined;

    // Get collections for this event
    const collections = await teacherService.getCollectionsForEvent(eventId, type);

    // Map to parent-friendly format
    const collectionsWithDetails = collections.map((collection) => ({
      classId: collection.classId,
      name: collection.className,
      type: collection.classType,
      songs: collection.songs.map(s => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
      })),
      audioStatus: collection.audioStatus,
    }));

    return NextResponse.json({
      success: true,
      collections: collectionsWithDetails,
    });
  } catch (error) {
    console.error('Error fetching parent collections:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch collections' },
      { status: 500 }
    );
  }
}
