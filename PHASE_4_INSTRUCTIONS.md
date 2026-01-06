# Phase 4 Implementation Guide: Booking Setup Flow

**Last Updated:** 2024-12-28
**Status:** Ready to Start
**Plan File:** `/Users/jamesoliver/.claude/plans/linked-wandering-pine.md`

---

## 📋 Quick Context

### What We've Completed
- ✅ **Phase 1:** All API endpoints (representative, tips, school info, events with progress)
- ✅ **Phase 2:** All 9 UI components built and working
- ✅ **Phase 3:** Dashboard completely redesigned
- ✅ **Bug Fix:** Fixed verifyTeacherSession import path

### What Phase 4 Does
Moves the "pending bookings" setup workflow from the main dashboard to a dedicated page at `/teacher/setup-booking/[bookingId]`. This keeps the dashboard clean while ensuring teachers don't miss bookings that need setup.

---

## 🎯 Phase 4 Goals

1. Create dedicated setup page: `/teacher/setup-booking/[bookingId]`
2. Add notification badge in header for pending bookings
3. Add modal on login to alert teachers of pending bookings
4. Preserve all existing setup functionality

---

## 📝 Implementation Checklist

### Step 1: Create Setup Page Route
**File:** `src/app/teacher/setup-booking/[bookingId]/page.tsx`

```typescript
// This is a NEW file - create the folder structure first:
// src/app/teacher/setup-booking/[bookingId]/page.tsx

// What to include:
// - Extract bookingId from URL params
// - Fetch specific booking from /api/teacher/bookings
// - Display booking details (school, date, children count)
// - Form to add classes
// - API call to POST /api/teacher/bookings/[bookingId]/setup
// - Redirect to /teacher/events/[eventId] after setup
```

**Reference:** Check git history for old pending bookings code:
```bash
git log -p --all -- src/app/teacher/page.tsx | grep -A 50 "PendingBookingCard"
```

### Step 2: Create Notification Badge Component
**File:** `src/components/teacher/PendingBookingsBadge.tsx`

```typescript
// Features:
// - Fetch pending bookings from /api/teacher/bookings
// - Show red badge with count (if pending bookings exist)
// - Click opens dropdown with list
// - Each item: school name, date, "Setup" button
// - "Setup" button navigates to /teacher/setup-booking/[bookingId]

// No props (fetches internally)
// Place in header next to logout button
```

### Step 3: Create Login Modal Component
**File:** `src/components/teacher/PendingBookingsModal.tsx`

```typescript
interface PendingBookingsModalProps {
  bookings: PendingBooking[];
  onClose: () => void;
}

// Features:
// - Shows on login if pending bookings detected
// - Message: "Sie haben [X] Buchungen, die eingerichtet werden müssen"
// - Lists all pending bookings with dates
// - "Jetzt einrichten" button → /teacher/setup-booking/[first-booking-id]
// - "Später" button → closes modal, stays on dashboard
```

### Step 4: Update Dashboard
**File:** `src/app/teacher/page.tsx`

Changes needed:
1. Add `<PendingBookingsBadge />` to header (already has space, add near logout)
2. Fetch pending bookings in useEffect (if not already done)
3. Add `<PendingBookingsModal />` with show/hide logic
4. Modal shows if `pendingBookings.length > 0` on mount

---

## 🔌 API Endpoints (Already Built - Just Use Them!)

```typescript
// Fetch pending bookings
GET /api/teacher/bookings
Response: { pendingSetup: PendingBooking[] }

// Initialize event from booking
POST /api/teacher/bookings/[bookingId]/setup
Response: { eventId: string }

// Add classes to event
POST /api/teacher/events/[eventId]/classes
Body: { name: string, numChildren?: number }
```

---

## ✅ Testing Checklist

After implementing, verify:

- [ ] Dashboard (`/teacher`) does NOT show pending bookings section
- [ ] Header shows badge only if pending bookings exist
- [ ] Badge shows correct count
- [ ] Click badge opens dropdown with pending bookings list
- [ ] Click "Setup" in dropdown navigates to setup page
- [ ] Setup page URL format: `/teacher/setup-booking/rec123abc`
- [ ] Setup page shows correct booking details
- [ ] Can add classes on setup page
- [ ] After adding classes, redirects to `/teacher/events/[eventId]`
- [ ] Login modal appears if pending bookings detected (test by refreshing page)
- [ ] Modal "Später" button closes modal
- [ ] Modal "Jetzt einrichten" button navigates to first booking

---

## 🐛 Common Issues & Solutions

### Issue 1: 404 on setup page
**Cause:** Incorrect folder structure
**Fix:** Ensure path is `app/teacher/setup-booking/[bookingId]/page.tsx` (note square brackets)

### Issue 2: Badge doesn't show
**Cause:** API not returning pending bookings
**Fix:** Check `/api/teacher/bookings` response - verify `pendingSetup` array exists and `needsSetup: true`

### Issue 3: Can't find old pending bookings code
**Cause:** Code was removed in Phase 3
**Fix:** Use git history:
```bash
git show HEAD~3:src/app/teacher/page.tsx
```

### Issue 4: Import errors
**Cause:** Missing PendingBooking type
**Fix:** Import from existing file:
```typescript
import type { PendingBooking } from '@/app/teacher/page'; // or wherever it's defined
```

---

## 📂 File Structure After Phase 4

```
src/
├── app/
│   └── teacher/
│       ├── page.tsx                         (Modified - add badge & modal)
│       └── setup-booking/
│           └── [bookingId]/
│               └── page.tsx                 (NEW - setup flow)
└── components/
    └── teacher/
        ├── PendingBookingsBadge.tsx         (NEW - header badge)
        └── PendingBookingsModal.tsx         (NEW - login modal)
```

---

## 🎨 UI/UX Requirements

### Badge Design
- Position: Header, top-right, next to logout
- Style: Red circle with white number
- Size: Small (20px diameter)
- Shows: Count of pending bookings

### Dropdown Design
- Appears below badge on click
- White background, shadow
- Each item shows:
  - School name (bold)
  - Event date
  - "Setup" button (pink, small)

### Modal Design
- Centered on screen
- Semi-transparent backdrop
- White card with:
  - Heading: "Buchungen einrichten"
  - List of pending bookings
  - Two buttons: "Später" (gray), "Jetzt einrichten" (pink)

### Setup Page Design
- Similar to old pending bookings card
- Full-width page (not modal)
- Shows booking details prominently
- Form for adding classes
- Progress indicator if multiple steps

---

## 🚀 Success Criteria

Phase 4 is complete when ALL of these are true:

1. ✅ No pending bookings section on main dashboard
2. ✅ Badge in header shows when pending bookings exist
3. ✅ Badge count is accurate
4. ✅ Dropdown works and shows all pending bookings
5. ✅ Setup page loads at correct URL
6. ✅ Setup page shows booking details
7. ✅ Can complete setup (add classes)
8. ✅ Redirects to event detail after setup
9. ✅ Modal shows on login if pending bookings
10. ✅ Modal buttons work correctly
11. ✅ No console errors
12. ✅ All existing functionality preserved

---

## 🔄 After Phase 4

Next: **Phase 5 - Polish & Testing**

Tasks:
1. Add environment variables (NEXT_PUBLIC_SUPPORT_EMAIL, NEXT_PUBLIC_SUPPORT_PHONE)
2. Test responsive design on mobile
3. Add real representative bios to Airtable Personen table
4. Add real preparation tips to Airtable PreparationTips table
5. Test all edge cases (no events, no rep, empty states)
6. Visual polish (match mockup exactly)
7. Performance testing (dashboard load time < 2 seconds)

---

## 📞 Need Help?

- **Plan File:** `/Users/jamesoliver/.claude/plans/linked-wandering-pine.md`
- **Git History:** `git log -p src/app/teacher/page.tsx` to see old code
- **API Routes:** Check `src/app/api/teacher/` for existing endpoints
- **Components:** Reference existing components in `src/components/teacher/`

---

## 💡 Pro Tips

1. **Start with Step 1** (setup page) - it's the most complex
2. **Test each step** before moving to the next
3. **Reuse existing code** from git history
4. **Don't create new APIs** - all endpoints already exist
5. **Keep it simple** - just move functionality, don't redesign
6. **Test the happy path first**, then edge cases
7. **Check console for errors** frequently while building

---

**Good luck with Phase 4! 🚀**
