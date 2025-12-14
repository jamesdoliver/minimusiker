import { NextResponse } from 'next/server';
import { simplybookService } from '@/lib/services/simplybookService';
import {
  SCHOOL_BOOKINGS_TABLE_ID,
  SCHOOL_BOOKINGS_FIELD_IDS,
} from '@/lib/types/airtable';
import Airtable from 'airtable';

// Initialize Airtable
const airtableApiKey = process.env.AIRTABLE_API_KEY || '';
const airtableBaseId = process.env.AIRTABLE_BASE_ID || '';
const airtable = new Airtable({ apiKey: airtableApiKey }).base(airtableBaseId);

/**
 * POST /api/admin/bookings/sync
 * One-time sync of future bookings from SimplyBook to Airtable
 * Fetches all bookings from today onwards and creates Airtable records
 */
export async function POST() {
  try {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    console.log(`Starting sync of future bookings from ${today}`);

    // Fetch future bookings from SimplyBook
    const rawBookings = await simplybookService.getBookings({
      dateFrom: today,
    });

    console.log(`Found ${rawBookings.length} future bookings in SimplyBook`);

    // Track results
    const results = {
      total: rawBookings.length,
      created: 0,
      skipped: 0,
      errors: 0,
      details: [] as { bookingId: string; status: string; error?: string }[],
    };

    // Log a sample booking to see the data structure
    if (rawBookings.length > 0) {
      console.log('Sample booking data:', JSON.stringify(rawBookings[0], null, 2));
    }

    // Process each booking
    for (const rawBooking of rawBookings) {
      try {
        // Check if booking already exists in Airtable
        const existingRecords = await airtable
          .table(SCHOOL_BOOKINGS_TABLE_ID)
          .select({
            filterByFormula: `{${SCHOOL_BOOKINGS_FIELD_IDS.simplybook_id}} = "${rawBooking.id}"`,
            maxRecords: 1,
          })
          .firstPage();

        if (existingRecords.length > 0) {
          results.skipped++;
          results.details.push({
            bookingId: rawBooking.id,
            status: 'skipped',
          });
          continue;
        }

        // Use data from getBookings directly (getBookingDetails has auth issues)
        // Note: additional_fields may be limited, so we use client_name/email as fallback
        const booking = rawBooking;

        // Map intake form fields (will use fallback to client_name/email if no additional_fields)
        const mappedData = simplybookService.mapIntakeFields(booking);

        // Find staff by region for auto-assignment
        const staffId = await simplybookService.findStaffByRegion(mappedData.region);

        // Find existing Einrichtung (school) to link
        const einrichtungId = await simplybookService.findEinrichtungByName(
          mappedData.schoolName,
          mappedData.postalCode
        );

        // Parse date/time from SimplyBook format "YYYY-MM-DD HH:MM:SS"
        // Airtable Date field needs "YYYY-MM-DD", time fields can be "HH:MM:SS"
        const parseDateTime = (dateTimeStr: string | undefined): { date: string; time: string } => {
          if (!dateTimeStr) return { date: '', time: '' };
          const parts = dateTimeStr.split(' ');
          return {
            date: parts[0] || '',  // "2026-06-02"
            time: parts[1] || '',  // "08:00:00"
          };
        };

        const startParsed = parseDateTime(booking.start_date);
        const endParsed = parseDateTime(booking.end_date);

        // Determine status from is_confirmed field
        const isConfirmed = booking.is_confirmed === true;

        // Create record in Airtable
        // Note: Region field is a single-select with predefined options - we skip it
        // since SimplyBook uses different region names. Region can be set via staff link.
        await airtable.table(SCHOOL_BOOKINGS_TABLE_ID).create({
          [SCHOOL_BOOKINGS_FIELD_IDS.simplybook_id]: booking.id,
          [SCHOOL_BOOKINGS_FIELD_IDS.simplybook_hash]: booking.hash || booking.code || '',
          [SCHOOL_BOOKINGS_FIELD_IDS.school_contact_name]: mappedData.contactPerson || booking.client || booking.text || '',
          [SCHOOL_BOOKINGS_FIELD_IDS.school_contact_email]: mappedData.contactEmail || booking.client_email || '',
          [SCHOOL_BOOKINGS_FIELD_IDS.school_phone]: mappedData.phone || booking.client_phone || '',
          [SCHOOL_BOOKINGS_FIELD_IDS.school_address]: mappedData.address || '',
          [SCHOOL_BOOKINGS_FIELD_IDS.school_postal_code]: mappedData.postalCode || '',
          // Skip region field - it's a single-select with predefined options
          // [SCHOOL_BOOKINGS_FIELD_IDS.region]: mappedData.region || booking.unit || '',
          [SCHOOL_BOOKINGS_FIELD_IDS.estimated_children]: mappedData.numberOfChildren,
          [SCHOOL_BOOKINGS_FIELD_IDS.school_size_category]: mappedData.costCategory,
          [SCHOOL_BOOKINGS_FIELD_IDS.simplybook_status]: isConfirmed ? 'confirmed' : 'pending',
          // Booking date/time fields - parse from datetime format
          [SCHOOL_BOOKINGS_FIELD_IDS.start_date]: startParsed.date,
          [SCHOOL_BOOKINGS_FIELD_IDS.end_date]: endParsed.date,
          [SCHOOL_BOOKINGS_FIELD_IDS.start_time]: startParsed.time,
          [SCHOOL_BOOKINGS_FIELD_IDS.end_time]: endParsed.time,
          // Link to staff if found
          ...(staffId && { [SCHOOL_BOOKINGS_FIELD_IDS.main_contact_person]: [staffId] }),
          // Link to Einrichtung if found
          ...(einrichtungId && { [SCHOOL_BOOKINGS_FIELD_IDS.einrichtung]: [einrichtungId] }),
        });

        results.created++;
        results.details.push({
          bookingId: rawBooking.id,
          status: 'created',
        });

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        results.errors++;
        results.details.push({
          bookingId: rawBooking.id,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        console.error(`Error syncing booking ${rawBooking.id}:`, error);
      }
    }

    console.log('Sync complete:', results);

    return NextResponse.json({
      success: true,
      message: `Synced ${results.created} bookings, skipped ${results.skipped} existing, ${results.errors} errors`,
      results,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/bookings/sync
 * Returns info about the sync endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/admin/bookings/sync',
    method: 'POST',
    description: 'One-time sync of future bookings from SimplyBook to Airtable',
    note: 'This will fetch all bookings from today onwards and create Airtable records for any that do not already exist.',
  });
}
