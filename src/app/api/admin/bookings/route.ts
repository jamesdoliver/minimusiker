import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import Airtable from 'airtable';
import { getAirtableService } from '@/lib/services/airtableService';
import { SchoolBooking, SecondaryContact, TEAMS_REGIONEN_TABLE_ID, SCHOOL_BOOKINGS_TABLE_ID, SCHOOL_BOOKINGS_FIELD_IDS } from '@/lib/types/airtable';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { generateEventId } from '@/lib/utils/eventIdentifiers';
import { getR2Service } from '@/lib/services/r2Service';
import { getTeacherService } from '@/lib/services/teacherService';

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
  eventStatus?: 'Confirmed' | 'On Hold' | 'Cancelled' | 'Deleted' | 'Pending';  // Status traffic light
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
  // Registration tracking
  registrationCount?: number;    // Count of registrations for linked event
  eventRecordId?: string;        // Event record ID for registration lookup
  // Audio pipeline
  audioPipelineStage?: 'not_started' | 'in_progress' | 'ready_for_review' | 'approved';
  // Admin notes
  adminNotes?: string;
  // Discount code (simplybookHash)
  discountCode?: string;
  // Class and song counts
  classCount?: number;
  songCount?: number;
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
    discountCode: booking.simplybookHash,
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
              // Event record ID for registration lookup
              eventRecordId: event.id,
              // Audio pipeline
              audioPipelineStage: event.audio_pipeline_stage,
              // Admin notes
              adminNotes: event.admin_notes,
            };
          }
        } catch (error) {
          console.warn(`Failed to fetch/create Event for booking ${booking.id}:`, error);
        }

        return baseBooking;
      })
    );

    // Collect event record IDs for registration count lookup
    const eventRecordIds = bookingsWithAccessCodes
      .map(b => b.eventRecordId)
      .filter((id): id is string => !!id);

    // Fetch registration, class, and song counts in parallel batch queries
    const [registrationCounts, classCounts, songCounts] = await Promise.all([
      airtableService.getRegistrationCountsByEventIds(eventRecordIds),
      airtableService.getClassCountsByEventIds(eventRecordIds),
      airtableService.getSongCountsByEventIds(eventRecordIds),
    ]);

    // Merge counts into bookings
    const bookingsWithRegistrations = bookingsWithAccessCodes.map(booking => ({
      ...booking,
      registrationCount: booking.eventRecordId ? registrationCounts.get(booking.eventRecordId) || 0 : 0,
      classCount: booking.eventRecordId ? classCounts.get(booking.eventRecordId) || 0 : 0,
      songCount: booking.eventRecordId ? songCounts.get(booking.eventRecordId) || 0 : 0,
    }));

    // Filter out deleted events (soft-deleted via Event status)
    const visibleBookings = bookingsWithRegistrations.filter(
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

/**
 * Generate a manual booking code (e.g., "M-a3f9b2")
 */
function generateManualBookingCode(): string {
  return `M-${crypto.randomBytes(3).toString('hex')}`;
}

/**
 * Generate a manual discount code (e.g., "meh1a3f9b")
 */
function generateManualDiscountCode(): string {
  return `meh1${crypto.randomBytes(4).toString('hex').slice(0, 5)}`;
}

/**
 * POST /api/admin/bookings
 * Create a manual booking from the admin portal
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate required fields
    const { schoolName, contactName, contactEmail } = body;
    if (!schoolName?.trim() || !contactName?.trim() || !contactEmail?.trim()) {
      return NextResponse.json(
        { success: false, error: 'School name, contact name, and contact email are required' },
        { status: 400 }
      );
    }

    // Generate unique codes for manual bookings
    const bookingCode = generateManualBookingCode();
    const discountCode = generateManualDiscountCode();

    // Determine if this is a pending booking (no date provided)
    const isPending = !body.eventDate;
    const eventDate = body.eventDate || '';

    // Determine cost category based on estimated children
    const estimatedChildren = body.estimatedChildren || 0;
    const costCategory = estimatedChildren > 150 ? '>150 children' : '<150 children';

    // Initialize Airtable
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);

    // Build Airtable fields
    const fields: Record<string, any> = {
      [SCHOOL_BOOKINGS_FIELD_IDS.simplybook_id]: bookingCode,
      [SCHOOL_BOOKINGS_FIELD_IDS.simplybook_hash]: discountCode,
      [SCHOOL_BOOKINGS_FIELD_IDS.school_name]: schoolName.trim(),
      [SCHOOL_BOOKINGS_FIELD_IDS.school_contact_name]: contactName.trim(),
      [SCHOOL_BOOKINGS_FIELD_IDS.school_contact_email]: contactEmail.trim(),
      [SCHOOL_BOOKINGS_FIELD_IDS.school_phone]: body.phone || '',
      [SCHOOL_BOOKINGS_FIELD_IDS.school_address]: body.address || '',
      [SCHOOL_BOOKINGS_FIELD_IDS.school_postal_code]: body.postalCode || '',
      [SCHOOL_BOOKINGS_FIELD_IDS.city]: body.city || '',
      [SCHOOL_BOOKINGS_FIELD_IDS.estimated_children]: estimatedChildren,
      [SCHOOL_BOOKINGS_FIELD_IDS.school_size_category]: costCategory,
      [SCHOOL_BOOKINGS_FIELD_IDS.simplybook_status]: isPending ? 'pending' : 'confirmed',
    };

    // Only set date fields if a date is provided
    if (eventDate) {
      fields[SCHOOL_BOOKINGS_FIELD_IDS.start_date] = eventDate;
      fields[SCHOOL_BOOKINGS_FIELD_IDS.end_date] = eventDate;
    }
    if (body.startTime) {
      fields[SCHOOL_BOOKINGS_FIELD_IDS.start_time] = body.startTime;
    }
    if (body.endTime) {
      fields[SCHOOL_BOOKINGS_FIELD_IDS.end_time] = body.endTime;
    }

    // Link region if provided
    if (body.regionId) {
      fields[SCHOOL_BOOKINGS_FIELD_IDS.region] = [body.regionId];
    }

    // Create SchoolBooking record in Airtable
    const record = await base.table(SCHOOL_BOOKINGS_TABLE_ID).create(fields);
    console.log(`Created manual SchoolBooking record: ${record.id} (code: ${bookingCode})`);

    // Post-creation chain: Event, R2 structure, default class
    try {
      const airtableService = getAirtableService();
      const r2Service = getR2Service();

      // Generate event_id — pass date as undefined if pending
      const eventId = generateEventId(
        schoolName,
        'MiniMusiker',
        eventDate || undefined
      );
      console.log('Generated event_id for manual booking:', eventId);

      // Create Events record linked to SchoolBookings
      const eventRecord = await airtableService.createEventFromBooking(
        eventId,
        record.id,
        schoolName,
        eventDate || new Date().toISOString().split('T')[0],
        undefined, // no staff auto-assignment for manual bookings
        'MiniMusiker',
        body.address || undefined,
        body.phone || undefined,
        isPending ? 'Pending' : undefined,
        estimatedChildren || undefined // estimatedChildren → auto-sets is_under_100
      );
      console.log('Created Event record for manual booking:', eventRecord.id);

      // Initialize R2 event folder structure
      const initResult = await r2Service.initializeEventStructure(eventId);
      if (initResult.success) {
        console.log('Initialized R2 event structure for manual booking:', eventId);
      } else {
        console.warn('Failed to initialize R2 structure for manual booking:', initResult.error);
      }

      // Create default "Alle Kinder" class
      if (eventRecord) {
        try {
          const teacherService = getTeacherService();
          const defaultClass = await teacherService.createDefaultClass({
            eventId,
            eventRecordId: eventRecord.id,
            schoolName,
            bookingDate: eventDate || new Date().toISOString().split('T')[0],
            estimatedChildren,
          });

          if (defaultClass) {
            console.log(`Created default "Alle Kinder" class for manual booking: ${defaultClass.classId}`);
          }
        } catch (defaultClassError) {
          console.error('Error creating default class for manual booking:', defaultClassError);
        }
      }
    } catch (chainError) {
      // Don't fail the entire request — booking was created successfully
      console.error('Error in post-creation chain for manual booking:', chainError);
    }

    return NextResponse.json({
      success: true,
      bookingId: record.id,
      bookingCode,
      discountCode,
    });
  } catch (error) {
    console.error('Error creating manual booking:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create booking',
      },
      { status: 500 }
    );
  }
}
