# Booking Overview: View Event Quick-Access Icon

## Problem
Users must expand a booking row and then click "View Event" to navigate to the event page — two steps. Users are asking for quicker access.

## Design

### Placement
Inline in the School Name cell of `BookingsTable.tsx`, after the school name text and "No Event" badge (if present). Sits within the existing `flex items-center gap-1.5` container.

### Layout
```
[School Name] [No Event badge?] [Eye icon]
ID: ABC123
```

### Appearance
- Small eye SVG icon (`w-3.5 h-3.5`), reusing the same eye icon from the "View Event" button in `BookingDetailsBreakdown.tsx`
- **Has event:** Teal `text-[#94B8B3]`, hover `text-[#7da39e]`, cursor pointer. Wrapped in `<Link href="/admin/events/${booking.code}">`.
- **No event (`!booking.eventRecordId`):** Grey `text-gray-300`, no hover effect, no link, cursor default.

### Click behavior
- `e.stopPropagation()` on the link to prevent row expand/collapse from triggering.

## Files to modify
- `src/components/admin/bookings/BookingsTable.tsx` — add eye icon in the school name cell

## Scope
Single-file change, no new components or routes needed.
