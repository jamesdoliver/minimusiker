import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { EVENTS_TABLE_ID, EVENTS_FIELD_IDS } from '@/lib/types/airtable';

export const dynamic = 'force-dynamic';

interface StaffBooking {
  date: string;
  schoolName: string;
  eventId: string;
}

/**
 * GET /api/admin/staff/bookings
 * Fetch all bookings for a staff member within a date range
 *
 * Query params:
 * - staffId: Airtable record ID of the staff member (required)
 * - startDate: YYYY-MM-DD format (required)
 * - endDate: YYYY-MM-DD format (required)
 *
 * Response: { bookings: [{ date: "2026-01-14", schoolName: "Example School", eventId: "..." }] }
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staffId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Validate required params
    if (!staffId) {
      return NextResponse.json(
        { success: false, error: 'staffId is required' },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate are required (YYYY-MM-DD format)' },
        { status: 400 }
      );
    }

    // Validate date formats
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format. Expected YYYY-MM-DD' },
        { status: 400 }
      );
    }

    const airtableService = getAirtableService();

    // Query Events table for events within the date range that have assigned staff
    // NOTE: ARRAYJOIN on linked records returns display names, not IDs
    // So we filter by date range in Airtable, then filter by staffId in JavaScript
    const filterFormula = `AND(
      {assigned_staff} != '',
      IS_AFTER({event_date}, DATEADD('${startDate}', -1, 'days')),
      IS_BEFORE({event_date}, DATEADD('${endDate}', 1, 'days')),
      {status} != 'Deleted',
      {status} != 'Cancelled'
    )`;

    // Access base directly through airtableService
    const base = airtableService['base'];
    const records = await base(EVENTS_TABLE_ID)
      .select({
        filterByFormula: filterFormula,
        fields: [
          EVENTS_FIELD_IDS.event_id,
          EVENTS_FIELD_IDS.event_date,
          EVENTS_FIELD_IDS.school_name,
          EVENTS_FIELD_IDS.assigned_staff,
        ],
        returnFieldsByFieldId: true,
      })
      .all();

    // Filter by staffId in JavaScript (since Airtable linked records can't be filtered by ID in formulas)
    const bookings: StaffBooking[] = records
      .filter((record) => {
        const assignedStaff = record.fields[EVENTS_FIELD_IDS.assigned_staff] as string[] | undefined;
        return assignedStaff && assignedStaff.includes(staffId);
      })
      .map((record) => ({
        eventId: record.fields[EVENTS_FIELD_IDS.event_id] as string,
        date: record.fields[EVENTS_FIELD_IDS.event_date] as string,
        schoolName: record.fields[EVENTS_FIELD_IDS.school_name] as string || 'Unknown School',
      }));

    return NextResponse.json({
      success: true,
      bookings,
    });
  } catch (error) {
    console.error('Error fetching staff bookings:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch staff bookings',
      },
      { status: 500 }
    );
  }
}
