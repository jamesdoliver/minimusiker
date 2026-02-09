import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teacher/events/[eventId]/groups
 * Get all class groups for an event
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

    const groups = await teacherService.getGroupsByEventId(eventId);

    return NextResponse.json({
      success: true,
      groups,
    });
  } catch (error) {
    console.error('Error fetching groups:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch groups' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teacher/events/[eventId]/groups
 * Create a new class group for an event
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
    const { groupName, memberClassIds } = await request.json();

    // Validation
    if (!groupName || typeof groupName !== 'string' || groupName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Group name is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(memberClassIds) || memberClassIds.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 classes must be selected for a group' },
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

    // Check if event is still editable
    if (event.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot add groups to completed events' },
        { status: 400 }
      );
    }

    // Verify all selected classes belong to this event
    const eventClassIds = event.classes.map(c => c.classId);
    const invalidClasses = memberClassIds.filter(id => !eventClassIds.includes(id));
    if (invalidClasses.length > 0) {
      return NextResponse.json(
        { error: 'One or more selected classes do not belong to this event' },
        { status: 400 }
      );
    }

    // Create the group
    const newGroup = await teacherService.createGroup({
      eventId,
      groupName: groupName.trim(),
      memberClassIds,
      createdBy: session.email,
    });

    return NextResponse.json({
      success: true,
      group: newGroup,
      message: 'Group created successfully',
    });
  } catch (error) {
    console.error('Error creating group:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create group',
      },
      { status: 500 }
    );
  }
}
