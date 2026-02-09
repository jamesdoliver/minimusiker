import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getActivityService, ActivityService } from '@/lib/services/activityService';

export const dynamic = 'force-dynamic';

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
    const airtableService = getAirtableService();
    const updatedEvents = await airtableService.getSchoolEventSummaries();
    const updatedEvent = updatedEvents.find(e => e.eventId === eventId);

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
      const activityType = staffId ? 'staff_assigned' : 'staff_unassigned';
      getActivityService().logActivity({
        eventRecordId,
        activityType,
        description: ActivityService.generateDescription(activityType, {
          staffName: updatedEvent?.assignedStaffName || 'Staff member',
        }),
        actorEmail: admin.email,
        actorType: 'admin',
        metadata: { staffId, staffName: updatedEvent?.assignedStaffName },
      });
    }

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
