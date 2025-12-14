/**
 * Sync Script: Re-populate SchoolBookings with SimplyBook intake form data
 *
 * This script:
 * 1. Fetches all SchoolBookings from Airtable that have a simplybook_id
 * 2. For each booking, fetches full details from SimplyBook API
 * 3. Re-maps the intake fields using the updated mapIntakeFields()
 * 4. Updates the Airtable record with the extracted data
 *
 * Usage:
 *   npx tsx scripts/sync-simplybook-bookings.ts
 *
 * Options:
 *   --dry-run  : Show what would be updated without making changes
 *   --verbose  : Show detailed progress information
 */

// Load environment variables FIRST
require('dotenv').config({ path: '.env.local' });

import Airtable from 'airtable';
import {
  SCHOOL_BOOKINGS_TABLE_ID,
  SCHOOL_BOOKINGS_FIELD_IDS,
} from '../src/lib/types/airtable';

interface SyncStats {
  totalBookings: number;
  bookingsWithSimplybookId: number;
  bookingsSynced: number;
  bookingsSkipped: number;
  errors: number;
}

interface BookingUpdate {
  recordId: string;
  simplybookId: string;
  oldData: {
    address?: string;
    postalCode?: string;
    region?: string;
    city?: string;
    estimatedChildren?: number;
    contactPerson?: string;
  };
  newData: {
    address?: string;
    postalCode?: string;
    region?: string;
    city?: string;
    estimatedChildren?: number;
    contactPerson?: string;
  };
}

async function syncSimplybookBookings(dryRun: boolean = false, verbose: boolean = false) {
  // Dynamically import simplybookService after env is loaded
  const { simplybookService } = await import('../src/lib/services/simplybookService');

  const stats: SyncStats = {
    totalBookings: 0,
    bookingsWithSimplybookId: 0,
    bookingsSynced: 0,
    bookingsSkipped: 0,
    errors: 0,
  };

  console.log('\n=== SimplyBook Bookings Sync ===\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE UPDATE'}`);
  console.log(`Verbose: ${verbose ? 'ON' : 'OFF'}\n`);

  // Initialize Airtable
  const airtableApiKey = process.env.AIRTABLE_API_KEY;
  const airtableBaseId = process.env.AIRTABLE_BASE_ID;

  if (!airtableApiKey || !airtableBaseId) {
    console.error('Error: AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set in .env.local');
    process.exit(1);
  }

  const airtable = new Airtable({ apiKey: airtableApiKey }).base(airtableBaseId);

  try {
    // Step 1: Fetch all SchoolBookings from Airtable
    console.log('Step 1: Fetching all SchoolBookings from Airtable...');

    const allRecords: Airtable.Record<Airtable.FieldSet>[] = [];
    await airtable
      .table(SCHOOL_BOOKINGS_TABLE_ID)
      .select({
        pageSize: 100,
        returnFieldsByFieldId: true,
      })
      .eachPage((records, fetchNextPage) => {
        allRecords.push(...records);
        fetchNextPage();
      });

    stats.totalBookings = allRecords.length;
    console.log(`✓ Found ${stats.totalBookings} total bookings\n`);

    // Step 2: Filter to bookings with simplybook_id
    console.log('Step 2: Filtering bookings with SimplyBook IDs...');
    const bookingsWithSimplybookId = allRecords.filter(
      (record) => record.fields[SCHOOL_BOOKINGS_FIELD_IDS.simplybook_id]
    );

    stats.bookingsWithSimplybookId = bookingsWithSimplybookId.length;
    console.log(`✓ Found ${stats.bookingsWithSimplybookId} bookings with SimplyBook IDs\n`);

    if (stats.bookingsWithSimplybookId === 0) {
      console.log('No bookings to sync.');
      return stats;
    }

    // Step 3: Process each booking
    console.log('Step 3: Syncing booking data from SimplyBook...\n');

    const updates: BookingUpdate[] = [];

    for (let i = 0; i < bookingsWithSimplybookId.length; i++) {
      const record = bookingsWithSimplybookId[i];
      const simplybookId = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.simplybook_id] as string;
      const recordId = record.id;

      console.log(`[${i + 1}/${stats.bookingsWithSimplybookId}] Processing booking ${simplybookId}...`);

      try {
        // Fetch booking details from SimplyBook
        const booking = await simplybookService.getBookingDetails(simplybookId);

        if (verbose) {
          console.log(`  SimplyBook additional_fields: ${JSON.stringify(booking.additional_fields || 'none')}`);
        }

        // Map intake fields using updated mapIntakeFields
        const mappedData = simplybookService.mapIntakeFields(booking);

        // Current data in Airtable
        const oldData = {
          address: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_address] as string | undefined,
          postalCode: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_postal_code] as string | undefined,
          region: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.region] as string | undefined,
          city: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.city] as string | undefined,
          estimatedChildren: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.estimated_children] as number | undefined,
          contactPerson: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_contact_name] as string | undefined,
        };

        // New data from SimplyBook
        const newData = {
          address: mappedData.address,
          postalCode: mappedData.postalCode,
          region: mappedData.region,
          city: mappedData.city,
          estimatedChildren: mappedData.numberOfChildren,
          contactPerson: mappedData.contactPerson,
        };

        // Check if there's anything new to update
        const hasChanges =
          (newData.address && newData.address !== oldData.address) ||
          (newData.postalCode && newData.postalCode !== oldData.postalCode) ||
          (newData.region && newData.region !== oldData.region) ||
          (newData.city && newData.city !== oldData.city) ||
          (newData.estimatedChildren && newData.estimatedChildren !== oldData.estimatedChildren) ||
          (newData.contactPerson && newData.contactPerson !== oldData.contactPerson);

        if (hasChanges) {
          updates.push({ recordId, simplybookId, oldData, newData });

          if (verbose) {
            console.log(`  Old: ${JSON.stringify(oldData)}`);
            console.log(`  New: ${JSON.stringify(newData)}`);
          }

          if (!dryRun) {
            // Build update object with only non-empty values
            const updateFields: Airtable.FieldSet = {};
            if (newData.address) updateFields[SCHOOL_BOOKINGS_FIELD_IDS.school_address] = newData.address;
            if (newData.postalCode) updateFields[SCHOOL_BOOKINGS_FIELD_IDS.school_postal_code] = newData.postalCode;
            if (newData.region) updateFields[SCHOOL_BOOKINGS_FIELD_IDS.region] = newData.region;
            if (newData.city) updateFields[SCHOOL_BOOKINGS_FIELD_IDS.city] = newData.city;
            // Also copy region value to city if city is empty (since both come from 'Ort')
            if (!newData.city && newData.region) updateFields[SCHOOL_BOOKINGS_FIELD_IDS.city] = newData.region;
            if (newData.estimatedChildren) updateFields[SCHOOL_BOOKINGS_FIELD_IDS.estimated_children] = newData.estimatedChildren;
            if (newData.contactPerson) updateFields[SCHOOL_BOOKINGS_FIELD_IDS.school_contact_name] = newData.contactPerson;

            await airtable.table(SCHOOL_BOOKINGS_TABLE_ID).update(recordId, updateFields);
            console.log(`  ✓ Updated`);
          } else {
            console.log(`  ✓ Would update (dry run)`);
          }

          stats.bookingsSynced++;
        } else {
          if (verbose) {
            console.log(`  - No changes needed`);
          }
          stats.bookingsSkipped++;
        }

        // Add a small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200));

      } catch (error) {
        const errorMessage = error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null
            ? JSON.stringify(error)
            : String(error);
        console.error(`  ✗ Error: ${errorMessage}`);
        stats.errors++;
      }
    }

    // Summary
    console.log('\n=== Sync Summary ===\n');
    console.log(`Total bookings in Airtable: ${stats.totalBookings}`);
    console.log(`Bookings with SimplyBook ID: ${stats.bookingsWithSimplybookId}`);
    console.log(`Bookings ${dryRun ? 'that would be' : ''} synced: ${stats.bookingsSynced}`);
    console.log(`Bookings skipped (no changes): ${stats.bookingsSkipped}`);
    if (stats.errors > 0) {
      console.log(`Errors encountered: ${stats.errors}`);
    }
    console.log('\n✓ Sync complete!\n');

    return stats;
  } catch (error) {
    console.error('\n✗ Sync failed:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose');

// Run sync
syncSimplybookBookings(dryRun, verbose)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
