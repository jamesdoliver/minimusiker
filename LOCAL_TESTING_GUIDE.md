# Local Testing Guide - Airtable Migration

**Purpose**: Test the dual-read migration pattern locally before deploying to staging/production.

---

## 🚀 Quick Start

### Step 1: Set Environment Variables

Add these to your `.env.local` file (or `.env`):

```bash
# Enable normalized tables feature flag
USE_NORMALIZED_TABLES=true

# Table IDs (already set in your .env, verify they're present)
EVENTS_TABLE_ID=tblVWx1RrsGRjsNn5
CLASSES_TABLE_ID=tbl17SVI5gacwOP0n
PARENTS_TABLE_ID=tblaMYOUj93yp7jHE
REGISTRATIONS_TABLE_ID=tblXsmPuZcePcre5u

# Your existing Airtable credentials (should already be set)
AIRTABLE_API_KEY=your_key_here
AIRTABLE_BASE_ID=your_base_id_here
```

### Step 2: Build the Project

```bash
npm run build
```

If you see TypeScript errors, that's expected for now - we can address them if they're blocking.

### Step 3: Run the Verification Script

```bash
node scripts/test-migration-locally.js
```

This will test all major functionality with the feature flag ON.

---

## 📋 Manual Testing Checklist

### ✅ Parent Authentication & Portal

**Test Parent Login:**
1. Navigate to parent login page
2. Enter a parent email that exists in your database
3. Verify login succeeds
4. Check console/logs for "normalized" queries (not "legacy")

**Test Parent Portal:**
1. After login, view parent dashboard
2. Verify all events are displayed
3. Verify all children are shown
4. Check that class information is correct

**Expected Behavior:**
- Parent login should use Parents table query
- Dashboard should show registrations from Registrations table
- All data should match legacy behavior exactly

---

### ✅ Admin Dashboard

**Test Event List:**
1. Navigate to `/admin/events` or admin dashboard
2. Verify all events are listed
3. Check event counts (registrations, classes)
4. Verify staff/engineer assignments appear

**Test Event Detail:**
1. Click into a specific event
2. Verify all classes are shown
3. Check class rosters (children list)
4. Verify parent contact information appears

**Test Analytics:**
1. View admin dashboard statistics
2. Check parent count, event count, conversion rate
3. Verify event-specific analytics (registrations, revenue)

**Expected Behavior:**
- Events queried from Events table
- Classes linked via Classes table
- Registrations from Registrations table
- Parent data from Parents table

---

### ✅ Teacher Portal

**Test Teacher Login:**
1. Navigate to teacher portal login
2. Use magic link or login flow
3. Verify teacher events are loaded

**Test Songs Management:**
1. View songs for a class
2. Add a new song
3. Verify song appears in list
4. Check that linked fields are populated (class_link, event_link)

**Test Audio Files:**
1. Upload an audio file (if you have upload flow)
2. Verify audio file is tracked
3. Check linked fields are populated

**Expected Behavior:**
- Songs queried using class_link/event_link
- Audio files queried using class_link/event_link
- New songs/audio populate linked record fields

---

### ✅ Registration Creation

**Test New Parent Registration:**
1. Navigate to registration form (if accessible)
2. Create a new parent + child registration
3. Verify parent is deduplicated (check Parents table)
4. Verify registration appears in Registrations table

**Test Existing Parent Registration:**
1. Register a child for an existing parent (same email)
2. Verify parent record is reused (not duplicated)
3. Verify new registration links to existing parent

**Expected Behavior:**
- Parent email lookup from Parents table
- Parent deduplication works
- Registrations link to Parents via parent_id field

---

### ✅ Search & Filtering

**Test Search by Child Name:**
1. Use search functionality for child name
2. Verify results are returned
3. Check that parent information is included

**Test Email Campaign Opt-ins:**
1. Query parents who opted into email campaigns
2. Verify results come from Parents table

**Test Orders:**
1. Query parents with completed orders
2. Verify results are correct

**Expected Behavior:**
- All search queries use normalized tables
- Results match legacy behavior

---

## 🔍 Debugging Tips

### Check Which Code Path is Running

Add console logs to verify feature flag:

```javascript
// In browser console or server logs, look for:
console.log('USE_NORMALIZED_TABLES:', process.env.USE_NORMALIZED_TABLES);
```

You should see `'true'` if the flag is enabled.

### Verify Airtable Queries

Check server logs for Airtable API calls. You should see:
- `(normalized)` in error messages (from new code paths)
- Queries using field IDs like `{fldXXXXXX}`
- Linked record filters like `{class_link} = 'recXXXXXX'`

### Compare Results

**Test with flag ON, then OFF:**
1. Set `USE_NORMALIZED_TABLES=true`, run queries, note results
2. Set `USE_NORMALIZED_TABLES=false`, run same queries
3. Results should be **identical** (backward compatibility)

### Check Airtable Directly

Verify data in Airtable UI:
1. Open Events, Classes, Parents, Registrations tables
2. Check that records exist
3. Verify linked records are populated
4. Check that Songs/AudioFiles have class_link/event_link populated

---

## ⚠️ Common Issues

### Issue 1: "Table not found" errors
**Cause**: Table IDs not set or incorrect
**Fix**: Verify `EVENTS_TABLE_ID`, `CLASSES_TABLE_ID`, etc. in `.env`

### Issue 2: "Field not found" errors
**Cause**: Field IDs don't match Airtable
**Fix**: Check field IDs in `/src/lib/types/airtable.ts` match your Airtable base

### Issue 3: Empty results
**Cause**: No data in normalized tables yet
**Fix**: Run migration scripts first:
```bash
npx ts-node scripts/migration-1-extract-data.ts
npx ts-node scripts/migration-2-populate-tables.ts
npx ts-node scripts/migration-3-validate.ts
```

### Issue 4: Linked records not populated
**Cause**: Records created before migration, linked fields not set
**Fix**: Re-run migration script 2 to populate linked fields

### Issue 5: Performance is slow
**Expected**: Normalized tables require 3-4 API calls vs 1 for legacy
**Mitigation**: This is expected during migration. Add caching later if needed.

---

## 🧪 Test Script Output

When you run `node scripts/test-migration-locally.js`, you should see:

```
✅ Feature flag is ON
✅ Table IDs are set
✅ Parent login works
✅ Parent portal data loads
✅ Admin event list loads
✅ Event detail loads
✅ Songs query works
✅ Audio files query works
✅ Registration creation works
✅ Search functionality works

🎉 All tests passed! Migration is working correctly.
```

---

## 📊 Expected Performance

| Operation | Legacy | Normalized | Change |
|-----------|--------|------------|--------|
| Parent login | 1 API call | 2-3 API calls | +1-2 calls |
| Parent portal | 1 API call | 3-4 API calls | +2-3 calls |
| Event list | 1 API call | 2-3 API calls | +1-2 calls |
| Songs query | 1 API call | 2 API calls | +1 call |

**Note**: Normalized structure is **faster** for indexed lookups (parent email, event_id) but requires more API calls. This is expected and acceptable.

---

## ✅ Success Criteria

Migration is successful when:
1. ✅ All API responses match legacy structure exactly
2. ✅ No errors in console/server logs
3. ✅ Parent login works
4. ✅ Admin dashboard loads
5. ✅ Teacher portal loads
6. ✅ New registrations create records in normalized tables
7. ✅ Linked record fields are populated

---

## 🔄 Rollback Plan

If critical issues arise:

**Immediate Rollback** (< 1 minute):
```bash
# Set feature flag to false in .env
USE_NORMALIZED_TABLES=false

# Restart your dev server
npm run dev
```

All queries will revert to legacy `parent_journey_table`.

---

## 📞 Next Steps After Local Testing

Once local testing passes:
1. Commit changes to git
2. Deploy to staging with `USE_NORMALIZED_TABLES=false`
3. Verify staging works (legacy mode)
4. Enable flag in staging: `USE_NORMALIZED_TABLES=true`
5. Run E2E tests on staging
6. Monitor for 24-48 hours
7. Deploy to production (same process)

---

**Questions or issues?** Check the server logs for detailed error messages with "(normalized)" tags.
