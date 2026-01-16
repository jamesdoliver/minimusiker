import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';

/**
 * GET /api/teacher/groups/[groupId]
 * Get a single group by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const session = verifyTeacherSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const groupId = decodeURIComponent(params.groupId);
    const teacherService = getTeacherService();

    // Verify teacher owns this group
    const hasAccess = await teacherService.verifyTeacherOwnsGroup(groupId, session.email);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Group not found or you do not have access' },
        { status: 404 }
      );
    }

    const group = await teacherService.getGroupById(groupId);
    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      group,
    });
  } catch (error) {
    console.error('Error fetching group:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch group' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/teacher/groups/[groupId]
 * Update a group (teacher must own the event)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const session = verifyTeacherSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const groupId = decodeURIComponent(params.groupId);
    const { groupName, memberClassIds } = await request.json();

    // At least one field must be provided
    if (groupName === undefined && memberClassIds === undefined) {
      return NextResponse.json(
        { error: 'At least one field (groupName or memberClassIds) is required' },
        { status: 400 }
      );
    }

    // Validate groupName if provided
    if (groupName !== undefined && (typeof groupName !== 'string' || groupName.trim().length === 0)) {
      return NextResponse.json(
        { error: 'Group name must be a non-empty string' },
        { status: 400 }
      );
    }

    // Validate memberClassIds if provided
    if (memberClassIds !== undefined && (!Array.isArray(memberClassIds) || memberClassIds.length < 2)) {
      return NextResponse.json(
        { error: 'At least 2 classes must be selected for a group' },
        { status: 400 }
      );
    }

    const teacherService = getTeacherService();

    // Verify teacher owns this group
    const hasAccess = await teacherService.verifyTeacherOwnsGroup(groupId, session.email);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Group not found or you do not have access' },
        { status: 404 }
      );
    }

    // If updating memberClassIds, verify all classes belong to the same event
    if (memberClassIds !== undefined) {
      const group = await teacherService.getGroupById(groupId);
      if (group && group.eventId) {
        const event = await teacherService.getTeacherEventDetail(group.eventId, session.email);
        if (event) {
          const eventClassIds = event.classes.map(c => c.classId);
          const invalidClasses = memberClassIds.filter((id: string) => !eventClassIds.includes(id));
          if (invalidClasses.length > 0) {
            return NextResponse.json(
              { error: 'One or more selected classes do not belong to this event' },
              { status: 400 }
            );
          }
        }
      }
    }

    const updatedGroup = await teacherService.updateGroup(groupId, {
      groupName: groupName?.trim(),
      memberClassIds,
    });

    return NextResponse.json({
      success: true,
      group: updatedGroup,
      message: 'Group updated successfully',
    });
  } catch (error) {
    console.error('Error updating group:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update group',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/teacher/groups/[groupId]
 * Delete a group (teacher must own the event)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const session = verifyTeacherSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const groupId = decodeURIComponent(params.groupId);
    const teacherService = getTeacherService();

    // Verify teacher owns this group
    const hasAccess = await teacherService.verifyTeacherOwnsGroup(groupId, session.email);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Group not found or you do not have access' },
        { status: 404 }
      );
    }

    // Business rules (cannot delete if has songs/audio) enforced in service layer
    await teacherService.deleteGroup(groupId);

    return NextResponse.json({
      success: true,
      message: 'Group deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting group:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete group',
      },
      { status: 500 }
    );
  }
}
