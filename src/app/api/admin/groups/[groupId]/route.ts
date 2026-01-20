import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import { getActivityService, ActivityService } from '@/lib/services/activityService';

// Helper to resolve eventRecordId from eventId (booking_id or simplybookId)
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

/**
 * GET /api/admin/groups/[groupId]
 * Get a single group by ID (admin access)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const groupId = decodeURIComponent(params.groupId);
    const teacherService = getTeacherService();

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
 * PUT /api/admin/groups/[groupId]
 * Update a group (admin access)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const groupId = decodeURIComponent(params.groupId);
    const { groupName, memberClassIds } = await request.json();

    const teacherService = getTeacherService();

    // Verify group exists
    const existingGroup = await teacherService.getGroupById(groupId);
    if (!existingGroup) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: { groupName?: string; memberClassIds?: string[] } = {};

    if (groupName !== undefined) {
      if (typeof groupName !== 'string' || groupName.trim().length === 0) {
        return NextResponse.json(
          { error: 'Group name cannot be empty' },
          { status: 400 }
        );
      }
      updateData.groupName = groupName.trim();
    }

    if (memberClassIds !== undefined) {
      if (!Array.isArray(memberClassIds) || memberClassIds.length < 2) {
        return NextResponse.json(
          { error: 'At least 2 classes must be selected for a group' },
          { status: 400 }
        );
      }
      updateData.memberClassIds = memberClassIds;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const updatedGroup = await teacherService.updateGroup(groupId, updateData);

    // Log activity (fire-and-forget) - resolve eventRecordId from eventId
    if (existingGroup.eventId) {
      const eventRecordId = await resolveEventRecordId(existingGroup.eventId);
      if (eventRecordId) {
        getActivityService().logActivity({
          eventRecordId,
          activityType: 'group_updated',
          description: ActivityService.generateDescription('group_updated', {
            groupName: updateData.groupName || existingGroup.groupName,
          }),
          actorEmail: admin.email,
          actorType: 'admin',
          metadata: { groupId, ...updateData },
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
 * DELETE /api/admin/groups/[groupId]
 * Delete a group (admin access)
 * Will fail if group has songs assigned
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const groupId = decodeURIComponent(params.groupId);
    const teacherService = getTeacherService();

    // Verify group exists
    const existingGroup = await teacherService.getGroupById(groupId);
    if (!existingGroup) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      );
    }

    // Check if group has songs
    const songs = await teacherService.getSongsByClassId(existingGroup.groupId);
    if (songs.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete group with songs. Please remove all songs first.' },
        { status: 400 }
      );
    }

    await teacherService.deleteGroup(groupId);

    // Log activity (fire-and-forget) - resolve eventRecordId from eventId
    if (existingGroup.eventId) {
      const eventRecordId = await resolveEventRecordId(existingGroup.eventId);
      if (eventRecordId) {
        getActivityService().logActivity({
          eventRecordId,
          activityType: 'group_deleted',
          description: ActivityService.generateDescription('group_deleted', {
            groupName: existingGroup.groupName,
          }),
          actorEmail: admin.email,
          actorType: 'admin',
          metadata: { groupId, groupName: existingGroup.groupName },
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
