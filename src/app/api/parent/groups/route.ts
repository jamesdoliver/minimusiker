import { NextRequest, NextResponse } from 'next/server';
import { verifyParentSession } from '@/lib/auth/verifyParentSession';
import { getTeacherService } from '@/lib/services/teacherService';

/**
 * GET /api/parent/groups
 * Get groups that contain a parent's class
 * Returns groups with their songs and audio status
 */
export async function GET(request: NextRequest) {
  try {
    const session = verifyParentSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');

    if (!classId) {
      return NextResponse.json(
        { error: 'classId is required' },
        { status: 400 }
      );
    }

    const teacherService = getTeacherService();

    // Get groups that contain this class
    const groups = await teacherService.getGroupsForClass(classId);

    // Return groups with their audio status
    const groupsWithDetails = groups.map((group) => ({
      groupId: group.groupId,
      groupName: group.groupName,
      eventId: group.eventId,
      memberClasses: group.memberClasses?.map(c => ({
        classId: c.classId,
        className: c.className,
      })) || [],
      songs: group.songs.map(s => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
      })),
      audioStatus: group.audioStatus,
    }));

    return NextResponse.json({
      success: true,
      groups: groupsWithDetails,
    });
  } catch (error) {
    console.error('Error fetching parent groups:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch groups' },
      { status: 500 }
    );
  }
}
