import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getTeacherService } from '@/lib/services/teacherService';

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

    // Admins can update any class - no ownership check
    await teacherService.updateClass(classId, {
      className: className.trim(),
      numChildren: numChildren ? parseInt(numChildren, 10) : undefined,
    });

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
    const teacherService = getTeacherService();

    // Admins can delete any class - no ownership check
    // Business rules (cannot delete if has children/songs) enforced in service layer
    await teacherService.deleteClass(classId);

    return NextResponse.json({
      success: true,
      message: 'Class deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting class (admin):', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete class',
      },
      { status: 500 }
    );
  }
}
