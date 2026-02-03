import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
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
 * PUT /api/admin/classes/[classId]
 * Update a class (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { classId: string } }
) {
  try {
    // Verify admin session
    const session = verifyAdminSession(request);
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

    // Get class info for activity logging before update
    const classInfo = await getClassInfo(classId);

    // Admins can update any class - no ownership check
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
        actorType: 'admin',
        metadata: { classId, className: className.trim(), numChildren },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Class updated successfully',
    });
  } catch (error) {
    console.error('Error updating class (admin):', error);
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
 * DELETE /api/admin/classes/[classId]
 * Delete a class (admin only)
 *
 * Query params:
 * - confirmMove=true: Move songs and registrations to "Alle Kinder" before deleting
 *
 * Response codes:
 * - 200: Class deleted successfully
 * - 400: DATA_ATTACHED - Class has data attached (returns songCount and registrationCount)
 * - 401: Unauthorized
 * - 500: Server error
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { classId: string } }
) {
  try {
    // Verify admin session
    const session = verifyAdminSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const classId = decodeURIComponent(params.classId);
    const { searchParams } = new URL(request.url);
    const confirmMove = searchParams.get('confirmMove') === 'true';

    const teacherService = getTeacherService();

    // Get class info for activity logging before deletion
    const classInfo = await getClassInfo(classId);

    // Admins can delete any class - no ownership check
    // If class has data and confirmMove=false, will throw DATA_ATTACHED error
    await teacherService.deleteClass(classId, { confirmMove });

    // Log activity (fire-and-forget)
    if (classInfo?.eventRecordId) {
      getActivityService().logActivity({
        eventRecordId: classInfo.eventRecordId,
        activityType: 'class_deleted',
        description: ActivityService.generateDescription('class_deleted', {
          className: classInfo.className,
        }),
        actorEmail: session.email,
        actorType: 'admin',
        metadata: { classId, className: classInfo.className, dataMoved: confirmMove },
      });
    }

    return NextResponse.json({
      success: true,
      message: confirmMove ? 'Data moved to Alle Kinder and class deleted' : 'Class deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting class (admin):', error);

    // Handle DATA_ATTACHED error specially - return counts for frontend dialog
    if (error instanceof Error && error.message === 'DATA_ATTACHED') {
      const typedError = error as Error & { songCount?: number; registrationCount?: number };
      return NextResponse.json(
        {
          success: false,
          error: 'Class has data attached',
          code: 'DATA_ATTACHED',
          songCount: typedError.songCount || 0,
          registrationCount: typedError.registrationCount || 0,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete class',
      },
      { status: 500 }
    );
  }
}
