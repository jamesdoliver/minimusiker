import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getActivityService, ActivityService } from '@/lib/services/activityService';
import { CLASSES_TABLE_ID, CLASSES_FIELD_IDS } from '@/lib/types/airtable';
import Airtable from 'airtable';

// Helper to get class info including eventRecordId
async function getClassInfo(classId: string): Promise<{ className: string; eventRecordId: string | null } | null> {
  try {
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);
    const records = await base(CLASSES_TABLE_ID)
      .select({
        filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${classId}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) return null;

    const record = records[0];
    const eventIds = record.get(CLASSES_FIELD_IDS.event_id) as string[] | undefined;
    return {
      className: (record.get(CLASSES_FIELD_IDS.class_name) as string) || 'Unknown',
      eventRecordId: eventIds?.[0] || null,
    };
  } catch {
    return null;
  }
}

/**
 * PUT /api/teacher/classes/[classId]
 * Update a class (teacher must own the event)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { classId: string } }
) {
  try {
    const session = verifyTeacherSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const classId = decodeURIComponent(params.classId);
    const { className, numChildren } = await request.json();

    if (!className || typeof className !== 'string' || className.trim().length === 0) {
      return NextResponse.json(
        { error: 'Class name is required' },
        { status: 400 }
      );
    }

    const teacherService = getTeacherService();

    // Verify teacher owns this class by checking event ownership
    const hasAccess = await teacherService.verifyTeacherOwnsClass(classId, session.email);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Class not found or you do not have access' },
        { status: 404 }
      );
    }

    // Get class info for activity logging before update
    const classInfo = await getClassInfo(classId);

    await teacherService.updateClass(classId, {
      className: className.trim(),
      numChildren: numChildren !== undefined && numChildren !== null && numChildren !== ''
        ? parseInt(String(numChildren), 10)
        : undefined,
    });

    // Log activity (fire-and-forget)
    if (classInfo?.eventRecordId) {
      getActivityService().logActivity({
        eventRecordId: classInfo.eventRecordId,
        activityType: 'class_updated',
        description: ActivityService.generateDescription('class_updated', {
          className: className.trim(),
        }),
        actorEmail: session.email,
        actorType: 'teacher',
        metadata: { classId, className: className.trim(), numChildren },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Class updated successfully',
    });
  } catch (error) {
    console.error('Error updating class (teacher):', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update class',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/teacher/classes/[classId]
 * Delete a class (teacher must own the event)
 */
export async function DELETE(
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

    // Verify teacher owns this class by checking event ownership
    const hasAccess = await teacherService.verifyTeacherOwnsClass(classId, session.email);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Class not found or you do not have access' },
        { status: 404 }
      );
    }

    // Get class info for activity logging before deletion
    const classInfo = await getClassInfo(classId);

    // Business rules (cannot delete if has children/songs) enforced in service layer
    await teacherService.deleteClass(classId);

    // Log activity (fire-and-forget)
    if (classInfo?.eventRecordId) {
      getActivityService().logActivity({
        eventRecordId: classInfo.eventRecordId,
        activityType: 'class_deleted',
        description: ActivityService.generateDescription('class_deleted', {
          className: classInfo.className,
        }),
        actorEmail: session.email,
        actorType: 'teacher',
        metadata: { classId, className: classInfo.className },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Class deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting class (teacher):', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete class',
      },
      { status: 500 }
    );
  }
}
