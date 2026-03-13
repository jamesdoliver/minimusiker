# Shop Under-100 Kids Merchandise Gate — Audit Fixes

**Date:** 2026-03-13
**Trigger:** Grundschule Löf reported showing personalized ("schul") merchandise despite having <100 kids.

## Root Cause

The `is_under_100` flag on the Events table can be stale or missing due to three code bugs:

1. **SimplyBook booking changes don't propagate to Events** — `handleBookingChange` updates SchoolBookings but never updates the linked Event's `estimated_children` or `is_under_100`.
2. **Schulsong → Event creation skips kid count** — `createEventFromSchulsong` passes `undefined` for `estimatedChildren`, so `is_under_100` is never set.
3. **Falsy coercion** — Multiple call sites use `booking.estimatedChildren || undefined`, converting `0` to `undefined` and skipping the flag.

## Fixes

### Fix 1: Propagate booking changes to Events

**File:** `src/app/api/simplybook/webhook/route.ts` (`handleBookingChange`)

After updating the SchoolBooking record, look up the linked Event via `getEventBySchoolBookingId`. If found, call `updateEventRecord` with the new `estimated_children` and recalculated `is_under_100`.

### Fix 2: Pass Einrichtung kid count to Schulsong events

**File:** `src/lib/services/airtableService.ts` (`createEventFromSchulsong`)

Before calling `createEventFromBooking`, fetch the Einrichtung record using the provided `einrichtungId`. Pass `einrichtung.numberOfChildren` as the `estimatedChildren` parameter.

### Fix 3: Use nullish coalescing instead of OR

**Files:** 4 call sites across:
- `src/app/api/admin/bookings/route.ts`
- `src/app/api/admin/bookings/[id]/route.ts`
- `src/app/api/admin/bookings/[id]/create-event/route.ts`
- `src/app/api/admin/events/[eventId]/route.ts`

Change `booking.estimatedChildren || undefined` → `booking.estimatedChildren ?? undefined`.

## Not changing

- Default behavior of `computeStandardMerchOnly` when `is_under_100` is undefined — remains permissive (show personalized). Upstream fixes are the proper solution.
