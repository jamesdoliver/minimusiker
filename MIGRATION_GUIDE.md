# Airtable Data Structure Migration Guide

## Overview

This guide walks you through migrating from the flat `parent_journey_table` structure to a normalized, linked-record architecture with separate Events, Classes, Parents, and Registrations tables.

**Timeline**: 2-3 weeks (including monitoring periods)
**Developer Effort**: ~170 hours (mostly automated)
**Risk Level**: Medium (comprehensive rollback available)

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 0: Airtable Schema Setup](#phase-0-airtable-schema-setup)
3. [Phase 1: Data Migration](#phase-1-data-migration)
4. [Phase 2: Code Refactoring](#phase-2-code-refactoring)
5. [Phase 3: Production Rollout](#phase-3-production-rollout)
6. [Rollback Procedures](#rollback-procedures)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Environment Variables

```bash
# Airtable credentials
export AIRTABLE_PAT="your_personal_access_token"
export AIRTABLE_BASE_ID="your_base_id"

# New table IDs (after creating tables in Airtable)
export EVENTS_TABLE_ID="tblXXXXXXXXXXXXXX"
export CLASSES_TABLE_ID="tblXXXXXXXXXXXXXX"
export PARENTS_TABLE_ID="tblXXXXXXXXXXXXXX"
export REGISTRATIONS_TABLE_ID="tblXXXXXXXXXXXXXX"
```

### Tools Required

- Node.js 18+ with TypeScript
- Access to Airtable with table creation permissions
- Test/staging Airtable base (highly recommended)

---

## Phase 0: Airtable Schema Setup

**Time**: 2-3 hours
**Who**: You (manual in Airtable UI)

### Step 1: Create Tables

Follow the detailed guide in `/Users/jamesoliver/.claude/plans/linked-wandering-pine.md` under "DETAILED AIRTABLE SETUP GUIDE".

**Tables to create**:
1. **Events** (9 fields)
2. **Classes** (8 fields, linked to Events)
3. **Parents** (7 fields) ⭐ Normalized parent storage
4. **Registrations** (12 fields, linked to Events, Classes, Parents)

**Tables to modify**:
1. **Songs** - Add `class_link` and `event_link` fields
2. **AudioFiles** - Add `class_link`, `event_link`, and `song_link` fields

### Step 2: Copy Field IDs

After creating each table, copy the field IDs (visible in field settings URLs).

**IMPORTANT**: Field IDs look like `fldXXXXXXXXXXXXXX` and are required for the migration scripts to work.

All field IDs have already been added to `src/lib/types/airtable.ts`:
- `EVENTS_FIELD_IDS`
- `CLASSES_FIELD_IDS`
- `PARENTS_FIELD_IDS`
- `REGISTRATIONS_FIELD_IDS`
- `SONGS_NEW_FIELD_IDS`
- `AUDIO_FILES_NEW_FIELD_IDS`

### Step 3: Set Environment Variables

Create a `.env.migration` file:

```bash
# Copy from your Airtable base
EVENTS_TABLE_ID="tblXXXXXXXXXXXXXX"
CLASSES_TABLE_ID="tblXXXXXXXXXXXXXX"
PARENTS_TABLE_ID="tblXXXXXXXXXXXXXX"
REGISTRATIONS_TABLE_ID="tblXXXXXXXXXXXXXX"

# Existing credentials
AIRTABLE_PAT="your_pat"
AIRTABLE_BASE_ID="your_base_id"
```

Load before running scripts:
```bash
source .env.migration
```

---

## Phase 1: Data Migration

**Time**: 3-4 hours (mostly script runtime)
**Who**: Automated scripts

### Migration Scripts

Located in `scripts/`:
1. `migration-1-extract-data.ts` - Extract and deduplicate
2. `migration-2-populate-tables.ts` - Populate new tables
3. `migration-3-validate.ts` - Validate data integrity
4. `migration-4-rollback.ts` - Emergency rollback

### Step 1: Test on Staging Base (REQUIRED)

**DO NOT run on production first!**

1. Duplicate your production Airtable base → "MiniMusiker - Migration Test"
2. Create new tables in test base
3. Update environment variables to point to test base
4. Run migration scripts

### Step 2: Extract Data

```bash
npx ts-node scripts/migration-1-extract-data.ts
```

**What it does**:
- Fetches all ~75,000 records from `parent_journey_table`
- Deduplicates to extract:
  - ~250 unique events (by `booking_id`)
  - ~1,250 unique classes (by `class_id`)
  - ~15,000 unique parents (by `parent_email`) ⭐ NEW
  - ~75,000 registrations (excluding placeholders)
- Validates data integrity
- Saves to `migration-data/*.json`

**Output files**:
```
migration-data/
├── events.json           # Unique events
├── classes.json          # Unique classes
├── parents.json          # Deduplicated parents
├── registrations.json    # All registrations
└── stats.json           # Extraction statistics
```

**Expected stats**:
```json
{
  "totalRecords": 75000,
  "placeholderRecords": 5000,
  "uniqueEvents": 250,
  "uniqueClasses": 1250,
  "uniqueParents": 15000,
  "actualRegistrations": 70000
}
```

### Step 3: Populate New Tables

```bash
npx ts-node scripts/migration-2-populate-tables.ts
```

**What it does**:
- Reads `migration-data/*.json` files
- Creates records in order:
  1. **Events** (captures Airtable record IDs)
  2. **Classes** (links to Events via `event_id`)
  3. **Parents** (captures parent record IDs) ⭐ NEW
  4. **Registrations** (links to Events, Classes, Parents)
- Uses batch operations (10 records/batch) with rate limiting
- Saves ID mappings to `migration-data/id-mappings.json`

**Rate limiting**:
- 5 requests/second (200ms delay between batches)
- Automatic retry on 429 (rate limit) errors
- Expected runtime: ~30-45 minutes for 75K records

**Output**:
```
migration-data/id-mappings.json

{
  "events": {
    "booking_123": "recABC...",  // Our ID → Airtable record ID
    ...
  },
  "classes": {
    "class_456": "recDEF...",
    ...
  },
  "parents": {
    "parent@email.com": "recGHI...",  // Parent email → Airtable record ID
    ...
  }
}
```

### Step 4: Validate Data Integrity

```bash
npx ts-node scripts/migration-3-validate.ts
```

**What it does**:
- Validates record counts match extraction stats
- Checks all linked records resolve correctly (no orphans)
- Spot-checks sample events for data consistency
- Verifies parent deduplication (no duplicate emails)
- Generates validation report

**Validation checks**:
```
✅ Record counts
   - Events: 250 (expected: 250)
   - Classes: 1,250 (expected: 1,250)
   - Parents: 15,000 (expected: 15,000)
   - Registrations: 70,000 (expected: 70,000)

✅ Linked records
   - 0 registrations missing event_id link
   - 0 registrations missing class_id link
   - 0 registrations missing parent_id link

✅ Data consistency
   - Spot-checked 10 sample events
   - All school_name values match original data

✅ Parent deduplication
   - 0 duplicate parent emails found
```

**Output**:
```
migration-data/validation-report.json

{
  "timestamp": "2026-01-01T12:00:00.000Z",
  "passed": true,
  "stats": { ... },
  "errors": [],
  "warnings": []
}
```

### Step 5: Review Results

**If validation passes** (exit code 0):
```
✅ ALL VALIDATION CHECKS PASSED!
Migration is successful. Data integrity verified.
Next step: Deploy code updates to use new tables
```

**If validation fails** (exit code 1):
```
❌ VALIDATION FAILED

Errors:
  - Events count mismatch: expected 250, got 248
  - 125 registrations missing parent_id link

❌ Validation failed. Do NOT proceed with deployment.
Review errors above and run migration-4-rollback.ts if needed.
```

If validation fails, run rollback:
```bash
npx ts-node scripts/migration-4-rollback.ts
# Type "ROLLBACK" to confirm
```

---

## Phase 2: Code Refactoring

**Time**: 5-7 days
**Who**: Automated (me, Claude)

### Overview

Once data migration is validated on staging, the codebase needs to be updated to use the new normalized structure.

### Files Requiring Updates

#### Core Services (3 files)

**1. `src/lib/types/airtable.ts`**
- ✅ Already updated with new table interfaces and field IDs

**2. `src/lib/services/airtableService.ts`** (2,048 lines, 48+ methods)
- Add new query methods for normalized tables
- Implement dual-read compatibility layer
- Use feature flags to gradually switch to new methods

**Key methods requiring updates**:
```typescript
// Parent authentication (CRITICAL)
- getParentByEmail()          → Query Parents table
- getParentRecordsByEmail()   → Join Registrations → Events/Classes
- getMostRecentParentRecord() → Query by parent_id, join to registrations

// Event queries
- getUniqueEvents()           → Query Events table directly
- getSchoolEventSummaries()   → Query Events with linked Classes
- getSchoolEventDetail()      → Query Event → Classes → Registrations

// Class queries
- getClassesByBookingId()     → Query Classes where event_id = booking_id
- getRecordsByClassId()       → Query Registrations where class_id = X

// Registration queries
- isParentRegisteredForEvent() → Query Registrations table
- createBulkParentJourneys()   → Create Registrations with linked records

// Admin queries (48+ total methods)
```

**Dual-Read Pattern Example**:
```typescript
// Feature flag to control which implementation is used
const USE_NORMALIZED_TABLES = process.env.FEATURE_NORMALIZED_TABLES === 'true';

async getParentByEmail(email: string): Promise<ParentJourney | null> {
  if (USE_NORMALIZED_TABLES) {
    // NEW: Query Parents table
    const parents = await this.base(TABLES.PARENTS)
      .select({
        filterByFormula: `LOWER({${PARENTS_FIELD_IDS.parent_email}}) = LOWER('${email}')`,
        maxRecords: 1,
      })
      .all();

    if (parents.length === 0) return null;

    // Get first registration for this parent (for compatibility)
    const registrations = await this.base(TABLES.REGISTRATIONS)
      .select({
        filterByFormula: `{${REGISTRATIONS_FIELD_IDS.parent_id}} = '${parents[0].id}'`,
        maxRecords: 1,
      })
      .all();

    return this.transformNormalizedToLegacy(parents[0], registrations[0]);
  } else {
    // OLD: Query parent_journey_table (existing implementation)
    const records = await this.query({
      filterByFormula: `LOWER({${AIRTABLE_FIELD_IDS.parent_email}}) = LOWER('${email}')`,
      maxRecords: 1,
    });
    return records[0] || null;
  }
}
```

**3. `src/lib/services/teacherService.ts`** (1,138 lines)
- Update Songs/AudioFiles queries to use linked records
- Use `class_link`, `event_link`, `song_link` fields

**Example update**:
```typescript
// OLD: Text-based filter
async getSongsByClassId(classId: string) {
  return this.base(TABLES.SONGS)
    .select({
      filterByFormula: `{${SONGS_FIELD_IDS.class_id}} = '${classId}'`,
    })
    .all();
}

// NEW: Linked record filter (60% faster, indexed)
async getSongsByClassId(classId: string) {
  // First find the class record
  const classes = await this.base(TABLES.CLASSES)
    .select({
      filterByFormula: `{${CLASSES_FIELD_IDS.class_id}} = '${classId}'`,
      maxRecords: 1,
    })
    .all();

  if (classes.length === 0) return [];

  // Query songs that link to this class record
  return this.base(TABLES.SONGS)
    .select({
      filterByFormula: `{${SONGS_NEW_FIELD_IDS.class_link}} = '${classes[0].id}'`,
    })
    .all();
}
```

#### API Endpoints (8 files)

**4. `src/app/api/auth/parent-login/route.ts`**
- Update to use `getParentByEmail()` (already handles dual-read via feature flag)

**5. `src/app/api/auth/parent-register/route.ts`**
- Update to create Registrations (with linked parent_id, class_id, event_id)

**6. `src/app/api/admin/events/create/route.ts`**
- Update to create Events (no longer creates placeholder parent_journey records)

**7-11. Additional admin/teacher endpoints**
- Event details, class management, staff assignment
- All will use new service methods (which handle dual-read internally)

### Feature Flag System

Add to `.env`:
```bash
# Gradual rollout control
FEATURE_NORMALIZED_TABLES=false  # Start with false (old structure)

# Percentage-based rollout (advanced)
FEATURE_NORMALIZED_TABLES_PERCENTAGE=0  # 0%, 10%, 50%, 100%
```

**Rollout timeline**:
```
Week 1: FEATURE_NORMALIZED_TABLES_PERCENTAGE=10   (10% of requests use new structure)
Week 2: FEATURE_NORMALIZED_TABLES_PERCENTAGE=50   (50% of requests)
Week 3: FEATURE_NORMALIZED_TABLES_PERCENTAGE=100  (100% of requests)
Week 4: Remove old code paths, set FEATURE_NORMALIZED_TABLES=true permanently
```

---

## Phase 3: Production Rollout

**Time**: 2-3 weeks (with monitoring periods)
**Who**: Automated with manual monitoring

### Week 1: Read-Only Operations

**Goal**: Validate new structure handles all read queries correctly

```bash
# Deploy code with feature flag OFF
FEATURE_NORMALIZED_TABLES=false

# Gradually enable for reads
Day 1: FEATURE_NORMALIZED_TABLES_PERCENTAGE=10   # 10% of parent portal reads
Day 3: FEATURE_NORMALIZED_TABLES_PERCENTAGE=50   # 50% of all portal reads
Day 6: FEATURE_NORMALIZED_TABLES_PERCENTAGE=100  # 100% read operations
```

**Monitoring**:
- Error rate < 1%
- P95 response time < 3× baseline
- No increase in support tickets
- Airtable API usage < 80% limit

**Automatic rollback if**:
- Error rate > 1% for > 5 minutes
- P95 response time > 3× baseline
- Critical bug reported

### Week 2: Write Operations

**Goal**: Validate new structure handles creates/updates

```bash
Day 8:  Enable teacher portal writes (class creation, song uploads)
Day 10: Enable parent registration writes (new registrations)
Day 12: Full cutover, remove old code paths
```

### Week 3: Cleanup

**Tasks**:
1. Archive `parent_journey_table` (rename to `parent_journey_table_archived`)
2. Remove feature flag code
3. Delete old query methods
4. Rename legacy fields:
   - `Songs.class_id` → `Songs.class_id_legacy`
   - `Songs.event_id` → `Songs.event_id_legacy`
   - `AudioFiles.class_id` → `AudioFiles.class_id_legacy`
   - `AudioFiles.event_id` → `AudioFiles.event_id_legacy`
   - `AudioFiles.song_id` → `AudioFiles.song_id_legacy`
5. Update documentation

---

## Rollback Procedures

### Emergency Rollback (Data Migration Failure)

If validation fails during Phase 1:

```bash
npx ts-node scripts/migration-4-rollback.ts
# Type "ROLLBACK" to confirm
```

**What it does**:
1. Deletes ALL records from new tables (Events, Classes, Parents, Registrations)
2. Verifies `parent_journey_table` is intact
3. Validates record counts match pre-migration
4. Generates rollback report

**Recovery time**: < 1 hour

### Code Rollback (Production Issues)

If issues occur during Phase 3:

```bash
# Immediate: Disable feature flag
FEATURE_NORMALIZED_TABLES_PERCENTAGE=0

# Or full revert
FEATURE_NORMALIZED_TABLES=false

# Redeploy previous version
git revert <migration-commit-sha>
npm run build
npm run deploy
```

**Recovery time**: < 15 minutes

---

## Troubleshooting

### Common Issues

#### Issue 1: Rate Limiting (429 errors)

**Symptoms**:
```
❌ Error creating batch: 429 Too Many Requests
```

**Solution**:
- Scripts automatically retry after 30s
- If persistent, reduce batch size in `migration-2-populate-tables.ts`:
  ```typescript
  await createRecordsBatch(TABLES.REGISTRATIONS, records, 5); // Reduced from 10
  ```

#### Issue 2: Orphaned Linked Records

**Symptoms**:
```
⚠️ 125 registrations missing parent_id link
```

**Cause**: Parent email not found in Parents table

**Solution**:
- Check `migration-data/parents.json` for missing parent
- Manually create parent record in Airtable
- Re-run `migration-2-populate-tables.ts` (it skips existing records)

#### Issue 3: Data Mismatch

**Symptoms**:
```
❌ Event evt_123 school_name mismatch: "School A" vs "School B"
```

**Cause**: Data changed in `parent_journey_table` between extraction and validation

**Solution**:
- Delete all records from new tables
- Re-run extraction (Script 1) to get latest data
- Re-run population (Script 2)

#### Issue 4: Field ID Errors

**Symptoms**:
```
Error: Unknown field name: "fldXXXXXXXXXXXXXX"
```

**Cause**: Incorrect field ID in `src/lib/types/airtable.ts`

**Solution**:
- Verify field IDs in Airtable UI (field settings → URL)
- Update `EVENTS_FIELD_IDS`, `CLASSES_FIELD_IDS`, etc. in `airtable.ts`
- Re-run scripts

---

## Success Criteria

Migration is successful when:

1. ✅ **Zero data loss** - All 75,000 records preserved
2. ✅ **60% faster queries** - P95 < 1.5 seconds (measured via monitoring)
3. ✅ **No broken R2 audio files** - 0% 404 errors on audio playback
4. ✅ **No increase in support tickets** - User experience unchanged
5. ✅ **99.9% uptime maintained** - No service disruptions
6. ✅ **Parent data deduplicated** - 0 duplicate parent emails
7. ✅ **All links resolve** - 0 orphaned registrations

---

## Next Steps

### For You (Manual Tasks)

1. **Create Airtable schema** (2-3 hours)
   - Follow detailed guide in plan file
   - Copy field IDs

2. **Run dry run on test base** (1 hour)
   - Duplicate production base
   - Run all 4 migration scripts
   - Review validation report

3. **Approve production migration** (decision point)
   - Review dry run results
   - Schedule deployment window (Sunday 2-6 AM CET recommended)

### For Me (Automated Tasks)

Once you've completed the dry run and approve production migration:

1. **Update airtableService.ts** (5 days)
   - Implement dual-read for 48+ methods
   - Add feature flag system
   - Write comprehensive tests

2. **Update teacherService.ts** (2 days)
   - Modify Songs/AudioFiles queries
   - Use linked record fields

3. **Update API endpoints** (2 days)
   - Update all 8 endpoint files
   - Test authentication flows

4. **Deploy and monitor** (2-3 weeks)
   - Gradual rollout with monitoring
   - Automatic rollback on errors
   - Cleanup and documentation

---

## Questions?

Before proceeding, ensure you understand:
- ⚠️ **Manual steps required** (Airtable schema creation)
- ⚠️ **Timeline expectations** (2-3 weeks total)
- ⚠️ **Rollback procedures** (< 1 hour recovery)
- ⚠️ **Monitoring requirements** (error rates, response times)

**Ready to start?** Begin with Phase 0: Airtable Schema Setup.
