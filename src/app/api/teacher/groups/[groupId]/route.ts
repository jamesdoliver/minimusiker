import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import { getActivityService, ActivityService } from '@/lib/services/activityService';

// Helper to resolve eventRecordId from eventId
async function resolveEventRecordId(eventId: string): Promise<string | null> {
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
  return eventRecordId;
}

export const dynamic = 'force-dynamic';

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

    // Get existing group for activity logging
    const existingGroup = await teacherService.getGroupById(groupId);

    const updatedGroup = await teacherService.updateGroup(groupId, {
      groupName: groupName?.trim(),
      memberClassIds,
    });

    // Log activity (fire-and-forget)
    if (existingGroup?.eventId) {
      const eventRecordId = await resolveEventRecordId(existingGroup.eventId);
      if (eventRecordId) {
        getActivityService().logActivity({
          eventRecordId,
          activityType: 'group_updated',
          description: ActivityService.generateDescription('group_updated', {
            groupName: groupName?.trim() || existingGroup.groupName,
          }),
          actorEmail: session.email,
          actorType: 'teacher',
        });
      }
    }

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

    // Get group info before deletion for activity logging
    const groupToDelete = await teacherService.getGroupById(groupId);

    // Business rules (cannot delete if has songs/audio) enforced in service layer
    await teacherService.deleteGroup(groupId);

    // Log activity (fire-and-forget)
    if (groupToDelete?.eventId) {
      const eventRecordId = await resolveEventRecordId(groupToDelete.eventId);
      if (eventRecordId) {
        getActivityService().logActivity({
          eventRecordId,
          activityType: 'group_deleted',
          description: ActivityService.generateDescription('group_deleted', {
            groupName: groupToDelete.groupName,
          }),
          actorEmail: session.email,
          actorType: 'teacher',
        });
      }
    }

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
