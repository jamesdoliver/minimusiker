import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffSession } from '@/lib/auth/verifyStaffSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherService } from '@/lib/services/teacherService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    // Verify staff session
    const session = verifyStaffSession(request);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const eventId = decodeURIComponent(params.eventId);

    const eventDetail = await getAirtableService().getSchoolEventDetail(eventId);

    if (!eventDetail) {
      return NextResponse.json(
        {
          success: false,
          error: 'Event not found',
        },
        { status: 404 }
      );
    }

    // TODO: Once staff assignment is implemented, verify that this staff member
    // is assigned to this event before returning details

    // Fetch songs for each class
    try {
      const teacherService = getTeacherService();
      const resolvedEventId = eventDetail.eventId || eventId;
      const allSongs = await teacherService.getSongsByEventId(resolvedEventId);

      for (const cls of eventDetail.classes) {
        cls.songs = allSongs
          .filter(s => s.classId === cls.classId)
          .map(s => ({ id: s.id, title: s.title, artist: s.artist, notes: s.notes, order: s.order, hiddenByEngineer: s.hiddenByEngineer }));
      }
    } catch (error) {
      console.error('Error fetching songs for staff event detail:', error);
    }

    return NextResponse.json({
      success: true,
      data: eventDetail,
    });
  } catch (error) {
    console.error('Error fetching staff event detail:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch event details',
      },
      { status: 500 }
    );
  }
}
