import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import { getActivityService, ActivityService } from '@/lib/services/activityService';

/**
 * GET /api/teacher/events/[eventId]/collections
 * Get all collections (Choir and Teacher Song) for an event
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyTeacherSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const teacherService = getTeacherService();

    // Verify teacher has access to this event
    const event = await teacherService.getTeacherEventDetail(eventId, session.email);
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found or you do not have access' },
        { status: 404 }
      );
    }

    // Get optional type filter from query params
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type');
    const type = typeParam === 'choir' || typeParam === 'teacher_song' ? typeParam : undefined;

    // Get collections
    const collections = await teacherService.getCollectionsForEvent(eventId, type);

    return NextResponse.json({
      success: true,
      collections,
    });
  } catch (error) {
    console.error('Error fetching collections:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch collections' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teacher/events/[eventId]/collections
 * Create a new collection (Choir or Teacher Song) for an event
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyTeacherSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const { name, type } = await request.json();

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Collection name is required' },
        { status: 400 }
      );
    }

    if (type !== 'choir' && type !== 'teacher_song') {
      return NextResponse.json(
        { error: 'Collection type must be "choir" or "teacher_song"' },
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

    // Check if event is still editable (not completed)
    if (event.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot add collections to completed events' },
        { status: 400 }
      );
    }

    // Create the collection
    const collection = await teacherService.createCollection({
      eventId,
      name: name.trim(),
      type,
      teacherEmail: session.email,
    });

    // Resolve eventRecordId for activity logging
    const airtableService = getAirtableService();
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
      const activityType = type === 'choir' ? 'class_added' : 'class_added';
      const typeLabel = type === 'choir' ? 'Chor' : 'Lehrerlied';
      getActivityService().logActivity({
        eventRecordId,
        activityType,
        description: ActivityService.generateDescription(activityType, {
          className: `${typeLabel}: ${name.trim()}`,
          numChildren: 0,
        }),
        actorEmail: session.email,
        actorType: 'teacher',
        metadata: {
          collectionName: name.trim(),
          collectionType: type,
          classId: collection.classId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      collection,
      message: `${type === 'choir' ? 'Chor' : 'Lehrerlied'} collection created successfully`,
    });
  } catch (error) {
    console.error('Error creating collection:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create collection',
      },
      { status: 500 }
    );
  }
}
