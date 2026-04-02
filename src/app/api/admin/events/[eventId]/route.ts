import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTaskService } from '@/lib/services/taskService';
import { getActivityService, ActivityService } from '@/lib/services/activityService';
import { sendStaffReassignmentEmail } from '@/lib/services/resendService';
import { SchoolEventDetail, EVENTS_TABLE_ID, EVENTS_FIELD_IDS, PERSONEN_TABLE_ID, PERSONEN_FIELD_IDS, DealType, DealConfig } from '@/lib/types/airtable';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { simplybookService } from '@/lib/services/simplybookService';
import { generateEventId } from '@/lib/utils/eventIdentifiers';
import { parseOverrides } from '@/lib/utils/eventThresholds';
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
      const resolvedEventId = eventDetail.eventId || eventId;
      const allSongs = await teacherService.getSongsByEventId(resolvedEventId);

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
          songs: (songsByClass[cls.classId] || []).map((s) => ({ id: s.id, title: s.title, artist: s.artist, publicNotes: s.publicNotes, internalNotes: s.internalNotes, order: s.order, hiddenByEngineer: s.hiddenByEngineer })),
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
      dealBuilderEnabled?: boolean;
      dealType?: DealType | null;
      dealConfig?: DealConfig | null;
      estimatedChildren?: number;
      isUnder100?: boolean;
      standardMerchOverride?: 'force-standard' | 'force-personalized';
      schulsongReleasedAt?: string;
      schulsongMerchCutoff?: string;
      scsShirtsIncluded?: boolean;
      minicardOrderEnabled?: boolean;
      minicardOrderQuantity?: number;
      tracklistFinalizedAt?: string;
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
            dealBuilderEnabled: eventRecord.deal_builder_enabled,
            dealType: eventRecord.deal_type || null,
            dealConfig: eventRecord.deal_config || null,
            estimatedChildren: eventRecord.estimated_children,
            isUnder100: eventRecord.is_under_100,
            standardMerchOverride: eventRecord.standard_merch_override,
            schulsongReleasedAt: eventRecord.schulsong_released_at,
            schulsongMerchCutoff: eventRecord.schulsong_merch_cutoff,
            scsShirtsIncluded: eventRecord.scs_shirts_included,
            minicardOrderEnabled: eventRecord.minicard_order_enabled,
            minicardOrderQuantity: eventRecord.minicard_order_quantity,
            tracklistFinalizedAt: eventRecord.tracklist_finalized_at,
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
    const hasDealUpdate =
      body.deal_builder_enabled !== undefined ||
      body.deal_type !== undefined ||
      body.deal_config !== undefined;
    const hasStandardMerchOverride = body.standard_merch_override !== undefined;
    const hasMerchCutoffUpdate = body.schulsong_merch_cutoff !== undefined;
    const hasBulkOrderUpdate =
      body.scs_shirts_included !== undefined ||
      body.minicard_order_enabled !== undefined ||
      body.minicard_order_quantity !== undefined;

    if (!hasDateUpdate && !hasStatusUpdate && !hasStaffUpdate && !hasEventTypeUpdates && !hasNotesUpdate && !hasOverridesUpdate && !hasChildrenUpdate && !hasDealUpdate && !hasStandardMerchOverride && !hasMerchCutoffUpdate && !hasBulkOrderUpdate) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update. Supported: event_date, status, assigned_staff, is_plus, is_kita, is_schulsong, is_minimusikertag, admin_notes, timeline_overrides, estimated_children, deal_builder_enabled, deal_type, deal_config, standard_merch_override, schulsong_merch_cutoff, scs_shirts_included, minicard_order_enabled, minicard_order_quantity' },
        { status: 400 }
      );
    }

    // Validate deal_type if provided
    if (body.deal_type !== undefined && body.deal_type !== null) {
      const validDealTypes: DealType[] = ['mimu', 'mimu_scs', 'schus', 'schus_xl'];
      if (!validDealTypes.includes(body.deal_type)) {
        return NextResponse.json(
          { success: false, error: `Invalid deal_type. Expected one of: ${validDealTypes.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate minicard_order_quantity if provided
    if (body.minicard_order_quantity !== undefined && body.minicard_order_quantity !== null) {
      if (typeof body.minicard_order_quantity !== 'number' || body.minicard_order_quantity < 0 || body.minicard_order_quantity > 10000) {
        return NextResponse.json(
          { success: false, error: 'minicard_order_quantity must be a number between 0 and 10000' },
          { status: 400 }
        );
      }
    }

    // Validate deal_config JSON if provided
    if (body.deal_config !== undefined && body.deal_config !== null) {
      if (typeof body.deal_config !== 'object') {
        return NextResponse.json(
          { success: false, error: 'deal_config must be a JSON object' },
          { status: 400 }
        );
      }
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
          if (key === 'hidden_products') {
            if (!Array.isArray(value) || !value.every((v: unknown) => typeof v === 'string')) {
              return NextResponse.json(
                { success: false, error: `Invalid value for ${key}: must be an array of strings` },
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
    let resolvedBookingRecordId: string | null = null;

    // Try to find the event by event_id first
    const eventsByEventId = await airtableService.getEventsRecordIdByBookingId(eventId);
    if (eventsByEventId) {
      eventRecordId = eventsByEventId;
    }

    // If not found, try by simplybookId via SchoolBookings (supports manual codes like "M-a3f9b2")
    if (!eventRecordId) {
      const booking = await airtableService.getSchoolBookingBySimplybookId(eventId);
      if (booking) {
        resolvedBookingRecordId = booking.id;
        const eventRecord = await airtableService.getEventBySchoolBookingId(booking.id);
        if (eventRecord) {
          eventRecordId = eventRecord.id;
        } else {
          // Auto-create Event for bookings missing one (e.g., pending bookings where creation failed)
          const schoolName = booking.schoolName || booking.schoolContactName || 'Unknown';
          const eventDate = booking.startDate || new Date().toISOString().split('T')[0];
          const isPending = !booking.startDate;
          const newEventId = generateEventId(schoolName, 'MiniMusiker', booking.startDate || undefined);
          const newEvent = await airtableService.createEventFromBooking(
            newEventId,
            booking.id,
            schoolName,
            eventDate,
            undefined,
            'MiniMusiker',
            booking.schoolAddress || undefined,
            booking.schoolPhone || undefined,
            isPending ? 'Pending' : undefined,
            booking.estimatedChildren ?? undefined
          );
          eventRecordId = newEvent.id;
          console.log(`[PATCH events] Auto-created Event ${newEvent.id} for booking ${eventId}`);
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
      // Resolve booking record ID for fallback date propagation
      if (!resolvedBookingRecordId && existingEvent?.simplybook_booking?.[0]) {
        resolvedBookingRecordId = existingEvent.simplybook_booking[0];
      }
      dateResult = await airtableService.updateEventDate(eventRecordId, body.event_date, resolvedBookingRecordId || undefined);

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
                      staffPortalUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app'}/staff`,
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
    if (hasStatusUpdate || hasEventTypeUpdates || hasChildrenUpdate || hasStandardMerchOverride) {
      const fieldUpdates: {
        status?: 'Confirmed' | 'On Hold' | 'Cancelled' | null;
        is_plus?: boolean;
        is_kita?: boolean;
        is_schulsong?: boolean;
        is_minimusikertag?: boolean;
        is_under_100?: boolean;
        estimated_children?: number;
        standard_merch_override?: 'force-standard' | 'force-personalized' | null;
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

      // Handle standard merch override (null/auto = auto, based on is_under_100)
      if (hasStandardMerchOverride) {
        const val = body.standard_merch_override;
        if (val === null || val === 'auto') {
          fieldUpdates.standard_merch_override = null; // Clear → auto mode
        } else if (val === 'force-standard' || val === 'force-personalized') {
          fieldUpdates.standard_merch_override = val;
        } else {
          return NextResponse.json(
            { success: false, error: 'Invalid standard_merch_override. Expected: auto, force-standard, force-personalized, or null' },
            { status: 400 }
          );
        }
      }

      updatedEvent = await airtableService.updateEventFields(eventRecordId, fieldUpdates);

      // Log activity for status change (fire-and-forget) — only if value actually changed
      if (hasStatusUpdate && body.status !== undefined && body.status !== existingEvent?.status) {
        getActivityService().logActivity({
          eventRecordId,
          activityType: 'status_changed',
          description: `Status changed to "${body.status || 'none'}"`,
          actorEmail: admin.email,
          actorType: 'admin',
          metadata: { oldStatus: existingEvent?.status, newStatus: body.status },
        });
      }

      // Log activity for event type toggles (fire-and-forget) — only if at least one toggle actually changed
      if (hasEventTypeUpdates) {
        const hasActualChange =
          (body.is_plus !== undefined && body.is_plus !== existingEvent?.is_plus) ||
          (body.is_minimusikertag !== undefined && body.is_minimusikertag !== existingEvent?.is_minimusikertag) ||
          (body.is_schulsong !== undefined && body.is_schulsong !== existingEvent?.is_schulsong) ||
          (body.is_kita !== undefined && body.is_kita !== existingEvent?.is_kita);

        if (hasActualChange) {
          const changes: string[] = [];
          if (body.is_plus !== undefined) changes.push(`is_plus → ${body.is_plus}`);
          if (body.is_minimusikertag !== undefined) changes.push(`is_minimusikertag → ${body.is_minimusikertag}`);
          if (body.is_schulsong !== undefined) changes.push(`is_schulsong → ${body.is_schulsong}`);
          if (body.is_kita !== undefined) changes.push(`is_kita → ${body.is_kita}`);
          getActivityService().logActivity({
            eventRecordId,
            activityType: 'event_type_changed',
            description: `Event type updated: ${changes.join(', ')}`,
            actorEmail: admin.email,
            actorType: 'admin',
            metadata: {
              old_is_plus: existingEvent?.is_plus, is_plus: body.is_plus,
              old_is_minimusikertag: existingEvent?.is_minimusikertag, is_minimusikertag: body.is_minimusikertag,
              old_is_schulsong: existingEvent?.is_schulsong, is_schulsong: body.is_schulsong,
              old_is_kita: existingEvent?.is_kita, is_kita: body.is_kita,
            },
          });
        }
      }

      // Log activity for estimated children update (fire-and-forget) — only if value actually changed
      if (hasChildrenUpdate && body.estimated_children !== existingEvent?.estimated_children) {
        getActivityService().logActivity({
          eventRecordId,
          activityType: 'children_updated',
          description: `Estimated children updated to ${body.estimated_children}`,
          actorEmail: admin.email,
          actorType: 'admin',
          metadata: { oldCount: existingEvent?.estimated_children, newCount: body.estimated_children },
        });
      }

      // Log activity for standard merch override (fire-and-forget) — only if value actually changed
      if (hasStandardMerchOverride && body.standard_merch_override !== existingEvent?.standard_merch_override) {
        getActivityService().logActivity({
          eventRecordId,
          activityType: 'merch_override_changed',
          description: `Standard merch override set to "${body.standard_merch_override || 'auto'}"`,
          actorEmail: admin.email,
          actorType: 'admin',
          metadata: { oldOverride: existingEvent?.standard_merch_override, newOverride: body.standard_merch_override },
        });
      }

      // Auto-assign/remove engineers based on schulsong toggle
      if (body.is_schulsong !== undefined) {
        try {
          await airtableService.ensureDefaultEngineers(eventRecordId, body.is_schulsong);
        } catch (engineerError) {
          console.warn('Could not update engineer assignments:', engineerError);
        }

        // Reverse flow: auto-create linked Schulsong when is_schulsong is toggled on
        if (body.is_schulsong === true) {
          try {
            const existingSchulsong = await airtableService.getSchulsongByEventId(eventRecordId);
            if (!existingSchulsong) {
              await airtableService.createSchulsongFromEvent(eventRecordId);
              console.log(`Auto-created Schulsong for event ${eventRecordId}`);
            }
          } catch (schulsongError) {
            console.warn('Could not auto-create Schulsong from event:', schulsongError);
          }
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

      getActivityService().logActivity({
        eventRecordId,
        activityType: 'notes_updated',
        description: 'Admin notes updated',
        actorEmail: admin.email,
        actorType: 'admin',
      });
    }

    // Handle timeline overrides update
    if (hasOverridesUpdate) {
      const base = airtableService['base'];
      await base(EVENTS_TABLE_ID).update(eventRecordId, {
        [EVENTS_FIELD_IDS.timeline_overrides]: body.timeline_overrides || '',
      });

      getActivityService().logActivity({
        eventRecordId,
        activityType: 'timeline_updated',
        description: 'Timeline overrides updated',
        actorEmail: admin.email,
        actorType: 'admin',
      });
    }

    // Handle schulsong merch cutoff update (admin override)
    if (hasMerchCutoffUpdate) {
      const base = airtableService['base'];
      // Allow clearing (null/empty) or setting a date string
      const cutoffValue = body.schulsong_merch_cutoff || null;
      await base(EVENTS_TABLE_ID).update(eventRecordId, {
        [EVENTS_FIELD_IDS.schulsong_merch_cutoff]: cutoffValue,
      });

      getActivityService().logActivity({
        eventRecordId,
        activityType: 'merch_cutoff_changed',
        description: `Schulsong merch cutoff ${body.schulsong_merch_cutoff ? 'updated' : 'cleared'}`,
        actorEmail: admin.email,
        actorType: 'admin',
        metadata: { schulsongMerchCutoff: body.schulsong_merch_cutoff },
      });
    }

    // Auto-toggle communications_paused when status changes to/from Pending
    // Runs AFTER hasOverridesUpdate so the flag is merged into whatever was just written
    if (hasStatusUpdate) {
      const oldStatus = existingEvent?.status;
      const newStatus = body.status;
      const changingToPending = newStatus === 'Pending' && oldStatus !== 'Pending';
      const changingFromPending = oldStatus === 'Pending' && newStatus !== 'Pending';

      if (changingToPending || changingFromPending) {
        try {
          // Read from admin-provided overrides if present, else from existing event
          const overridesSource = hasOverridesUpdate
            ? body.timeline_overrides
            : existingEvent?.timeline_overrides;
          const currentOverrides = parseOverrides(overridesSource) || {};

          if (changingToPending) {
            currentOverrides.communications_paused = true;
          } else {
            delete currentOverrides.communications_paused;
          }

          const overridesJson = Object.keys(currentOverrides).length > 0
            ? JSON.stringify(currentOverrides)
            : '';

          const base = airtableService['base'];
          await base(EVENTS_TABLE_ID).update(eventRecordId, {
            [EVENTS_FIELD_IDS.timeline_overrides]: overridesJson,
          });

          console.log(`[Status] Auto-${changingToPending ? 'enabled' : 'disabled'} communications_paused for event ${eventId}`);
        } catch (pauseError) {
          console.warn('Could not auto-toggle communications_paused:', pauseError);
        }
      }
    }

    // Handle deal builder updates
    if (hasDealUpdate) {
      const dealFieldUpdates: Record<string, unknown> = {};

      if (body.deal_builder_enabled !== undefined) {
        dealFieldUpdates.deal_builder_enabled = body.deal_builder_enabled;
      }
      if (body.deal_type !== undefined) {
        dealFieldUpdates.deal_type = body.deal_type;
      }
      if (body.deal_config !== undefined) {
        dealFieldUpdates.deal_config = body.deal_config ? JSON.stringify(body.deal_config) : '';
      }

      updatedEvent = await airtableService.updateEventFields(eventRecordId, dealFieldUpdates);

      // Log activity for deal type change
      if (body.deal_type !== undefined) {
        getActivityService().logActivity({
          eventRecordId,
          activityType: 'deal_type_changed',
          description: `Deal type ${body.deal_type ? `set to #${body.deal_type}` : 'cleared'}`,
          actorEmail: admin.email,
          actorType: 'admin',
          metadata: {
            dealType: body.deal_type,
            dealConfig: body.deal_config,
            dealBuilderEnabled: body.deal_builder_enabled,
          },
        });
      }

      // Log activity for deal config change (when only config changes, no type change)
      if (body.deal_config !== undefined && body.deal_type === undefined) {
        getActivityService().logActivity({
          eventRecordId,
          activityType: 'deal_config_saved',
          description: `Deal configuration updated${body.deal_config?.calculated_fee != null ? ` (total: €${body.deal_config.calculated_fee})` : ''}`,
          actorEmail: admin.email,
          actorType: 'admin',
          metadata: { calculatedFee: body.deal_config?.calculated_fee },
        });
      }
    }

    // Handle bulk order field updates
    if (hasBulkOrderUpdate) {
      const bulkOrderFields: Record<string, unknown> = {};
      if (body.scs_shirts_included !== undefined) {
        bulkOrderFields.scs_shirts_included = body.scs_shirts_included;
      }
      if (body.minicard_order_enabled !== undefined) {
        bulkOrderFields.minicard_order_enabled = body.minicard_order_enabled;
      }
      if (body.minicard_order_quantity !== undefined) {
        bulkOrderFields.minicard_order_quantity = body.minicard_order_quantity;
      }
      updatedEvent = await airtableService.updateEventFields(eventRecordId, bulkOrderFields);

      const changes: string[] = [];
      if (body.scs_shirts_included !== undefined) changes.push(`SCS shirts: ${body.scs_shirts_included ? 'enabled' : 'disabled'}`);
      if (body.minicard_order_enabled !== undefined) changes.push(`Minicard order: ${body.minicard_order_enabled ? 'enabled' : 'disabled'}`);
      if (body.minicard_order_quantity !== undefined) changes.push(`Minicard qty: ${body.minicard_order_quantity}`);
      getActivityService().logActivity({
        eventRecordId,
        activityType: 'bulk_order_updated',
        description: `Bulk order updated: ${changes.join(', ')}`,
        actorEmail: admin.email,
        actorType: 'admin',
        metadata: { scsShirtsIncluded: body.scs_shirts_included, minicardOrderEnabled: body.minicard_order_enabled, minicardOrderQuantity: body.minicard_order_quantity },
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

    // If not found, try by simplybookId via SchoolBookings (supports manual codes like "M-a3f9b2")
    let orphanedBooking: { id: string; schoolName: string } | null = null;
    if (!eventRecordId) {
      const booking = await airtableService.getSchoolBookingBySimplybookId(eventId);
      if (booking) {
        const eventRecord = await airtableService.getEventBySchoolBookingId(booking.id);
        if (eventRecord) {
          eventRecordId = eventRecord.id;
        } else {
          // Booking exists but has no linked Event — mark as orphaned for fallback deletion
          orphanedBooking = { id: booking.id, schoolName: booking.schoolName || 'Unknown School' };
        }
      }
    }

    if (!eventRecordId) {
      // Handle orphaned bookings (SchoolBooking exists but no Event record)
      if (orphanedBooking) {
        await airtableService.softDeleteSchoolBooking(orphanedBooking.id);
        console.log(`[DELETE] Soft-deleted orphaned booking "${orphanedBooking.schoolName}" (${orphanedBooking.id}) by ${admin.email}`);

        return NextResponse.json({
          success: true,
          message: `Booking "${orphanedBooking.schoolName}" has been deleted (no linked event)`,
        });
      }

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
