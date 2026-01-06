import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';

/**
 * POST /api/admin/events/[eventId]/assign-staff
 * Assign a staff member to all records with the given booking_id
 * Request body: { staffId: string | null }
 * Pass null to unassign staff
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    // Verify admin authentication
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { staffId } = await request.json();
    const eventId = decodeURIComponent(params.eventId);

    // Validate staffId if provided
    if (staffId !== null && typeof staffId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid staffId - must be a string or null' },
        { status: 400 }
      );
    }

    // Assign staff to all records with this booking_id
    const updatedCount = await getAirtableService().assignStaffToEvent(eventId, staffId);

    if (updatedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No records found for this event',
        },
        { status: 404 }
      );
    }

    // Get updated event data with staff info
    const updatedEvents = await getAirtableService().getSchoolEventSummaries();
    const updatedEvent = updatedEvents.find(e => e.eventId === eventId);

    return NextResponse.json({
      success: true,
      message: `Staff ${staffId ? 'assigned' : 'unassigned'} for ${updatedCount} records`,
      data: updatedEvent,
    });
  } catch (error) {
    console.error('Error assigning staff to event:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to assign staff',
      },
      { status: 500 }
    );
  }
}
