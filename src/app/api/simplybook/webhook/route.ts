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
import { getPrintableService } from '@/lib/services/printableService';
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

    // Only process 'create' notifications for now
    // TODO: Handle 'change' and 'cancel' notifications
    if (payload.notification_type !== 'create') {
      console.log(`Ignoring ${payload.notification_type} notification`);
      return NextResponse.json({
        status: 'ignored',
        reason: `Notification type '${payload.notification_type}' not processed`,
      });
    }

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
      [SCHOOL_BOOKINGS_FIELD_IDS.simplybook_hash]: payload.booking_hash,
      [SCHOOL_BOOKINGS_FIELD_IDS.school_name]: mappedData.schoolName || '',
      [SCHOOL_BOOKINGS_FIELD_IDS.school_contact_name]: mappedData.contactPerson,
      [SCHOOL_BOOKINGS_FIELD_IDS.school_contact_email]: mappedData.contactEmail,
      [SCHOOL_BOOKINGS_FIELD_IDS.school_phone]: mappedData.phone || '',
      [SCHOOL_BOOKINGS_FIELD_IDS.school_address]: mappedData.address || '',
      [SCHOOL_BOOKINGS_FIELD_IDS.school_postal_code]: mappedData.postalCode || '',
      [SCHOOL_BOOKINGS_FIELD_IDS.region]: mappedData.region || '',
      [SCHOOL_BOOKINGS_FIELD_IDS.city]: mappedData.city || mappedData.region || '',
      [SCHOOL_BOOKINGS_FIELD_IDS.estimated_children]: mappedData.numberOfChildren,
      [SCHOOL_BOOKINGS_FIELD_IDS.school_size_category]: mappedData.costCategory,
      [SCHOOL_BOOKINGS_FIELD_IDS.simplybook_status]: 'confirmed',
      // Booking date/time fields
      [SCHOOL_BOOKINGS_FIELD_IDS.start_date]: booking.start_date,
      [SCHOOL_BOOKINGS_FIELD_IDS.end_date]: booking.end_date,
      [SCHOOL_BOOKINGS_FIELD_IDS.start_time]: booking.start_time,
      [SCHOOL_BOOKINGS_FIELD_IDS.end_time]: booking.end_time,
      // Link to staff if found
      ...(staffId && { [SCHOOL_BOOKINGS_FIELD_IDS.main_contact_person]: [staffId] }),
      // Link to Einrichtung if found
      ...(einrichtungId && { [SCHOOL_BOOKINGS_FIELD_IDS.einrichtung]: [einrichtungId] }),
    });

    console.log('Created SchoolBooking record:', record.id);

    // ========================================
    // Phase 3: Auto-create Events record & generate printables
    // ========================================
    let eventRecord = null;
    let printablesResult = null;

    try {
      const airtableService = getAirtableService();
      const r2Service = getR2Service();
      const printableService = getPrintableService();

      // Generate deterministic event_id
      const eventId = generateEventId(
        mappedData.schoolName,
        'MiniMusiker', // Default event type
        booking.start_date
      );
      console.log('Generated event_id:', eventId);

      // Create Events record linked to SchoolBookings
      eventRecord = await airtableService.createEventFromBooking(
        eventId,
        record.id, // SchoolBookings record ID
        mappedData.schoolName,
        booking.start_date,
        staffId || undefined
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

      // Generate printables (non-blocking - log errors but don't fail webhook)
      try {
        printablesResult = await printableService.generateAllPrintables(
          eventId,
          mappedData.schoolName,
          booking.start_date,
          logoBuffer
        );

        if (printablesResult.success) {
          console.log('Generated all printables for event:', eventId);
        } else {
          console.warn('Some printables failed:', printablesResult.errors);
        }
      } catch (printError) {
        console.warn('Printable generation failed (templates may not be uploaded):', printError);
      }
    } catch (eventError) {
      // Log but don't fail the webhook - SchoolBookings was created successfully
      console.error('Error creating Event record or generating printables:', eventError);
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
      printablesGenerated: printablesResult?.success ?? false,
      printablesErrors: printablesResult?.errors ?? [],
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
