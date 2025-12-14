# MiniMusiker Scripts

This directory contains utility scripts for database migrations, data management, and administrative tasks.

## Migration Scripts

### Class ID Migration

**File:** `migrate-class-ids.ts`

Generates `class_id` values for existing Airtable records that don't have them.

#### What it does:

1. Fetches all records from the `parent_journey_table`
2. Groups records by `school_name` + `booking_date` + `class`
3. Generates a unique `class_id` for each group using the format:
   `cls_{school_slug}_{date}_{class_slug}_{hash}`
4. Updates all records in each group with the generated `class_id`

#### Usage:

```bash
# Dry run (see what would change without making updates)
npx ts-node scripts/migrate-class-ids.ts --dry-run

# Dry run with verbose output
npx ts-node scripts/migrate-class-ids.ts --dry-run --verbose

# Live update (actually make the changes)
npx ts-node scripts/migrate-class-ids.ts

# Live update with verbose output
npx ts-node scripts/migrate-class-ids.ts --verbose
```

#### Options:

- `--dry-run` : Preview changes without updating Airtable
- `--verbose` : Show detailed progress information for each group

#### Example Output:

```
=== MiniMusiker Class ID Migration ===

Mode: DRY RUN (no changes will be made)
Verbose: ON

Step 1: Fetching all records from Airtable...
✓ Found 250 total records

Step 2: Analyzing existing class_id data...
  - Records with class_id: 50
  - Records without class_id: 200

Step 3: Grouping records by school + date + class...
  + Created group: Calder High School / Year 3 / 2025-11-20
    Class ID: cls_calder_high_school_20251120_year3_a1b2c3
✓ Identified 15 unique classes

Step 4: Simulating updates...
  [1/15] Calder High School / Year 3 / 2025-11-20
    Class ID: cls_calder_high_school_20251120_year3_a1b2c3
    Records to update: 25
    ✓ Would update (dry run)
  ...

=== Migration Summary ===

Total records processed: 250
Records already with class_id: 50
Records needing class_id: 200
Unique classes identified: 15
Records that would be updated: 200

✓ Migration complete!
```

#### Important Notes:

- **Always run with `--dry-run` first** to verify the changes before applying them
- The script skips records that already have a `class_id`
- Records missing `school_name`, `booking_date`, or `class` will be skipped
- The script uses Airtable's batch update (max 10 records per batch)
- Generated `class_id` values are deterministic (same inputs = same output)

#### Prerequisites:

- Airtable credentials configured in `.env.local`
- Fields must exist in Airtable: `class_id`, `school_name`, `booking_date`, `class`
- TypeScript and ts-node installed

#### Troubleshooting:

**Error: "class_id field not found"**
- Update the field ID in `src/lib/types/airtable.ts` (AIRTABLE_FIELD_IDS.class_id)

**Error: "Failed to fetch records"**
- Check Airtable API credentials in `.env.local`
- Verify table name is correct ('parent_journey_table')

**Records skipped with missing data:**
- Some records may not have all required fields (school_name, booking_date, class)
- Use `--verbose` to see which records are skipped and why

## Adding New Scripts

When creating new migration or utility scripts:

1. Create a new `.ts` file in this directory
2. Add comprehensive comments explaining what it does
3. Include usage examples
4. Add error handling and logging
5. Support `--dry-run` mode when making data changes
6. Update this README with documentation
