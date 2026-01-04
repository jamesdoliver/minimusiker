import { NextResponse } from 'next/server';
import { simplybookService } from '@/lib/services/simplybookService';
import { SimplybookWebhookPayload } from '@/lib/types/simplybook';
import {
  SCHOOL_BOOKINGS_TABLE_ID,
  SCHOOL_BOOKINGS_FIELD_IDS,
} from '@/lib/types/airtable';
import { getEmailService } from '@/lib/services/emailService';
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
