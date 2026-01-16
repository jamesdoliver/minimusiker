import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherService } from '@/lib/services/teacherService';

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

    await teacherService.updateClass(classId, {
      className: className.trim(),
      numChildren: numChildren !== undefined && numChildren !== null && numChildren !== ''
        ? parseInt(String(numChildren), 10)
        : undefined,
    });

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

    // Business rules (cannot delete if has children/songs) enforced in service layer
    await teacherService.deleteClass(classId);

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
