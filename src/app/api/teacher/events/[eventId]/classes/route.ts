import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';

/**
 * GET /api/teacher/events/[eventId]/classes
 * Get all classes for an event
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

    const event = await teacherService.getTeacherEventDetail(eventId, session.email);
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found or you do not have access' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      classes: event.classes,
    });
  } catch (error) {
    console.error('Error fetching classes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch classes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teacher/events/[eventId]/classes
 * Add a new class to an event
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
    const { className, numChildren } = await request.json();

    if (!className || typeof className !== 'string' || className.trim().length === 0) {
      return NextResponse.json(
        { error: 'Class name is required' },
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
        { error: 'Cannot add classes to completed events' },
        { status: 400 }
      );
    }

    // Create the class
    const newClass = await teacherService.createClass({
      eventId,
      className: className.trim(),
      teacherEmail: session.email,
      numChildren: numChildren ? parseInt(numChildren, 10) : undefined,
    });

    return NextResponse.json({
      success: true,
      class: newClass,
      message: 'Class added successfully',
    });
  } catch (error) {
    console.error('Error adding class:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add class',
      },
      { status: 500 }
    );
  }
}
