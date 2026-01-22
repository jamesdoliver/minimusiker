import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { simplybookService } from '@/lib/services/simplybookService';
import { SCHOOL_BOOKINGS_FIELD_IDS } from '@/lib/types/airtable';
import { updateSchoolBookingById } from '@/lib/services/teacherService';

export const dynamic = 'force-dynamic';

// Response types
interface FieldUpdate {
  field: string;
  label: string;
  current: string;
  new: string;
}

interface MissingField {
  field: string;
  label: string;
}

interface RefreshPreviewResponse {
  success: true;
  updates: FieldUpdate[];
  stillMissing: MissingField[];
  hasUpdates: boolean;
}

interface RefreshApplyResponse {
  success: true;
  updatedCount: number;
  message: string;
}

interface RefreshErrorResponse {
  success: false;
  error: string;
}

// Field configuration for comparison
const FIELD_CONFIG = [
  { airtable: 'school_name', mapped: 'schoolName', label: 'School Name', fieldId: SCHOOL_BOOKINGS_FIELD_IDS.school_name },
  { airtable: 'school_contact_name', mapped: 'contactPerson', label: 'Contact Person', fieldId: SCHOOL_BOOKINGS_FIELD_IDS.school_contact_name },
  { airtable: 'school_contact_email', mapped: 'contactEmail', label: 'Contact Email', fieldId: SCHOOL_BOOKINGS_FIELD_IDS.school_contact_email },
  { airtable: 'school_phone', mapped: 'phone', label: 'Phone', fieldId: SCHOOL_BOOKINGS_FIELD_IDS.school_phone },
  { airtable: 'school_address', mapped: 'address', label: 'Address', fieldId: SCHOOL_BOOKINGS_FIELD_IDS.school_address },
  { airtable: 'school_postal_code', mapped: 'postalCode', label: 'Postal Code', fieldId: SCHOOL_BOOKINGS_FIELD_IDS.school_postal_code },
  { airtable: 'city', mapped: 'city', label: 'City', fieldId: SCHOOL_BOOKINGS_FIELD_IDS.city },
  { airtable: 'estimated_children', mapped: 'numberOfChildren', label: 'Estimated Children', fieldId: SCHOOL_BOOKINGS_FIELD_IDS.estimated_children },
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<RefreshPreviewResponse | RefreshApplyResponse | RefreshErrorResponse>> {
  try {
    // Verify admin authentication
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: bookingId } = await params;
    const { searchParams } = new URL(request.url);
    const preview = searchParams.get('preview') !== 'false'; // Default to preview mode

    // Get booking from Airtable
    const airtableService = getAirtableService();
    const booking = await airtableService.getSchoolBookingById(bookingId);

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    if (!booking.simplybookId) {
      return NextResponse.json({ success: false, error: 'Booking has no SimplyBook ID' }, { status: 400 });
    }

    // Fetch fresh data from SimplyBook
    const simplybookData = await simplybookService.getBookingDetails(booking.simplybookId);
    const mappedData = simplybookService.mapIntakeFields(simplybookData);

    // Compare fields
    const updates: FieldUpdate[] = [];
    const stillMissing: MissingField[] = [];

    const currentValues: Record<string, string | number | undefined> = {
      schoolName: booking.schoolName,
      contactPerson: booking.schoolContactName,
      contactEmail: booking.schoolContactEmail,
      phone: booking.schoolPhone,
      address: booking.schoolAddress,
      postalCode: booking.schoolPostalCode,
      city: booking.city,
      numberOfChildren: booking.estimatedChildren,
    };

    for (const config of FIELD_CONFIG) {
      const currentValue = currentValues[config.mapped];
      const newValue = mappedData[config.mapped as keyof typeof mappedData];
      const isEmpty = !currentValue || currentValue === '' || currentValue === 0;
      const hasNewValue = newValue !== undefined && newValue !== '' && newValue !== 0;

      if (isEmpty && hasNewValue) {
        updates.push({
          field: config.airtable,
          label: config.label,
          current: String(currentValue || ''),
          new: String(newValue),
        });
      } else if (isEmpty && !hasNewValue) {
        stillMissing.push({
          field: config.airtable,
          label: config.label,
        });
      }
    }

    // Preview mode - return comparison
    if (preview) {
      return NextResponse.json({
        success: true,
        updates,
        stillMissing,
        hasUpdates: updates.length > 0,
      });
    }

    // Apply mode - update Airtable
    if (updates.length === 0) {
      return NextResponse.json({
        success: true,
        updatedCount: 0,
        message: 'No updates needed',
      });
    }

    // Build update object using field IDs
    const updateFields: Record<string, string | number> = {};
    for (const update of updates) {
      const config = FIELD_CONFIG.find(c => c.airtable === update.field);
      if (config) {
        updateFields[config.fieldId] = update.field === 'estimated_children'
          ? parseInt(update.new, 10)
          : update.new;
      }
    }

    // Update Airtable record
    await updateSchoolBookingById(bookingId, updateFields);

    return NextResponse.json({
      success: true,
      updatedCount: updates.length,
      message: `${updates.length} field${updates.length === 1 ? '' : 's'} updated from SimplyBook`,
    });
  } catch (error) {
    console.error('Error refreshing booking data:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to refresh booking' },
      { status: 500 }
    );
  }
}
