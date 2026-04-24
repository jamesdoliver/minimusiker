import Airtable from 'airtable';
import { simplybookService } from '@/lib/services/simplybookService';
import { getTeacherService } from '@/lib/services/teacherService';
import {
  SCHOOL_BOOKINGS_TABLE_ID,
  SCHOOL_BOOKINGS_FIELD_IDS,
} from '@/lib/types/airtable';

export interface BookingSyncDetail {
  bookingId: string;
  status: 'created' | 'skipped' | 'error';
  error?: string;
  teacherStatus?: string;
}

export interface BookingSyncResults {
  total: number;
  created: number;
  skipped: number;
  errors: number;
  teachersCreated: number;
  teacherErrors: number;
  details: BookingSyncDetail[];
}

const parseDateTime = (dateTimeStr: string | undefined): { date: string; time: string } => {
  if (!dateTimeStr) return { date: '', time: '' };
  const parts = dateTimeStr.split(' ');
  return { date: parts[0] || '', time: parts[1] || '' };
};

let airtableBase: ReturnType<Airtable['base']> | null = null;
function getAirtableBase() {
  if (!airtableBase) {
    airtableBase = new Airtable({
      apiKey: process.env.AIRTABLE_API_KEY || '',
    }).base(process.env.AIRTABLE_BASE_ID || '');
  }
  return airtableBase;
}

/**
 * Sync future bookings from SimplyBook into Airtable.
 *
 * Idempotent — skips bookings whose simplybook_id already exists. For each new
 * SchoolBooking, also creates a Teachers row (mirrors the live SimplyBook webhook).
 * Shared by the admin manual-sync route and the daily cron at /api/cron/booking-sync.
 */
export async function syncBookingsFromSimplybook(dateFrom: string): Promise<BookingSyncResults> {
  const airtable = getAirtableBase();
  const teacherService = getTeacherService();

  const rawBookings = await simplybookService.getBookings({ dateFrom });
  console.log(`[bookingSync] Fetched ${rawBookings.length} future bookings from ${dateFrom}`);

  const results: BookingSyncResults = {
    total: rawBookings.length,
    created: 0,
    skipped: 0,
    errors: 0,
    teachersCreated: 0,
    teacherErrors: 0,
    details: [],
  };

  for (const rawBooking of rawBookings) {
    const bookingIdStr = String(rawBooking.id);
    try {
      const existing = await airtable
        .table(SCHOOL_BOOKINGS_TABLE_ID)
        .select({
          filterByFormula: `{${SCHOOL_BOOKINGS_FIELD_IDS.simplybook_id}} = "${rawBooking.id}"`,
          maxRecords: 1,
        })
        .firstPage();

      if (existing.length > 0) {
        results.skipped++;
        results.details.push({ bookingId: bookingIdStr, status: 'skipped' });
        continue;
      }

      const booking = rawBooking;
      const mappedData = simplybookService.mapIntakeFields(booking);

      const regionRecordId = await simplybookService.findTeamsRegionenByName(mappedData.region);

      // Match webhook (webhook/route.ts:87-93): provider ID first, region as fallback.
      let staffId = await simplybookService.findStaffByProviderId(booking.unit_id);
      if (!staffId) {
        staffId = await simplybookService.findStaffByRegion(mappedData.region);
      }

      const einrichtungId = await simplybookService.findEinrichtungByName(
        mappedData.schoolName,
        mappedData.postalCode
      );

      const startParsed = parseDateTime(booking.start_date);
      const endParsed = parseDateTime(booking.end_date);
      const isConfirmed = booking.is_confirmed === true;

      await airtable.table(SCHOOL_BOOKINGS_TABLE_ID).create({
        [SCHOOL_BOOKINGS_FIELD_IDS.simplybook_id]: booking.id,
        [SCHOOL_BOOKINGS_FIELD_IDS.simplybook_hash]: booking.hash || booking.code || '',
        [SCHOOL_BOOKINGS_FIELD_IDS.school_name]: mappedData.schoolName || booking.client_name || '',
        [SCHOOL_BOOKINGS_FIELD_IDS.school_contact_name]: mappedData.contactPerson || booking.client_name || '',
        [SCHOOL_BOOKINGS_FIELD_IDS.school_contact_email]: mappedData.contactEmail || booking.client_email || '',
        [SCHOOL_BOOKINGS_FIELD_IDS.school_phone]: mappedData.phone || booking.client_phone || '',
        [SCHOOL_BOOKINGS_FIELD_IDS.school_address]: mappedData.address || '',
        [SCHOOL_BOOKINGS_FIELD_IDS.school_postal_code]: mappedData.postalCode || '',
        [SCHOOL_BOOKINGS_FIELD_IDS.region]: regionRecordId ? [regionRecordId] : [],
        [SCHOOL_BOOKINGS_FIELD_IDS.city]: mappedData.city || '',
        [SCHOOL_BOOKINGS_FIELD_IDS.estimated_children]: mappedData.numberOfChildren,
        [SCHOOL_BOOKINGS_FIELD_IDS.school_size_category]: mappedData.costCategory,
        [SCHOOL_BOOKINGS_FIELD_IDS.simplybook_status]: isConfirmed ? 'confirmed' : 'pending',
        [SCHOOL_BOOKINGS_FIELD_IDS.start_date]: startParsed.date,
        [SCHOOL_BOOKINGS_FIELD_IDS.end_date]: endParsed.date,
        [SCHOOL_BOOKINGS_FIELD_IDS.start_time]: startParsed.time,
        [SCHOOL_BOOKINGS_FIELD_IDS.end_time]: endParsed.time,
        ...(staffId && { [SCHOOL_BOOKINGS_FIELD_IDS.main_contact_person]: [staffId] }),
        ...(einrichtungId && { [SCHOOL_BOOKINGS_FIELD_IDS.einrichtung]: [einrichtungId] }),
      });

      results.created++;
      const detail: BookingSyncDetail = { bookingId: bookingIdStr, status: 'created' };

      const teacherEmail = mappedData.contactEmail || booking.client_email || '';
      if (teacherEmail) {
        try {
          await teacherService.findOrCreateTeacher({
            email: teacherEmail,
            name: mappedData.contactPerson || booking.client_name || mappedData.schoolName,
            schoolName: mappedData.schoolName,
            simplybookBookingId: bookingIdStr,
            schoolAddress: mappedData.address,
            schoolPhone: mappedData.phone,
            regionRecordId: regionRecordId || undefined,
          });
          results.teachersCreated++;
          detail.teacherStatus = 'created';
        } catch (teacherError) {
          results.teacherErrors++;
          detail.teacherStatus = `error: ${teacherError instanceof Error ? teacherError.message : 'unknown'}`;
          console.error(`[bookingSync] Teacher create failed for sb${bookingIdStr} (${teacherEmail}):`, teacherError);
        }
      } else {
        detail.teacherStatus = 'skipped — no email';
      }

      results.details.push(detail);

      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      results.errors++;
      results.details.push({
        bookingId: bookingIdStr,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      console.error(`[bookingSync] Error syncing booking ${rawBooking.id}:`, error);
    }
  }

  console.log(`[bookingSync] Complete: ${results.created} created (${results.teachersCreated} teachers), ${results.skipped} skipped, ${results.errors} errors`);
  return results;
}
