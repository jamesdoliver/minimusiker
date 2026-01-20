import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import { getActivityService, ActivityService } from '@/lib/services/activityService';

/**
 * GET /api/admin/events/[eventId]/groups
 * Get all class groups for an event (admin access)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const teacherService = getTeacherService();

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
 * POST /api/admin/events/[eventId]/groups
 * Create a new class group for an event (admin access)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
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
    const airtableService = getAirtableService();

    // Get event details to verify classes belong to this event
    const eventDetail = await airtableService.getSchoolEventDetail(eventId);
    if (!eventDetail) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Verify all selected classes belong to this event
    const eventClassIds = eventDetail.classes.map(c => c.classId);
    const invalidClasses = memberClassIds.filter(id => !eventClassIds.includes(id));
    if (invalidClasses.length > 0) {
      return NextResponse.json(
        { error: 'One or more selected classes do not belong to this event' },
        { status: 400 }
      );
    }

    // Create the group (use admin email as creator)
    const newGroup = await teacherService.createGroup({
      eventId,
      groupName: groupName.trim(),
      memberClassIds,
      createdBy: admin.email || 'admin',
    });

    // Resolve eventRecordId for activity logging
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
      getActivityService().logActivity({
        eventRecordId,
        activityType: 'group_created',
        description: ActivityService.generateDescription('group_created', {
          groupName: groupName.trim(),
        }),
        actorEmail: admin.email,
        actorType: 'admin',
        metadata: { groupId: newGroup.groupId, groupName: groupName.trim(), memberClassIds },
      });
    }

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
