import { NextResponse } from 'next/server';
import { simplybookService } from '@/lib/services/simplybookService';
import { SimplybookWebhookPayload } from '@/lib/types/simplybook';
import {
  SCHOOL_BOOKINGS_TABLE_ID,
  SCHOOL_BOOKINGS_FIELD_IDS,
} from '@/lib/types/airtable';
import { getEmailService } from '@/lib/services/emailService';
import { getAirtableService } from '@/lib/services/airtableService';
import { getR2Service } from '@/lib/services/r2Service';
import { getTeacherService } from '@/lib/services/teacherService';
import { generateEventId } from '@/lib/utils/eventIdentifiers';
import Airtable from 'airtable';

// Initialize Airtable
const airtableApiKey = process.env.AIRTABLE_API_KEY || '';
const airtableBaseId = process.env.AIRTABLE_BASE_ID || '';
const airtable = new Airtable({ apiKey: airtableApiKey }).base(airtableBaseId);

/**
 * POST /api/simplybook/webhook
 * Receives webhook notifications from SimplyBook when bookings are created/changed/cancelled
 */
export async function POST(request: Request) {
  try {
    const payload: SimplybookWebhookPayload = await request.json();

    console.log('SimplyBook webhook received:', {
      booking_id: payload.booking_id,
      notification_type: payload.notification_type,
      company: payload.company,
    });

    // Route to appropriate handler based on notification type
    if (payload.notification_type === 'change') {
      return handleBookingChange(payload);
    }

    if (payload.notification_type === 'cancel') {
      return handleBookingCancel(payload);
    }

    // Handle 'create' notification
    // Check if booking already exists (idempotency)
    const existingRecords = await airtable
      .table(SCHOOL_BOOKINGS_TABLE_ID)
      .select({
        filterByFormula: `{${SCHOOL_BOOKINGS_FIELD_IDS.simplybook_id}} = "${payload.booking_id}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (existingRecords.length > 0) {
      console.log(`Booking ${payload.booking_id} already exists, skipping`);
      return NextResponse.json({
        status: 'skipped',
        reason: 'Booking already exists',
        recordId: existingRecords[0].id,
      });
    }

    // Fetch full booking details from SimplyBook API
    const booking = await simplybookService.getBookingDetails(payload.booking_id);
    console.log('Fetched booking details:', {
      id: booking.id,
      client_name: booking.client_name,
      client_email: booking.client_email,
      start_date: booking.start_date,
    });

    // Map intake form fields to our schema
    const mappedData = simplybookService.mapIntakeFields(booking);
    console.log('Mapped booking data:', mappedData);

    // Look up Teams/Regionen record ID for linked field
    const regionRecordId = await simplybookService.findTeamsRegionenByName(mappedData.region);
    if (mappedData.region && !regionRecordId) {
      console.warn(`[SimplyBook] Region not found in Teams/Regionen: "${mappedData.region}"`);
    }
    console.log('Region record ID found:', regionRecordId);

    // Find staff by region for auto-assignment
    const staffId = await simplybookService.findStaffByRegion(mappedData.region);
    console.log('Staff ID found by region:', staffId);

    // Find existing Einrichtung (school) to link
    const einrichtungId = await simplybookService.findEinrichtungByName(
      mappedData.schoolName,
      mappedData.postalCode
    );
    console.log('Einrichtung ID found:', einrichtungId);

    // Create record in SchoolBookings table
    const record = await airtable.table(SCHOOL_BOOKINGS_TABLE_ID).create({
      [SCHOOL_BOOKINGS_FIELD_IDS.simplybook_id]: payload.booking_id,
      [SCHOOL_BOOKINGS_FIELD_IDS.simplybook_hash]: booking.code || booking.hash || payload.booking_hash,
      // School name is in "Client Name" field in SimplyBook
      [SCHOOL_BOOKINGS_FIELD_IDS.school_name]: booking.client_name || booking.client || '',
      [SCHOOL_BOOKINGS_FIELD_IDS.school_contact_name]: mappedData.contactPerson,
      [SCHOOL_BOOKINGS_FIELD_IDS.school_contact_email]: mappedData.contactEmail,
      [SCHOOL_BOOKINGS_FIELD_IDS.school_phone]: mappedData.phone || '',
      [SCHOOL_BOOKINGS_FIELD_IDS.school_address]: mappedData.address || '',
      [SCHOOL_BOOKINGS_FIELD_IDS.school_postal_code]: mappedData.postalCode || '',
      [SCHOOL_BOOKINGS_FIELD_IDS.region]: regionRecordId ? [regionRecordId] : [],
      [SCHOOL_BOOKINGS_FIELD_IDS.city]: mappedData.city || '',
      [SCHOOL_BOOKINGS_FIELD_IDS.estimated_children]: mappedData.numberOfChildren,
      [SCHOOL_BOOKINGS_FIELD_IDS.school_size_category]: mappedData.costCategory,
      [SCHOOL_BOOKINGS_FIELD_IDS.simplybook_status]: 'confirmed',
      // Booking date - use mappedData.bookingDate which has proper fallback logic
      [SCHOOL_BOOKINGS_FIELD_IDS.start_date]: mappedData.bookingDate,
      [SCHOOL_BOOKINGS_FIELD_IDS.end_date]: mappedData.bookingDate,
      [SCHOOL_BOOKINGS_FIELD_IDS.start_time]: booking.start_time || '',
      [SCHOOL_BOOKINGS_FIELD_IDS.end_time]: booking.end_time || '',
      // Link to staff if found
      ...(staffId && { [SCHOOL_BOOKINGS_FIELD_IDS.main_contact_person]: [staffId] }),
      // Link to Einrichtung if found
      ...(einrichtungId && { [SCHOOL_BOOKINGS_FIELD_IDS.einrichtung]: [einrichtungId] }),
    });

    console.log('Created SchoolBooking record:', record.id);

    // ========================================
    // Phase 3: Auto-create Events record & initialize R2 folder
    // ========================================
    let eventRecord = null;

    try {
      const airtableService = getAirtableService();
      const r2Service = getR2Service();

      // Generate deterministic event_id
      const eventId = generateEventId(
        booking.client_name || booking.client || '',
        'MiniMusiker', // Default event type
        mappedData.bookingDate
      );
      console.log('Generated event_id:', eventId);

      // Create Events record linked to SchoolBookings
      eventRecord = await airtableService.createEventFromBooking(
        eventId,
        record.id, // SchoolBookings record ID
        booking.client_name || booking.client || '',
        mappedData.bookingDate,
        staffId || undefined,
        booking.event_name || 'MiniMusiker', // SimplyBook service type, default to MiniMusiker if not provided
        mappedData.address, // School address
        mappedData.phone // School phone
      );
      console.log('Created Event record:', eventRecord.id, 'event_id:', eventId);

      // Initialize R2 event folder structure
      const initResult = await r2Service.initializeEventStructure(eventId);
      if (initResult.success) {
        console.log('Initialized R2 event structure for:', eventId);
      } else {
        console.warn('Failed to initialize R2 structure:', initResult.error);
      }

      // Try to get school logo from Einrichtung if linked
      let logoBuffer: Buffer | undefined;
      if (einrichtungId) {
        try {
          const logoUrl = await airtableService.getEinrichtungLogoUrl(einrichtungId);
          if (logoUrl) {
            // Fetch the logo image
            const logoResponse = await fetch(logoUrl);
            if (logoResponse.ok) {
              const arrayBuffer = await logoResponse.arrayBuffer();
              logoBuffer = Buffer.from(arrayBuffer);

              // Upload logo to event folder
              const logoUpload = await r2Service.uploadEventLogo(eventId, logoBuffer, 'png');
              if (logoUpload.success) {
                console.log('Copied school logo to event folder');
              }
            }
          }
        } catch (logoError) {
          console.warn('Could not fetch/copy school logo:', logoError);
        }
      }

      // Note: Printables are NOT auto-generated here. Admin will use "Confirm Printables"
      // button to customize text/QR positions before generating.

      // ========================================
      // Phase 3b: Auto-create default "Alle Kinder" class
      // This ensures parents can register even if teacher hasn't set up classes yet
      // ========================================
      if (eventRecord) {
        try {
          const teacherService = getTeacherService();
          const defaultClass = await teacherService.createDefaultClass({
            eventId,
            eventRecordId: eventRecord.id,
            schoolName: booking.client_name || booking.client || '',
            bookingDate: mappedData.bookingDate,
            estimatedChildren: mappedData.numberOfChildren,
          });

          if (defaultClass) {
            console.log(`Created default "Alle Kinder" class: ${defaultClass.classId}`);
          }
        } catch (defaultClassError) {
          // Don't fail webhook - event was created successfully
          console.error('Error creating default class:', defaultClassError);
        }
      }
    } catch (eventError) {
      // Log but don't fail the webhook - SchoolBookings was created successfully
      console.error('Error creating Event record:', eventError);
    }

    // ========================================
    // Auto-create Teacher record for portal access
    // ========================================
    if (mappedData.contactEmail) {
      try {
        const teacherService = getTeacherService();
        const teacher = await teacherService.findOrCreateTeacher({
          email: mappedData.contactEmail,
          name: mappedData.contactPerson || mappedData.schoolName,
          schoolName: mappedData.schoolName,
          simplybookBookingId: payload.booking_id,
          schoolAddress: mappedData.address,
          schoolPhone: mappedData.phone,
          regionRecordId: regionRecordId || undefined,
          eventRecordId: eventRecord?.id,
        });
        console.log(`Teacher found/created: ${teacher.email} (id: ${teacher.id})`);
      } catch (teacherError) {
        // Log but don't fail the webhook - booking creation succeeded
        console.error('Failed to create teacher:', teacherError);
      }
    }

    // Send email notification to assigned staff
    if (staffId) {
      try {
        // Fetch staff email from Airtable
        const staffRecord = await airtable.table('Staff').find(staffId);
        const staffEmail = staffRecord.get('Email') as string;
        const staffName = staffRecord.get('Name') as string;

        if (staffEmail) {
          const emailService = getEmailService();
          const result = await emailService.sendNewBookingAlert(
            staffEmail,
            staffName || 'Team Member',
            {
              schoolName: mappedData.schoolName,
              contactName: mappedData.contactPerson,
              contactEmail: mappedData.contactEmail,
              bookingDate: booking.start_date,
              estimatedChildren: mappedData.numberOfChildren,
              region: mappedData.region,
            }
          );

          if (result.success) {
            console.log(`Booking alert sent to staff ${staffEmail}`);
          } else {
            console.error('Failed to send booking alert:', result.error);
          }
        }
      } catch (emailError) {
        // Log but don't fail the webhook
        console.error('Error sending booking alert:', emailError);
      }
    }

    return NextResponse.json({
      status: 'created',
      recordId: record.id,
      bookingId: payload.booking_id,
      linkedSchool: !!einrichtungId,
      assignedStaff: !!staffId,
      schoolName: mappedData.schoolName,
      estimatedChildren: mappedData.numberOfChildren,
      costCategory: mappedData.costCategory,
      // Event creation status
      eventCreated: !!eventRecord,
      eventRecordId: eventRecord?.id,
      eventId: eventRecord?.event_id,
    });
  } catch (error) {
    console.error('SimplyBook webhook error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/simplybook/webhook
 * Health check endpoint for webhook configuration
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'SimplyBook webhook',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Handle booking change notifications from SimplyBook
 * Updates the existing SchoolBooking record with new details
 */
async function handleBookingChange(payload: SimplybookWebhookPayload) {
  console.log('[SimplyBook] Processing change notification for booking:', payload.booking_id);

  try {
    // Find existing booking record
    const existingRecords = await airtable
      .table(SCHOOL_BOOKINGS_TABLE_ID)
      .select({
        filterByFormula: `{${SCHOOL_BOOKINGS_FIELD_IDS.simplybook_id}} = "${payload.booking_id}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (existingRecords.length === 0) {
      console.warn('[SimplyBook] Booking not found for change notification:', payload.booking_id);
      return NextResponse.json({
        status: 'skipped',
        reason: 'Booking not found - may have been created before sync',
      });
    }

    const existingRecord = existingRecords[0];

    // Fetch updated booking details from SimplyBook API
    const booking = await simplybookService.getBookingDetails(payload.booking_id);
    const mappedData = simplybookService.mapIntakeFields(booking);

    console.log('[SimplyBook] Updating booking with new details:', {
      id: payload.booking_id,
      start_date: booking.start_date,
      schoolName: mappedData.schoolName,
    });

    // Look up Teams/Regionen record ID for linked field
    const regionRecordId = await simplybookService.findTeamsRegionenByName(mappedData.region);
    if (mappedData.region && !regionRecordId) {
      console.warn(`[SimplyBook] Region not found in Teams/Regionen: "${mappedData.region}"`);
    }

    // Update the record with new details
    await airtable.table(SCHOOL_BOOKINGS_TABLE_ID).update(existingRecord.id, {
      [SCHOOL_BOOKINGS_FIELD_IDS.school_name]: mappedData.schoolName || '',
      [SCHOOL_BOOKINGS_FIELD_IDS.school_contact_name]: mappedData.contactPerson,
      [SCHOOL_BOOKINGS_FIELD_IDS.school_contact_email]: mappedData.contactEmail,
      [SCHOOL_BOOKINGS_FIELD_IDS.school_phone]: mappedData.phone || '',
      [SCHOOL_BOOKINGS_FIELD_IDS.school_address]: mappedData.address || '',
      [SCHOOL_BOOKINGS_FIELD_IDS.school_postal_code]: mappedData.postalCode || '',
      [SCHOOL_BOOKINGS_FIELD_IDS.region]: regionRecordId ? [regionRecordId] : [],
      [SCHOOL_BOOKINGS_FIELD_IDS.city]: mappedData.city || '',
      [SCHOOL_BOOKINGS_FIELD_IDS.estimated_children]: mappedData.numberOfChildren,
      [SCHOOL_BOOKINGS_FIELD_IDS.school_size_category]: mappedData.costCategory,
      [SCHOOL_BOOKINGS_FIELD_IDS.start_date]: booking.start_date,
      [SCHOOL_BOOKINGS_FIELD_IDS.end_date]: booking.end_date,
      [SCHOOL_BOOKINGS_FIELD_IDS.start_time]: booking.start_time,
      [SCHOOL_BOOKINGS_FIELD_IDS.end_time]: booking.end_time,
    });

    console.log('[SimplyBook] Updated booking record:', existingRecord.id);

    // Ensure teacher exists for updated contact email
    if (mappedData.contactEmail) {
      try {
        const teacherService = getTeacherService();
        const airtableService = getAirtableService();
        // Try to find the linked Event for this booking
        const linkedEvent = await airtableService.getEventByBookingRecordId(existingRecord.id);
        const teacher = await teacherService.findOrCreateTeacher({
          email: mappedData.contactEmail,
          name: mappedData.contactPerson || mappedData.schoolName,
          schoolName: mappedData.schoolName,
          simplybookBookingId: payload.booking_id,
          schoolAddress: mappedData.address,
          schoolPhone: mappedData.phone,
          regionRecordId: regionRecordId || undefined,
          eventRecordId: linkedEvent?.id,
        });
        console.log(`[SimplyBook] Teacher found/created: ${teacher.email}`);
      } catch (teacherError) {
        console.error('[SimplyBook] Failed to create teacher:', teacherError);
      }
    }

    return NextResponse.json({
      status: 'updated',
      recordId: existingRecord.id,
      bookingId: payload.booking_id,
      changes: {
        start_date: booking.start_date,
        schoolName: mappedData.schoolName,
        estimatedChildren: mappedData.numberOfChildren,
      },
    });
  } catch (error) {
    console.error('[SimplyBook] Error handling booking change:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle booking cancel notifications from SimplyBook
 * Marks the booking as cancelled in Airtable
 */
async function handleBookingCancel(payload: SimplybookWebhookPayload) {
  console.log('[SimplyBook] Processing cancel notification for booking:', payload.booking_id);

  try {
    // Find existing booking record
    const existingRecords = await airtable
      .table(SCHOOL_BOOKINGS_TABLE_ID)
      .select({
        filterByFormula: `{${SCHOOL_BOOKINGS_FIELD_IDS.simplybook_id}} = "${payload.booking_id}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (existingRecords.length === 0) {
      console.warn('[SimplyBook] Booking not found for cancel notification:', payload.booking_id);
      return NextResponse.json({
        status: 'skipped',
        reason: 'Booking not found - may have been created before sync',
      });
    }

    const existingRecord = existingRecords[0];

    // Update status to cancelled
    await airtable.table(SCHOOL_BOOKINGS_TABLE_ID).update(existingRecord.id, {
      [SCHOOL_BOOKINGS_FIELD_IDS.simplybook_status]: 'cancelled',
    });

    console.log('[SimplyBook] Marked booking as cancelled:', existingRecord.id);

    // Note: Events linked to this SchoolBooking via simplybook_booking field will still
    // show this booking, and staff can see the cancelled status through that link

    return NextResponse.json({
      status: 'cancelled',
      recordId: existingRecord.id,
      bookingId: payload.booking_id,
    });
  } catch (error) {
    console.error('[SimplyBook] Error handling booking cancel:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
