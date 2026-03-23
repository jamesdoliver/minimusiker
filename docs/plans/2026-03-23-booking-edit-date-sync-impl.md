# Booking Edit Date Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add SimplyBook date sync, activity logging, and date change notifications to the booking PATCH handler so that date changes via EditBookingModal have full parity with the DateChangeModal path.

**Architecture:** All changes are in one file (`src/app/api/admin/bookings/[id]/route.ts`). We add imports, consolidate a duplicate Airtable lookup, then add three new blocks: SimplyBook date push, activity log, and notification dispatch.

**Tech Stack:** Next.js API route, Airtable, SimplyBook JSON-RPC, Resend notifications

---

### Task 1: Add New Imports

**Files:**
- Modify: `src/app/api/admin/bookings/[id]/route.ts:1-9`

**Step 1: Add activity and notification imports**

Add after line 6 (`import { updateSchoolBookingById }...`):

```typescript
import { getActivityService, ActivityService } from '@/lib/services/activityService';
import {
  triggerDateChangeNotification,
  triggerNewBookingNotification,
} from '@/lib/services/notificationService';
```

**Step 2: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -20`
Expected: Build succeeds (imports are valid, used later)

**Step 3: Commit**

```bash
git add src/app/api/admin/bookings/[id]/route.ts
git commit -m "chore: add activity and notification imports to booking PATCH handler"
```

---

### Task 2: Consolidate Duplicate Linked Event Lookup

**Files:**
- Modify: `src/app/api/admin/bookings/[id]/route.ts:170-202`

**Step 1: Replace the two separate lookups with one shared lookup**

Replace lines 170-202 (from `airtableUpdated = true;` through the end of the event_date sync block) with:

```typescript
        airtableUpdated = true;
        console.log(`[EditBooking] Updated Airtable booking: ${bookingId}`);

        // Fetch linked Event once for all downstream syncs
        // (estimated_children, event_date, activity log, notifications)
        let linkedEvent: Awaited<ReturnType<typeof airtableService.getEventByBookingRecordId>> = null;
        if (body.estimated_children !== undefined || body.event_date !== undefined) {
          try {
            linkedEvent = await airtableService.getEventByBookingRecordId(bookingId);
            if (!linkedEvent) {
              console.warn(`[EditBooking] No linked Event found for booking ${bookingId}`);
            }
          } catch (eventErr) {
            console.warn('[EditBooking] Failed to find linked Event:', eventErr);
          }
        }

        // Sync estimated_children to the linked Event record
        // NOTE: Kept as separate updateEventFields call (not merged with event_date)
        // for clear per-field logging. Could be merged if Airtable rate limits become an issue.
        if (body.estimated_children !== undefined && linkedEvent) {
          try {
            await airtableService.updateEventFields(linkedEvent.id, {
              estimated_children: body.estimated_children,
              is_under_100: body.estimated_children < 100,
            });
            console.log(`[EditBooking] Synced estimated_children=${body.estimated_children} to Event ${linkedEvent.id}`);
          } catch (eventErr) {
            console.warn('[EditBooking] Failed to sync estimated_children to Event:', eventErr);
          }
        }

        // Sync event_date to the linked Event record
        if (body.event_date !== undefined && linkedEvent) {
          try {
            await airtableService.updateEventFields(linkedEvent.id, {
              event_date: body.event_date,
            });
            console.log(`[EditBooking] Synced event_date=${body.event_date} to Event ${linkedEvent.id}`);
          } catch (eventErr) {
            console.warn('[EditBooking] Failed to sync event_date to Event:', eventErr);
          }
        }

        // Activity log for date change
        if (body.event_date !== undefined && linkedEvent) {
          const oldDate = booking.startDate || 'Unknown';
          getActivityService().logActivity({
            eventRecordId: linkedEvent.id,
            activityType: 'date_changed',
            description: ActivityService.generateDescription('date_changed', {
              oldDate,
              newDate: body.event_date,
            }),
            actorEmail: admin.email,
            actorType: 'admin',
            metadata: { oldDate, newDate: body.event_date, source: 'booking_edit' },
          });
        }

        // Date change notification
        if (body.event_date !== undefined && linkedEvent) {
          try {
            const isFirstDateAssignment = !booking.startDate;

            if (isFirstDateAssignment) {
              await triggerNewBookingNotification({
                bookingId: linkedEvent.event_id || linkedEvent.id,
                schoolName: booking.schoolName || '',
                contactName: booking.schoolContactName || '',
                contactEmail: booking.schoolContactEmail || '',
                contactPhone: booking.schoolPhone || '',
                eventDate: body.event_date,
                estimatedChildren: booking.estimatedChildren,
                address: booking.schoolAddress || '',
                city: booking.city || '',
                status: 'Bestätigt',
              });
              console.log(`[EditBooking] Sent new booking notification for ${linkedEvent.event_id}`);
            } else {
              await triggerDateChangeNotification({
                bookingId: linkedEvent.event_id || linkedEvent.id,
                schoolName: booking.schoolName || '',
                contactName: booking.schoolContactName || '',
                contactEmail: booking.schoolContactEmail || '',
                contactPhone: booking.schoolPhone || '',
                eventDate: body.event_date,
                address: booking.schoolAddress || '',
                city: booking.city || '',
                oldDate: booking.startDate!,
                newDate: body.event_date,
              });
              console.log(`[EditBooking] Sent date change notification for ${linkedEvent.event_id}`);
            }
          } catch (notifErr) {
            console.warn('[EditBooking] Failed to send date notification:', notifErr);
          }
        }
```

**Step 2: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/api/admin/bookings/[id]/route.ts
git commit -m "feat: add activity logging and notifications for booking date changes"
```

---

### Task 3: Add SimplyBook Date Sync

**Files:**
- Modify: `src/app/api/admin/bookings/[id]/route.ts` (SimplyBook sync block, ~line 306-322)

**Step 1: Add date sync after the editClient call**

Replace the block at line 319-322 (the `else` branch that sets `simplybookUpdated = true` for "no SimplyBook-relevant fields"):

```typescript
          } else {
            // No SimplyBook-relevant client fields to update
            simplybookUpdated = true;
          }

          // Sync date change to SimplyBook (separate from client data)
          if (body.event_date !== undefined) {
            const dateResult = await simplybookService.editBookingDate(
              booking.simplybookId!,
              body.event_date
            );
            if (dateResult.success) {
              simplybookUpdated = true;
              console.log(`[EditBooking] Updated SimplyBook date to ${body.event_date} for booking ${booking.simplybookId}`);
            } else {
              simplybookError = dateResult.error;
              console.warn(`[EditBooking] SimplyBook date sync failed: ${dateResult.error}`);
            }
          }
```

Note: The date sync runs regardless of whether client fields were updated — a date-only change should still push to SimplyBook. Place it after the `editClient` if/else block but inside the `if (simplybookBooking && simplybookBooking.client_id)` check since `editBookingDate` needs the booking to exist in SimplyBook.

**Step 2: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -20`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/api/admin/bookings/[id]/route.ts
git commit -m "feat: sync date changes to SimplyBook from booking edit handler"
```

---

### Task 4: Manual Testing Checklist

1. Change a date via EditBookingModal for a booking WITH a SimplyBook ID → verify SimplyBook calendar updates, activity log entry appears, notification email sent
2. Change a date via EditBookingModal for a booking WITHOUT a SimplyBook ID → verify Airtable updates work, no SimplyBook error in response, activity log still created
3. Set a first date on a pending booking → verify "Bestätigt" notification sent (not date change notification)
4. Change only non-date fields (e.g. school_name) → verify no SimplyBook date sync attempt, no activity log, no notification (no regression)
5. Change date + estimated_children simultaneously → verify only one `getEventByBookingRecordId` call in logs (not two)
