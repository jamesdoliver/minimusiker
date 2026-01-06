# 🧪 Migration Testing - Quick Start Checklist

Use this checklist to test the Airtable migration locally.

---

## ⚙️ Setup (5 minutes)

### Step 1: Update Environment Variables

Open your `.env.local` (or `.env`) file and add:

```bash
# ✅ Enable migration feature flag
USE_NORMALIZED_TABLES=true

# ✅ Verify these table IDs are set (should already be there)
EVENTS_TABLE_ID=tblVWx1RrsGRjsNn5
CLASSES_TABLE_ID=tbl17SVI5gacwOP0n
PARENTS_TABLE_ID=tblaMYOUj93yp7jHE
REGISTRATIONS_TABLE_ID=tblXsmPuZcePcre5u
```

### Step 2: Verify Migration Data Exists

Check your Airtable base has data in the new tables:
- [ ] Events table has records
- [ ] Classes table has records
- [ ] Parents table has records
- [ ] Registrations table has records

**If tables are empty**, run migration scripts first:
```bash
npx ts-node scripts/migration-1-extract-data.ts
npx ts-node scripts/migration-2-populate-tables.ts
npx ts-node scripts/migration-3-validate.ts
```

---

## 🔍 Quick Verification (2 minutes)

### Step 3: Run Automated Tests

```bash
node scripts/test-migration-locally.js
```

**Expected output:**
```
✅ Environment Variables: PASS
✅ Feature Flag: PASS
✅ Events Table Access: PASS
✅ Classes Table Access: PASS
✅ Parents Table Access: PASS
✅ Registrations Table Access: PASS
...
🎉 All tests passed!
```

**If tests fail:**
- Check error messages for hints
- Verify table IDs match your Airtable base
- Ensure migration scripts were run

---

## 🌐 Manual App Testing (10-15 minutes)

### Step 4: Start Development Server

```bash
npm run dev
```

### Step 5: Test Core Features

**Parent Portal:**
- [ ] Login with a parent email works
- [ ] Dashboard shows all events/children
- [ ] No errors in console

**Admin Portal:**
- [ ] Event list loads
- [ ] Event details page works
- [ ] Class rosters display correctly
- [ ] Analytics/stats are accurate

**Teacher Portal:**
- [ ] Login works
- [ ] Songs for classes load
- [ ] Audio files appear
- [ ] Can create new songs

### Step 6: Check Server Logs

Look for these indicators that migration is working:
- [ ] Log messages contain `(normalized)` (not `(legacy)`)
- [ ] Field ID queries like `{fldXXXXX}`
- [ ] Linked record filters like `{class_link} = 'recXXXX'`
- [ ] No Airtable API errors

---

## ✅ Success Criteria

Migration is working if:
- [x] All automated tests pass
- [x] App loads without errors
- [x] Data appears correctly in all portals
- [x] Server logs show normalized queries
- [x] No data missing compared to legacy

---

## 🔄 Rollback (If Needed)

If you encounter critical issues:

**Quick Rollback (30 seconds):**
```bash
# In .env.local or .env, change:
USE_NORMALIZED_TABLES=false

# Restart dev server
npm run dev
```

Everything reverts to legacy `parent_journey_table`.

---

## 📚 Detailed Documentation

- **Full Testing Guide**: `LOCAL_TESTING_GUIDE.md`
- **Migration Progress**: `MIGRATION_PROGRESS.md`
- **Implementation Details**: `MIGRATION_CODE_UPDATES.md`

---

## 🎯 Next Steps After Local Testing

Once all tests pass locally:
1. [ ] Commit changes to git
2. [ ] Deploy to staging with flag OFF
3. [ ] Enable flag in staging
4. [ ] Run E2E tests on staging
5. [ ] Deploy to production (same process)

---

**Need help?** Check server logs and Airtable console for detailed errors.

**Ready to test?** Run: `node scripts/test-migration-locally.js`
