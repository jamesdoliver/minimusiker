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

    // Fetch event detail and songs in parallel — getSongsByEventId has its own
    // ID resolution logic, so it can accept the raw eventId directly.
    // Songs fetch is wrapped in .catch() to preserve error isolation:
    // a songs failure should not prevent showing the event detail.
    const [eventDetail, allSongs] = await Promise.all([
      getAirtableService().getSchoolEventDetail(eventId),
      getTeacherService().getSongsByEventId(eventId).catch((err) => {
        console.error('Error fetching songs for staff event detail:', err);
        return [];
      }),
    ]);

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

    // Attach songs to classes
    for (const cls of eventDetail.classes) {
      cls.songs = allSongs
        .filter(s => s.classId === cls.classId)
        .map(s => ({
          id: s.id,
          title: s.title,
          artist: s.artist,
          notes: s.notes,
          order: s.order,
          hiddenByEngineer: s.hiddenByEngineer,
        }));
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
