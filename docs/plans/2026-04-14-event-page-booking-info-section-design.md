# Event Page: Booking Information Section

## Problem
Users navigating to the event detail page can't see key booking information (contact, codes, access link) without going back to the booking overview and expanding the row. This duplicates navigation effort.

## Design

### Placement
New horizontal card between the Event Overview card and Schulsong Status Banners in `src/app/admin/events/[eventId]/page.tsx`. Replaces the existing conditional "Booking Information" section (previously only shown when no classes exist).

### Layout
White card with `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`. Each field: uppercase label + value below. Only shown when `bookingInfo` exists.

### Fields
- Contact Person — from booking
- Email — mailto link
- Phone — tel link  
- Address — address + postalCode + city combined
- Region & Team — region + assigned staff
- Booking Code — mono font
- Event Code — copy button
- Discount Code — copy button (conditional)
- Time — start - end
- Access Link — copy button + QR download (conditional)

### API Changes
Extend `bookingInfo` in `src/app/api/admin/events/[eventId]/route.ts` with 4 new fields:
- `contactPerson` — from `booking.schoolContactName`
- `bookingCode` — from `booking.code`
- `discountCode` — from `booking.simplybookHash`
- `shortUrl` — computed from event `access_code`

### Files to modify
1. `src/app/api/admin/events/[eventId]/route.ts` — extend bookingInfo
2. `src/app/admin/events/[eventId]/page.tsx` — update type, add new section, remove old conditional section
