import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTaskService } from '@/lib/services/taskService';
import { getActivityService, ActivityService } from '@/lib/services/activityService';
import { sendStaffReassignmentEmail } from '@/lib/services/resendService';
import { SchoolEventDetail, EVENTS_TABLE_ID, EVENTS_FIELD_IDS, PERSONEN_TABLE_ID, PERSONEN_FIELD_IDS } from '@/lib/types/airtable';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { simplybookService } from '@/lib/services/simplybookService';
import {
  triggerDateChangeNotification,
  triggerCancellationNotification,
  triggerNewBookingNotification,
} from '@/lib/services/notificationService';

export const dynamic = 'force-dynamic';

export async function GET(
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

    const eventId = decodeURIComponent(params.eventId);

    // First try to get event detail from parent_journey_table (has class data)
    let eventDetail = await getAirtableService().getSchoolEventDetail(eventId);

    // If no class data exists, try to get basic info from SchoolBookings table
    if (!eventDetail) {
      const booking = await getAirtableService().getSchoolBookingBySimplybookId(eventId);

      if (booking) {
        // Create a minimal event detail from booking data
        // SchoolBooking uses different field names than the booking display
        eventDetail = {
          eventId: booking.simplybookId,
          schoolName: booking.schoolContactName || 'Unknown School',
          eventDate: booking.startDate || '',
          eventType: 'MiniMusiker Day',
          mainTeacher: booking.schoolContactName || '',
          classCount: 0,
          totalChildren: booking.estimatedChildren || 0,
          totalParents: 0,
          classes: [],
          overallRegistrationRate: 0,
          // Include assigned staff from SchoolBookings table
          assignedStaffId: booking.assignedStaff?.[0],
          // Include booking info for display
          bookingInfo: {
            contactEmail: booking.schoolContactEmail,
            contactPhone: booking.schoolPhone,
            address: booking.schoolAddress,
            postalCode: booking.schoolPostalCode,
            region: booking.region,
            startTime: booking.startTime,
            endTime: booking.endTime,
            status: booking.simplybookStatus,
            costCategory: booking.schoolSizeCategory,
          },
        } as SchoolEventDetail & { bookingInfo?: Record<string, unknown> };
      }
    }

    if (!eventDetail) {
      return NextResponse.json(
        {
          success: false,
          error: 'Event not found',
        },
        { status: 404 }
      );
    }

    // Enhance classes with songs data
    if (eventDetail.classes && eventDetail.classes.length > 0) {
      const teacherService = getTeacherService();
      const allSongs = await teacherService.getSongsByEventId(eventId);

      // Group songs by classId
      const songsByClass = allSongs.reduce((acc, song) => {
        if (!acc[song.classId]) {
          acc[song.classId] = [];
        }
        acc[song.classId].push(song);
        return acc;
      }, {} as Record<string, typeof allSongs>);

      // Add songs to each class
      eventDetail = {
        ...eventDetail,
        classes: eventDetail.classes.map((cls) => ({
          ...cls,
          songs: songsByClass[cls.classId] || [],
        })),
      };
    }

    // Fetch Event record to get status and type fields
    const airtableService = getAirtableService();
    let eventStatusAndType: {
      eventStatus?: 'Confirmed' | 'On Hold' | 'Cancelled' | 'Deleted' | 'Pending';
      isPlus?: boolean;
      isKita?: boolean;
      isSchulsong?: boolean;
      isMinimusikertag?: boolean;
    } = {};

    try {
      // Try to find Event record by event_id or legacy_booking_id
      let eventRecordId = await airtableService.getEventsRecordIdByBookingId(eventId);

      // Fallback: resolve via SimplyBook booking link
      if (!eventRecordId) {
        const booking = await airtableService.getSchoolBookingBySimplybookId(eventId);
        if (booking) {
          const linkedEvent = await airtableService.getEventBySchoolBookingId(booking.id);
          if (linkedEvent) {
            eventRecordId = linkedEvent.id;
          }
        }
      }

      if (eventRecordId) {
        const eventRecord = await airtableService.getEventById(eventRecordId);
        if (eventRecord) {
          // Determine if this is a Kita event based on event_type or is_kita flag
          const isKitaFromEventType = eventRecord.event_type === 'Minimusikertag Kita';

          eventStatusAndType = {
            eventStatus: eventRecord.status,
            isPlus: eventRecord.is_plus,
            isKita: eventRecord.is_kita || isKitaFromEventType,
            isSchulsong: eventRecord.is_schulsong,
            isMinimusikertag: eventRecord.is_minimusikertag === true,
          };
        }
      }
    } catch (err) {
      console.warn('Could not fetch Event status/type fields:', err);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...eventDetail,
        ...eventStatusAndType,
      },
    });
  } catch (error) {
    console.error('Error fetching event detail:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch event details',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/events/[eventId]
 * Update event details (supports event_date, status, and event type toggles)
 */
export async function PATCH(
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

    const eventId = decodeURIComponent(params.eventId);
    const body = await request.json();

    // Check if any valid field is provided
    const hasDateUpdate = body.event_date !== undefined;
    const hasStatusUpdate = body.status !== undefined;
    const hasStaffUpdate = body.assigned_staff !== undefined;
    const hasEventTypeUpdates =
      body.is_plus !== undefined ||
      body.is_kita !== undefined ||
      body.is_schulsong !== undefined ||
      body.is_minimusikertag !== undefined;
    const hasNotesUpdate = body.admin_notes !== undefined;
    const hasOverridesUpdate = body.timeline_overrides !== undefined;
    const hasChildrenUpdate = body.estimated_children !== undefined;

    if (!hasDateUpdate && !hasStatusUpdate && !hasStaffUpdate && !hasEventTypeUpdates && !hasNotesUpdate && !hasOverridesUpdate && !hasChildrenUpdate) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update. Supported: event_date, status, assigned_staff, is_plus, is_kita, is_schulsong, is_minimusikertag, admin_notes, timeline_overrides, estimated_children' },
        { status: 400 }
      );
    }

    // Validate timeline_overrides JSON if provided
    if (hasOverridesUpdate && body.timeline_overrides !== '') {
      try {
        const parsed = JSON.parse(body.timeline_overrides);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return NextResponse.json(
            { success: false, error: 'timeline_overrides must be a JSON object' },
            { status: 400 }
          );
        }
        // Validate all values are numbers within reasonable bounds (except known boolean/object keys)
        for (const [key, value] of Object.entries(parsed)) {
          if (key === 'milestones' || key === 'task_offsets') continue; // Phase 2 nested objects
          if (key === 'audio_hidden') {
            if (typeof value !== 'boolean') {
              return NextResponse.json(
                { success: false, error: `Invalid value for ${key}: must be a boolean` },
                { status: 400 }
              );
            }
            continue;
          }
          if (typeof value !== 'number' || !isFinite(value as number) || Math.abs(value as number) > 365) {
            return NextResponse.json(
              { success: false, error: `Invalid value for ${key}: must be a finite number between -365 and 365` },
              { status: 400 }
            );
          }
        }
      } catch {
        return NextResponse.json(
          { success: false, error: 'timeline_overrides must be valid JSON' },
          { status: 400 }
        );
      }
    }

    // Validate date format if provided
    if (hasDateUpdate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(body.event_date)) {
        return NextResponse.json(
          { success: false, error: 'Invalid date format. Expected YYYY-MM-DD' },
          { status: 400 }
        );
      }
    }

    // Validate status if provided (empty string clears the status)
    if (hasStatusUpdate && body.status !== '') {
      const validStatuses = ['Confirmed', 'On Hold', 'Cancelled', 'Pending'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { success: false, error: `Invalid status. Expected one of: ${validStatuses.join(', ')} (or empty string to clear)` },
          { status: 400 }
        );
      }
    }

    const airtableService = getAirtableService();

    // First, we need to get the Airtable record ID for this event
    // The eventId might be a simplybookId, event_id, or Airtable record ID
    let eventRecordId: string | null = null;

    // Try to find the event by event_id first
    const eventsByEventId = await airtableService.getEventsRecordIdByBookingId(eventId);
    if (eventsByEventId) {
      eventRecordId = eventsByEventId;
    }

    // If not found, try by simplybookId via SchoolBookings
    if (!eventRecordId && /^\d+$/.test(eventId)) {
      const booking = await airtableService.getSchoolBookingBySimplybookId(eventId);
      if (booking) {
        const eventRecord = await airtableService.getEventBySchoolBookingId(booking.id);
        if (eventRecord) {
          eventRecordId = eventRecord.id;
        }
      }
    }

    if (!eventRecordId) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Get existing event for activity logging
    const existingEvent = await airtableService.getEventById(eventRecordId);

    let dateResult: { message: string; bookingUpdated: boolean; simplybookId?: string } | null = null;
    let tasksRecalculated = 0;
    let simplybookSynced = false;
    let staffReassigned = false;
    let emailSentToNewStaff = false;

    // Handle date update
    if (hasDateUpdate) {
      const oldDate = existingEvent?.event_date || 'Unknown';
      dateResult = await airtableService.updateEventDate(eventRecordId, body.event_date);

      // Sync date change back to SimplyBook (best-effort)
      if (dateResult.simplybookId) {
        const sbResult = await simplybookService.editBookingDate(
          dateResult.simplybookId,
          body.event_date
        );
        simplybookSynced = sbResult.success;
        if (!sbResult.success) {
          console.warn(`SimplyBook sync failed for booking ${dateResult.simplybookId}: ${sbResult.error}`);
        }
      }

      // Log activity for date change
      getActivityService().logActivity({
        eventRecordId,
        activityType: 'date_changed',
        description: ActivityService.generateDescription('date_changed', {
          oldDate,
          newDate: body.event_date,
        }),
        actorEmail: admin.email,
        actorType: 'admin',
        metadata: { oldDate, newDate: body.event_date, simplybookSynced },
      });

      // Send admin notification for date change (or "booking confirmed" if first date)
      try {
        // Get booking details for notification
        let contactName = '';
        let contactEmail = '';
        let contactPhone = '';
        let schoolAddress = existingEvent?.school_address || '';
        let city = '';
        let estimatedChildren: number | undefined;

        if (existingEvent?.simplybook_booking?.[0]) {
          const booking = await airtableService.getSchoolBookingById(existingEvent.simplybook_booking[0]);
          if (booking) {
            contactName = booking.schoolContactName || '';
            contactEmail = booking.schoolContactEmail || '';
            contactPhone = booking.schoolPhone || '';
            schoolAddress = schoolAddress || booking.schoolAddress || '';
            city = booking.city || '';
            estimatedChildren = booking.estimatedChildren;
          }
        }

        // If the old date was empty, this is a pending booking getting its first date → "Booking Confirmed"
        const isFirstDateAssignment = !existingEvent?.event_date;

        if (isFirstDateAssignment) {
          await triggerNewBookingNotification({
            bookingId: eventId,
            schoolName: existingEvent?.school_name || '',
            contactName,
            contactEmail,
            contactPhone,
            eventDate: body.event_date,
            estimatedChildren,
            address: schoolAddress,
            city,
            status: 'Bestätigt',
          });
        } else {
          await triggerDateChangeNotification({
            bookingId: eventId,
            schoolName: existingEvent?.school_name || '',
            contactName,
            contactEmail,
            contactPhone,
            eventDate: body.event_date,
            address: schoolAddress,
            city,
            oldDate,
            newDate: body.event_date,
          });
        }
      } catch (notificationError) {
        console.warn('Could not send date change notification:', notificationError);
      }

      // Recalculate task deadlines for pending tasks
      if (body.recalculate_tasks !== false) {
        try {
          const taskService = getTaskService();
          const taskResult = await taskService.recalculateDeadlinesForEvent(
            eventRecordId,
            body.event_date
          );
          tasksRecalculated = taskResult.updatedCount;
        } catch (taskError) {
          console.error('Warning: Could not recalculate task deadlines:', taskError);
        }
      }
    }

    // Handle staff reassignment
    if (hasStaffUpdate) {
      const newStaffId = body.assigned_staff;
      const oldStaffId = existingEvent?.assigned_staff?.[0] || null;

      // Only process if staff is actually changing
      if (newStaffId !== oldStaffId) {
        const base = airtableService['base'];

        // Update the Event record's assigned_staff field
        await base(EVENTS_TABLE_ID).update(eventRecordId, {
          [EVENTS_FIELD_IDS.assigned_staff]: newStaffId ? [newStaffId] : [],
        });

        staffReassigned = true;

        // Get new staff details for email
        if (newStaffId) {
          try {
            const staffRecords = await base(PERSONEN_TABLE_ID)
              .select({
                filterByFormula: `RECORD_ID() = '${newStaffId}'`,
                maxRecords: 1,
                fields: [PERSONEN_FIELD_IDS.staff_name, PERSONEN_FIELD_IDS.email],
                returnFieldsByFieldId: true,
              })
              .firstPage();

            if (staffRecords.length > 0) {
              const staffRecord = staffRecords[0];
              const staffName = staffRecord.fields[PERSONEN_FIELD_IDS.staff_name] as string || '';
              const staffEmail = staffRecord.fields[PERSONEN_FIELD_IDS.email] as string || '';

              if (staffEmail) {
                // Get booking info for the event to include in email
                let schoolAddress = existingEvent?.school_address || '';
                let schoolPhone = existingEvent?.school_phone || '';
                let contactPerson = '';
                let contactEmail = '';

                // Try to get additional info from SchoolBookings if available
                if (existingEvent?.simplybook_booking?.[0]) {
                  try {
                    const booking = await airtableService.getSchoolBookingById(existingEvent.simplybook_booking[0]);
                    if (booking) {
                      schoolAddress = schoolAddress || booking.schoolAddress || '';
                      schoolPhone = schoolPhone || booking.schoolPhone || '';
                      contactPerson = booking.schoolContactName || '';
                      contactEmail = booking.schoolContactEmail || '';
                    }
                  } catch (e) {
                    console.warn('Could not fetch booking details for email:', e);
                  }
                }

                // Format event date for display
                const eventDate = body.event_date || existingEvent?.event_date || '';
                const formattedDate = eventDate ? new Date(eventDate).toLocaleDateString('de-DE', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }) : '';

                // Send email notification
                try {
                  const emailResult = await sendStaffReassignmentEmail(
                    staffEmail,
                    staffName,
                    {
                      staffName,
                      schoolName: existingEvent?.school_name || '',
                      eventDate: formattedDate,
                      schoolAddress,
                      contactPerson,
                      contactEmail,
                      contactPhone: schoolPhone,
                      staffPortalUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://minimusiker.app'}/staff`,
                    }
                  );
                  emailSentToNewStaff = emailResult.success;
                } catch (emailError) {
                  console.warn('Could not send staff reassignment email:', emailError);
                }
              }
            }
          } catch (staffError) {
            console.warn('Could not fetch new staff details:', staffError);
          }
        }

        // Log activity for staff reassignment
        getActivityService().logActivity({
          eventRecordId,
          activityType: newStaffId ? 'staff_assigned' : 'staff_unassigned',
          description: ActivityService.generateDescription(
            newStaffId ? 'staff_assigned' : 'staff_unassigned',
            { staffId: newStaffId || oldStaffId }
          ),
          actorEmail: admin.email,
          actorType: 'admin',
          metadata: { oldStaffId, newStaffId, emailSent: emailSentToNewStaff },
        });
      }
    }

    // Handle status and event type toggle updates
    let updatedEvent = existingEvent;
    if (hasStatusUpdate || hasEventTypeUpdates || hasChildrenUpdate) {
      const fieldUpdates: {
        status?: 'Confirmed' | 'On Hold' | 'Cancelled' | null;
        is_plus?: boolean;
        is_kita?: boolean;
        is_schulsong?: boolean;
        is_minimusikertag?: boolean;
        is_under_100?: boolean;
        estimated_children?: number;
      } = {};

      if (hasStatusUpdate) {
        // Empty string means clear the status
        fieldUpdates.status = body.status === '' ? null : body.status;
      }
      if (body.is_plus !== undefined) {
        fieldUpdates.is_plus = body.is_plus;
      }
      if (body.is_kita !== undefined) {
        fieldUpdates.is_kita = body.is_kita;
      }
      if (body.is_schulsong !== undefined) {
        fieldUpdates.is_schulsong = body.is_schulsong;
      }
      if (body.is_minimusikertag !== undefined) {
        fieldUpdates.is_minimusikertag = body.is_minimusikertag;
      }

      // Normalize: is_plus and is_minimusikertag are mutually exclusive
      if (fieldUpdates.is_plus === true) {
        fieldUpdates.is_minimusikertag = false;
      } else if (fieldUpdates.is_minimusikertag === true) {
        fieldUpdates.is_plus = false;
      }

      // Handle estimated_children update with auto-recalculated is_under_100
      if (hasChildrenUpdate) {
        fieldUpdates.estimated_children = body.estimated_children;
        fieldUpdates.is_under_100 = body.estimated_children < 100;
      }

      updatedEvent = await airtableService.updateEventFields(eventRecordId, fieldUpdates);

      // Auto-assign/remove engineers based on schulsong toggle
      if (body.is_schulsong !== undefined) {
        try {
          await airtableService.ensureDefaultEngineers(eventRecordId, body.is_schulsong);
        } catch (engineerError) {
          console.warn('Could not update engineer assignments:', engineerError);
        }
      }

      // Send cancellation notification if status changed to Cancelled
      if (hasStatusUpdate && body.status === 'Cancelled' && existingEvent?.status !== 'Cancelled') {
        try {
          // Get booking details for notification
          let contactName = '';
          let contactEmail = '';
          let contactPhone = '';
          let schoolAddress = existingEvent?.school_address || '';
          let city = '';

          if (existingEvent?.simplybook_booking?.[0]) {
            const booking = await airtableService.getSchoolBookingById(existingEvent.simplybook_booking[0]);
            if (booking) {
              contactName = booking.schoolContactName || '';
              contactEmail = booking.schoolContactEmail || '';
              contactPhone = booking.schoolPhone || '';
              schoolAddress = schoolAddress || booking.schoolAddress || '';
              city = booking.city || '';
            }
          }

          await triggerCancellationNotification({
            bookingId: eventId,
            schoolName: existingEvent?.school_name || '',
            contactName,
            contactEmail,
            contactPhone,
            eventDate: existingEvent?.event_date || '',
            address: schoolAddress,
            city,
            reason: 'cancelled',
          });
        } catch (notificationError) {
          console.warn('Could not send cancellation notification:', notificationError);
        }
      }
    }

    // Handle admin notes update
    if (hasNotesUpdate) {
      const base = airtableService['base'];
      await base(EVENTS_TABLE_ID).update(eventRecordId, {
        [EVENTS_FIELD_IDS.admin_notes]: body.admin_notes,
      });
    }

    // Handle timeline overrides update
    if (hasOverridesUpdate) {
      const base = airtableService['base'];
      await base(EVENTS_TABLE_ID).update(eventRecordId, {
        [EVENTS_FIELD_IDS.timeline_overrides]: body.timeline_overrides || '',
      });
    }

    return NextResponse.json({
      success: true,
      message: dateResult?.message || 'Event updated successfully',
      bookingUpdated: dateResult?.bookingUpdated || false,
      simplybookSynced,
      tasksRecalculated,
      staffReassigned,
      emailSentToNewStaff,
      data: updatedEvent,
    });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update event',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/events/[eventId]
 * Soft-delete an event by marking Event and SchoolBooking as deleted
 */
export async function DELETE(
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

    const eventId = decodeURIComponent(params.eventId);
    const airtableService = getAirtableService();

    // Resolve eventRecordId (same lookup logic as PATCH)
    let eventRecordId: string | null = null;

    const eventsByEventId = await airtableService.getEventsRecordIdByBookingId(eventId);
    if (eventsByEventId) {
      eventRecordId = eventsByEventId;
    }

    if (!eventRecordId && /^\d+$/.test(eventId)) {
      const booking = await airtableService.getSchoolBookingBySimplybookId(eventId);
      if (booking) {
        const eventRecord = await airtableService.getEventBySchoolBookingId(booking.id);
        if (eventRecord) {
          eventRecordId = eventRecord.id;
        }
      }
    }

    if (!eventRecordId) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Get event details before deletion for notification
    const existingEvent = await airtableService.getEventById(eventRecordId);
    let contactName = '';
    let contactEmail = '';
    let contactPhone = '';
    let schoolAddress = existingEvent?.school_address || '';
    let city = '';

    if (existingEvent?.simplybook_booking?.[0]) {
      try {
        const booking = await airtableService.getSchoolBookingById(existingEvent.simplybook_booking[0]);
        if (booking) {
          contactName = booking.schoolContactName || '';
          contactEmail = booking.schoolContactEmail || '';
          contactPhone = booking.schoolPhone || '';
          schoolAddress = schoolAddress || booking.schoolAddress || '';
          city = booking.city || '';
        }
      } catch (e) {
        console.warn('Could not fetch booking details for deletion notification:', e);
      }
    }

    // Soft-delete the event
    const result = await airtableService.softDeleteEvent(eventRecordId);

    // Log activity (fire-and-forget)
    getActivityService().logActivity({
      eventRecordId,
      activityType: 'event_deleted',
      description: ActivityService.generateDescription('event_deleted', {
        schoolName: result.schoolName,
      }),
      actorEmail: admin.email,
      actorType: 'admin',
      metadata: {
        eventId: result.eventId,
        schoolName: result.schoolName,
        bookingRecordId: result.bookingRecordId,
      },
    });

    // Send deletion notification
    try {
      await triggerCancellationNotification({
        bookingId: eventId,
        schoolName: result.schoolName || '',
        contactName,
        contactEmail,
        contactPhone,
        eventDate: existingEvent?.event_date || '',
        address: schoolAddress,
        city,
        reason: 'deleted',
      });
    } catch (notificationError) {
      console.warn('Could not send deletion notification:', notificationError);
    }

    return NextResponse.json({
      success: true,
      message: `Event "${result.schoolName}" has been deleted`,
    });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete event',
      },
      { status: 500 }
    );
  }
}
