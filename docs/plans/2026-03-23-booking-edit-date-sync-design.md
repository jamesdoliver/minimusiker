# Booking Edit → SimplyBook Date Sync Design

**Date:** 2026-03-23
**Bug:** When an admin changes a date via EditBookingModal (bookings overview), the date updates in Airtable (SchoolBookings + Events) but does NOT push back to SimplyBook. Activity logging and date change notifications are also missing from this path.

## Current State

Three entry points for date changes:

| Entry Point | Events table | SchoolBookings table | SimplyBook | Activity Log | Notification |
|---|---|---|---|---|---|
| DateChangeModal (View Event) | ✅ | ✅ | ✅ | ✅ | ✅ |
| EditBookingModal (Bookings overview) | ✅ | ✅ | ❌ | ❌ | ❌ |
| SimplyBook webhook (external) | ✅ | ✅ | n/a | ✅ | n/a |

## Target State

All three gaps in the EditBookingModal path are filled:

| Entry Point | Events table | SchoolBookings table | SimplyBook | Activity Log | Notification |
|---|---|---|---|---|---|
| EditBookingModal (Bookings overview) | ✅ | ✅ | ✅ | ✅ | ✅ |

## File Changed

`src/app/api/admin/bookings/[id]/route.ts` — the only file that needs changes.

## Changes

### 1. New Imports

```typescript
import { getActivityService, ActivityService } from '@/lib/services/activityService';
import {
  triggerDateChangeNotification,
  triggerNewBookingNotification,
} from '@/lib/services/notificationService';
```

### 2. Consolidate Linked Event Lookup

Currently two separate `getEventByBookingRecordId(bookingId)` calls exist (lines 176 and 192) — one for `estimated_children` sync, one for `event_date` sync. These were added in separate commits and never consolidated.

**Analysis:** `getEventByBookingRecordId` is a pure read (Airtable `filterByFormula` query). Both calls use the same `bookingId` input and run after the SchoolBookings update — the Events table hasn't been modified between calls. Safe to consolidate into a single lookup.

Move the lookup above both `if` blocks, reuse the result for:
1. `estimated_children` sync
2. `event_date` sync
3. Activity logging (new)
4. Date change notification (new)

Keep the two `updateEventFields` calls separate (not merged into one) for clear per-field logging.

> **Future optimisation note:** The two `updateEventFields` calls for `estimated_children` and `event_date` could be merged into a single Airtable API call. Keeping them separate for now because the per-field console.log statements are valuable for debugging. Revisit if Airtable rate limits become an issue.

### 3. SimplyBook Date Sync

Inside the existing SimplyBook sync block (lines 268–331), after the `editClient` call, add:

```typescript
if (body.event_date !== undefined && simplybookBooking) {
  const dateResult = await simplybookService.editBookingDate(
    booking.simplybookId,
    body.event_date
  );
  if (dateResult.success) {
    simplybookUpdated = true;
    console.log(`[EditBooking] Updated SimplyBook date to ${body.event_date}`);
  } else {
    simplybookError = dateResult.error;
    console.warn(`[EditBooking] SimplyBook date sync failed: ${dateResult.error}`);
  }
}
```

The existing response interface already includes `simplybookUpdated` and `simplybookError` — the frontend EditBookingModal already shows sync status. No frontend changes needed.

For bookings without a SimplyBook ID (manual/pending), the existing `if (booking.simplybookId)` guard on line 268 handles this — no sync attempted.

### 4. Activity Logging

After the event_date sync to Events, log the date change:

```typescript
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
```

The `source: 'booking_edit'` metadata field distinguishes from event-level date changes in the activity feed.

### 5. Date Change Notification

After activity logging, send the appropriate notification:

```typescript
if (body.event_date !== undefined && linkedEvent) {
  const isFirstDateAssignment = !booking.startDate;

  if (isFirstDateAssignment) {
    await triggerNewBookingNotification({
      bookingId: linkedEvent.eventId || linkedEvent.id,
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
  } else {
    await triggerDateChangeNotification({
      bookingId: linkedEvent.eventId || linkedEvent.id,
      schoolName: booking.schoolName || '',
      contactName: booking.schoolContactName || '',
      contactEmail: booking.schoolContactEmail || '',
      contactPhone: booking.schoolPhone || '',
      eventDate: body.event_date,
      address: booking.schoolAddress || '',
      city: booking.city || '',
      oldDate: booking.startDate,
      newDate: body.event_date,
    });
  }
}
```

Simpler than the event PATCH handler because we already have the `booking` object loaded — no extra Airtable lookup needed for contact details.

## Not In Scope

- **Task deadline recalculation** — tightly coupled to the event PATCH handler. If task recalculation is needed, the admin can change the date from the event detail screen.
- **Frontend changes** — the EditBookingModal already displays `simplybookUpdated`/`simplybookError` from the response.

## Testing

1. Change a date via EditBookingModal for a booking WITH a SimplyBook ID → verify SimplyBook updates, activity log created, notification sent
2. Change a date via EditBookingModal for a booking WITHOUT a SimplyBook ID → verify Airtable updates work, no SimplyBook error, activity log still created
3. Set a date on a pending booking (first date assignment) → verify "Bestätigt" notification sent, not date change notification
4. Change only non-date fields (e.g. school_name) → verify no SimplyBook date sync, no activity log, no notification (no regression)
