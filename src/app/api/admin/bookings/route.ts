import { NextRequest, NextResponse } from 'next/server';
import Airtable from 'airtable';
import { getAirtableService } from '@/lib/services/airtableService';
import { SchoolBooking, SecondaryContact, TEAMS_REGIONEN_TABLE_ID } from '@/lib/types/airtable';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { generateEventId } from '@/lib/utils/eventIdentifiers';

export const dynamic = 'force-dynamic';

// Extended booking data for display
export interface BookingWithDetails {
  id: string;
  code: string;
  schoolName: string;
  contactPerson: string;
  contactEmail: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  region?: string;               // Region name for display
  regionId?: string;             // Region record ID for dropdown selection
  city?: string;                 // City field
  numberOfChildren: number;
  costCategory: '>150 children' | '<150 children';
  bookingDate: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'hold' | 'no_region' | 'deleted';
  startTime?: string;
  endTime?: string;
  eventName?: string;
  accessCode?: number;           // From linked Event
  shortUrl?: string;             // Computed: "minimusiker.app/e/{accessCode}"
  // Event status and type fields for admin booking view
  eventStatus?: 'Confirmed' | 'On Hold' | 'Cancelled' | 'Deleted';  // Status traffic light
  isPlus?: boolean;              // Shows '+' instead of 'M'
  isKita?: boolean;              // Shows 'K' circle (or derived from event_type)
  isSchulsong?: boolean;         // Shows 'S' circle
  isMinimusikertag?: boolean;    // true = full event, false = schulsong-only
  eventType?: string;            // Original event_type for backwards compatibility
  // Staff assignment from linked Event
  assignedStaff?: string[];      // Array of Personen record IDs
  assignedStaffNames?: string[]; // Resolved staff names for display
  // Edit booking modal fields
  secondaryContacts?: SecondaryContact[];  // Additional contacts stored as JSON
  simplybookClientId?: string;   // SimplyBook client ID for editClient sync
}

// Staff member for dropdown
export interface StaffOption {
  id: string;
  name: string;
}

// Region for dropdown
export interface RegionOption {
  id: string;
  name: string;
}

/**
 * Transform SchoolBooking (Airtable) to BookingWithDetails (API response)
 */
function transformToBookingWithDetails(
  booking: SchoolBooking,
  regionMap: Map<string, string>
): BookingWithDetails {
  const regionId = Array.isArray(booking.region) ? booking.region[0] : booking.region;
  return {
    id: booking.id,
    code: booking.simplybookId,
    schoolName: booking.schoolName || booking.schoolContactName || 'Unknown School',
    contactPerson: booking.schoolContactName || '',
    contactEmail: booking.schoolContactEmail || '',
    phone: booking.schoolPhone,
    address: booking.schoolAddress,
    postalCode: booking.schoolPostalCode,
    region: regionId ? (regionMap.get(regionId) || regionId) : undefined,
    regionId: regionId || undefined,  // Raw record ID for edit modal dropdown
    city: booking.city,
    numberOfChildren: booking.estimatedChildren || 0,
    costCategory: booking.schoolSizeCategory || '<150 children',
    bookingDate: booking.startDate || '',
    status: booking.simplybookStatus,
    startTime: booking.startTime,
    endTime: booking.endTime,
    eventName: 'MiniMusiker Day',
    // Parse secondaryContacts from JSON field
    secondaryContacts: booking.secondaryContacts ? parseSecondaryContacts(booking.secondaryContacts) : undefined,
  };
}

/**
 * Safely parse secondary contacts JSON
 */
function parseSecondaryContacts(json: string): SecondaryContact[] | undefined {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return undefined;
  } catch {
    console.warn('Failed to parse secondary contacts JSON:', json);
    return undefined;
  }
}

/**
 * Fetch region names for a list of region IDs
 * Uses batch lookup to minimize API calls
 */
async function fetchRegionNames(regionIds: string[]): Promise<Map<string, string>> {
  const regionMap = new Map<string, string>();
  const uniqueIds = [...new Set(regionIds.filter(Boolean))];

  if (uniqueIds.length === 0) return regionMap;

  // Fetch all regions in a single batch using OR formula
  const filterFormula = `OR(${uniqueIds.map(id => `RECORD_ID()='${id}'`).join(',')})`;

  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);
  const records = await base(TEAMS_REGIONEN_TABLE_ID)
    .select({ filterByFormula: filterFormula })
    .all();

  // Note: .select() returns field names, not IDs
  for (const record of records) {
    const name = record.fields['Name'] as string | undefined;
    if (name) {
      regionMap.set(record.id, name);
    }
  }

  return regionMap;
}

/**
 * GET /api/admin/bookings
 * Fetch all bookings (past and future) from Airtable
 * Includes staff and region lists for dropdowns
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

    const airtableService = getAirtableService();

    // Fetch all bookings (past and future), staff list, and region list in parallel
    const [airtableBookings, staffList, regionList] = await Promise.all([
      airtableService.getAllBookings(),
      airtableService.getAllStaffMembers(),
      airtableService.getAllRegions(),
    ]);

    // Extract all region IDs and fetch names
    const allRegionIds = airtableBookings
      .map(b => Array.isArray(b.region) ? b.region[0] : b.region)
      .filter((id): id is string => Boolean(id));
    const regionMap = await fetchRegionNames(allRegionIds);

    // Build staff ID to name map for resolving assigned staff names
    const staffMap = new Map(staffList.map(s => [s.id, s.name]));

    // Transform to API format and fetch/create Events with access codes and status fields
    const bookingsWithAccessCodes: BookingWithDetails[] = await Promise.all(
      airtableBookings.map(async (booking) => {
        const baseBooking = transformToBookingWithDetails(booking, regionMap);

        // Fetch the linked Event to get access_code and status fields
        try {
          let event = await airtableService.getEventBySchoolBookingId(booking.id);

          // If no Event exists, create one
          if (!event) {
            const schoolName = booking.schoolName || booking.schoolContactName || 'Unknown School';
            const eventDate = booking.startDate || new Date().toISOString().split('T')[0];
            const eventId = generateEventId(schoolName, 'MiniMusiker', eventDate);

            console.log(`Creating Event for booking ${booking.id} (${schoolName})`);
            event = await airtableService.createEventFromBooking(
              eventId,
              booking.id,
              schoolName,
              eventDate
            );
          }

          if (event) {
            // Determine if this is a Kita event based on event_type or is_kita flag
            const isKitaFromEventType = event.event_type === 'Minimusikertag Kita';

            return {
              ...baseBooking,
              accessCode: event.access_code,
              shortUrl: event.access_code ? `minimusiker.app/e/${event.access_code}` : undefined,
              // Event status and type fields
              eventStatus: event.status,
              isPlus: event.is_plus,
              isKita: event.is_kita || isKitaFromEventType, // Support legacy event_type
              isSchulsong: event.is_schulsong,
              isMinimusikertag: event.is_minimusikertag === true,
              eventType: event.event_type,
              // Staff assignment
              assignedStaff: event.assigned_staff,
              assignedStaffNames: event.assigned_staff?.map(id => staffMap.get(id)).filter(Boolean) as string[],
            };
          }
        } catch (error) {
          console.warn(`Failed to fetch/create Event for booking ${booking.id}:`, error);
        }

        return baseBooking;
      })
    );

    // Filter out deleted events (soft-deleted via Event status)
    const visibleBookings = bookingsWithAccessCodes.filter(
      (booking) => booking.eventStatus !== 'Deleted'
    );

    // Calculate stats from visible bookings only
    const stats = {
      total: visibleBookings.length,
      confirmed: visibleBookings.filter((b) => b.status === 'confirmed').length,
      pending: visibleBookings.filter((b) => b.status === 'pending').length,
      cancelled: visibleBookings.filter((b) => b.status === 'cancelled').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        bookings: visibleBookings,
        stats,
        staffList,
        regionList,
      },
    });
  } catch (error) {
    console.error('Error fetching bookings from Airtable:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch bookings',
      },
      { status: 500 }
    );
  }
}
