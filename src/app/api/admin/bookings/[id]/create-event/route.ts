import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { generateEventId } from '@/lib/utils/eventIdentifiers';
import { getR2Service } from '@/lib/services/r2Service';
import { getTeacherService } from '@/lib/services/teacherService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/bookings/[id]/create-event
 * Retry event creation for a booking that is missing its Event record.
 * Idempotent — if event already exists, returns it without creating a duplicate.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: bookingId } = await params;
    const airtableService = getAirtableService();

    // 1. Fetch the SchoolBooking
    const booking = await airtableService.getSchoolBookingById(bookingId);
    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    // 2. Check if event already exists (idempotent)
    const existingEvent = await airtableService.getEventBySchoolBookingId(bookingId);
    if (existingEvent) {
      return NextResponse.json({
        success: true,
        message: 'Event already exists',
        eventId: existingEvent.event_id,
        eventRecordId: existingEvent.id,
        alreadyExisted: true,
      });
    }

    // 3. Generate event_id
    const schoolName = booking.schoolName || booking.schoolContactName || 'Unknown';
    const eventDate = booking.startDate || new Date().toISOString().split('T')[0];
    const isPending = !booking.startDate;

    const eventId = generateEventId(
      schoolName,
      'MiniMusiker',
      booking.startDate || undefined
    );

    // 4. Create Events record
    const eventRecord = await airtableService.createEventFromBooking(
      eventId,
      bookingId,
      schoolName,
      eventDate,
      undefined, // no staff auto-assignment
      'MiniMusiker',
      booking.schoolAddress || undefined,
      booking.schoolPhone || undefined,
      isPending ? 'Pending' : undefined,
      booking.estimatedChildren || undefined
    );

    console.log(`[CreateEvent] Created Event record ${eventRecord.id} for booking ${bookingId}`);

    // 5. Initialize R2 folder structure
    const r2Service = getR2Service();
    const initResult = await r2Service.initializeEventStructure(eventId);
    if (initResult.success) {
      console.log(`[CreateEvent] Initialized R2 structure for ${eventId}`);
    } else {
      console.warn(`[CreateEvent] R2 init failed for ${eventId}:`, initResult.error);
    }

    // 6. Create default "Alle Kinder" class
    try {
      const teacherService = getTeacherService();
      const defaultClass = await teacherService.createDefaultClass({
        eventId,
        eventRecordId: eventRecord.id,
        schoolName,
        bookingDate: eventDate,
        estimatedChildren: booking.estimatedChildren || 0,
      });
      if (defaultClass) {
        console.log(`[CreateEvent] Created default class ${defaultClass.classId} for ${eventId}`);
      }
    } catch (classError) {
      console.error('[CreateEvent] Error creating default class:', classError);
    }

    return NextResponse.json({
      success: true,
      message: 'Event created successfully',
      eventId,
      eventRecordId: eventRecord.id,
      alreadyExisted: false,
    });
  } catch (error) {
    console.error('[CreateEvent] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create event',
      },
      { status: 500 }
    );
  }
}
