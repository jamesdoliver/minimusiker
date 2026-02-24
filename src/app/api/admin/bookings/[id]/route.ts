import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { simplybookService } from '@/lib/services/simplybookService';
import { SCHOOL_BOOKINGS_FIELD_IDS } from '@/lib/types/airtable';
import { updateSchoolBookingById } from '@/lib/services/teacherService';
import { generateEventId } from '@/lib/utils/eventIdentifiers';
import { getR2Service } from '@/lib/services/r2Service';
import { getTeacherService } from '@/lib/services/teacherService';

export const dynamic = 'force-dynamic';

// Secondary contact interface
export interface SecondaryContact {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
}

// Request body interface
interface EditBookingRequest {
  school_name?: string;
  school_contact_name?: string;
  school_contact_email?: string;
  school_phone?: string;
  school_address?: string;
  school_postal_code?: string;
  city?: string;
  region?: string; // Record ID for linked record
  event_date?: string;
  start_time?: string;
  end_time?: string;
  estimated_children?: number;
  secondary_contacts?: SecondaryContact[];
}

// Response interface
interface EditBookingResponse {
  success: boolean;
  message: string;
  airtableUpdated: boolean;
  simplybookUpdated: boolean;
  simplybookError?: string;
  eventCreated?: boolean;
  statusPromoted?: boolean;
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * PATCH /api/admin/bookings/[id]
 * Update booking contact and location information
 * Syncs changes to both Airtable and SimplyBook
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<EditBookingResponse | { success: false; error: string }>> {
  try {
    // Verify admin authentication
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: bookingId } = await params;
    const body: EditBookingRequest = await request.json();

    // Validate request - at least one field must be provided
    const hasFields = Object.keys(body).some(
      (key) => body[key as keyof EditBookingRequest] !== undefined
    );
    if (!hasFields) {
      return NextResponse.json(
        { success: false, error: 'No fields provided for update' },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (body.school_contact_email && !EMAIL_REGEX.test(body.school_contact_email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate secondary contact emails if provided
    if (body.secondary_contacts) {
      for (const contact of body.secondary_contacts) {
        if (contact.email && !EMAIL_REGEX.test(contact.email)) {
          return NextResponse.json(
            { success: false, error: `Invalid email format for secondary contact: ${contact.name}` },
            { status: 400 }
          );
        }
      }
    }

    // Get booking from Airtable to verify it exists and get SimplyBook client ID
    const airtableService = getAirtableService();
    const booking = await airtableService.getSchoolBookingById(bookingId);

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    // Build Airtable update object using field IDs
    const updateFields: Record<string, string | number | string[]> = {};

    if (body.school_name !== undefined) {
      updateFields[SCHOOL_BOOKINGS_FIELD_IDS.school_name] = body.school_name;
    }
    if (body.school_contact_name !== undefined) {
      updateFields[SCHOOL_BOOKINGS_FIELD_IDS.school_contact_name] = body.school_contact_name;
    }
    if (body.school_contact_email !== undefined) {
      updateFields[SCHOOL_BOOKINGS_FIELD_IDS.school_contact_email] = body.school_contact_email;
    }
    if (body.school_phone !== undefined) {
      updateFields[SCHOOL_BOOKINGS_FIELD_IDS.school_phone] = body.school_phone;
    }
    if (body.school_address !== undefined) {
      updateFields[SCHOOL_BOOKINGS_FIELD_IDS.school_address] = body.school_address;
    }
    if (body.school_postal_code !== undefined) {
      updateFields[SCHOOL_BOOKINGS_FIELD_IDS.school_postal_code] = body.school_postal_code;
    }
    if (body.city !== undefined) {
      updateFields[SCHOOL_BOOKINGS_FIELD_IDS.city] = body.city;
    }
    if (body.region !== undefined) {
      // Region is a linked record - pass as array
      updateFields[SCHOOL_BOOKINGS_FIELD_IDS.region] = body.region ? [body.region] : [];
    }
    if (body.estimated_children !== undefined) {
      updateFields[SCHOOL_BOOKINGS_FIELD_IDS.estimated_children] = body.estimated_children;
    }
    // Store secondary contacts as JSON in long text field
    if (body.secondary_contacts !== undefined) {
      updateFields[SCHOOL_BOOKINGS_FIELD_IDS.secondary_contacts] = JSON.stringify(body.secondary_contacts);
    }

    // Date/time fields
    if (body.event_date !== undefined) {
      updateFields[SCHOOL_BOOKINGS_FIELD_IDS.start_date] = body.event_date;
      updateFields[SCHOOL_BOOKINGS_FIELD_IDS.end_date] = body.event_date;
    }
    if (body.start_time !== undefined) {
      updateFields[SCHOOL_BOOKINGS_FIELD_IDS.start_time] = body.start_time;
    }
    if (body.end_time !== undefined) {
      updateFields[SCHOOL_BOOKINGS_FIELD_IDS.end_time] = body.end_time;
    }

    // Status promotion: pending → confirmed when a date is set
    const shouldPromote = booking.simplybookStatus === 'pending' && !!body.event_date;
    if (shouldPromote) {
      updateFields[SCHOOL_BOOKINGS_FIELD_IDS.simplybook_status] = 'confirmed';
      console.log(`[EditBooking] Promoting booking ${bookingId} from pending to confirmed`);
    }

    // Update Airtable first
    let airtableUpdated = false;
    try {
      if (Object.keys(updateFields).length > 0) {
        await updateSchoolBookingById(bookingId, updateFields);
        airtableUpdated = true;
        console.log(`[EditBooking] Updated Airtable booking: ${bookingId}`);

        // Sync estimated_children to the linked Event record
        if (body.estimated_children !== undefined) {
          try {
            const linkedEvent = await airtableService.getEventByBookingRecordId(bookingId);
            if (linkedEvent) {
              await airtableService.updateEventFields(linkedEvent.id, {
                estimated_children: body.estimated_children,
                is_under_100: body.estimated_children < 100,
              });
              console.log(`[EditBooking] Synced estimated_children=${body.estimated_children} to Event ${linkedEvent.id}`);
            }
          } catch (eventErr) {
            console.warn('[EditBooking] Failed to sync estimated_children to Event:', eventErr);
          }
        }
      }
    } catch (airtableError) {
      console.error('[EditBooking] Airtable update failed:', airtableError);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to update Airtable: ${airtableError instanceof Error ? airtableError.message : 'Unknown error'}`,
        },
        { status: 500 }
      );
    }

    // Event creation on promotion: if booking had no event AND now has a date, create one
    let eventCreated = false;
    if (airtableUpdated && body.event_date) {
      try {
        const schoolName = booking.schoolName || booking.schoolContactName || 'Unknown';
        const eventId = generateEventId(schoolName, 'MiniMusiker', body.event_date);

        // Fast formula-based check instead of full table scan
        const existingEvent = await airtableService.getEventByEventId(eventId);
        if (!existingEvent) {
          const eventRecord = await airtableService.createEventFromBooking(
            eventId,
            bookingId,
            schoolName,
            body.event_date,
            undefined,
            'MiniMusiker',
            booking.schoolAddress || body.school_address || undefined,
            booking.schoolPhone || body.school_phone || undefined,
            undefined, // confirmed status (default)
            booking.estimatedChildren || undefined
          );
          console.log(`[EditBooking] Created Event ${eventRecord.id} for promoted booking ${bookingId}`);
          eventCreated = true;

          // Initialize R2 + default class
          const r2Service = getR2Service();
          await r2Service.initializeEventStructure(eventId).catch(err =>
            console.warn('[EditBooking] R2 init failed:', err)
          );

          try {
            const teacherService = getTeacherService();
            await teacherService.createDefaultClass({
              eventId,
              eventRecordId: eventRecord.id,
              schoolName,
              bookingDate: body.event_date,
              estimatedChildren: booking.estimatedChildren || 0,
            });
          } catch (classErr) {
            console.error('[EditBooking] Default class creation failed:', classErr);
          }
        }
      } catch (eventError) {
        console.error('[EditBooking] Event creation on promotion failed:', eventError);
      }
    }

    // Attempt SimplyBook sync if we have a SimplyBook booking ID
    let simplybookUpdated = false;
    let simplybookError: string | undefined;

    if (booking.simplybookId) {
      try {
        // Get booking details to retrieve client_id
        const simplybookBooking = await simplybookService.getBookingDetails(booking.simplybookId);

        if (simplybookBooking && simplybookBooking.client_id) {
          // Build SimplyBook client update data
          const clientData: {
            name?: string;
            email?: string;
            phone?: string;
            address1?: string;
            city?: string;
            zip?: string;
          } = {};

          if (body.school_name !== undefined) {
            clientData.name = body.school_name;
          } else if (body.school_contact_name !== undefined) {
            clientData.name = body.school_contact_name;
          }
          if (body.school_contact_email !== undefined) {
            clientData.email = body.school_contact_email;
          }
          if (body.school_phone !== undefined) {
            clientData.phone = body.school_phone;
          }
          if (body.school_address !== undefined) {
            clientData.address1 = body.school_address;
          }
          if (body.city !== undefined) {
            clientData.city = body.city;
          }
          if (body.school_postal_code !== undefined) {
            clientData.zip = body.school_postal_code;
          }

          // Only call editClient if we have data to update
          if (Object.keys(clientData).length > 0) {
            const result = await simplybookService.editClient(
              simplybookBooking.client_id,
              clientData
            );

            if (result.success) {
              simplybookUpdated = true;
              console.log(`[EditBooking] Updated SimplyBook client: ${simplybookBooking.client_id}`);
            } else {
              simplybookError = result.error;
              console.warn(`[EditBooking] SimplyBook update failed: ${result.error}`);
            }
          } else {
            // No SimplyBook-relevant fields to update
            simplybookUpdated = true; // Consider it "success" since there was nothing to do
          }
        } else {
          simplybookError = 'No client ID found in SimplyBook booking';
          console.warn(`[EditBooking] No client_id for SimplyBook booking: ${booking.simplybookId}`);
        }
      } catch (sbError) {
        simplybookError = sbError instanceof Error ? sbError.message : 'Unknown SimplyBook error';
        console.error('[EditBooking] SimplyBook sync error:', sbError);
      }
    } else {
      // No SimplyBook ID - this is informational, not an error
      simplybookError = 'No SimplyBook booking linked';
    }

    // Build response message
    let message = 'Booking updated successfully';
    if (airtableUpdated && !simplybookUpdated && simplybookError) {
      message = 'Booking updated in Airtable, but SimplyBook sync failed';
    } else if (!airtableUpdated) {
      message = 'No changes made';
    }

    return NextResponse.json({
      success: true,
      message,
      airtableUpdated,
      simplybookUpdated,
      simplybookError,
      eventCreated,
      statusPromoted: shouldPromote,
    });
  } catch (error) {
    console.error('[EditBooking] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update booking',
      },
      { status: 500 }
    );
  }
}
