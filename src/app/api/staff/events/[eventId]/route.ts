import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffSession } from '@/lib/auth/verifyStaffSession';
import { getAirtableService } from '@/lib/services/airtableService';

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
