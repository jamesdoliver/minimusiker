# Admin Booking View Redesign - Status & Event Type Circles

**Date:** 2026-01-25
**Status:** Approved

## Overview

Redesign the admin booking table columns to provide quick visual clarity using a traffic light system for booking status and letter-based circles for event types.

## Data Model

### New Fields on Events Table

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `is_minimusikertag_plus` | Checkbox | false | Shows '+' instead of 'M' in Circle 1 |
| `is_kita` | Checkbox | false | Shows 'K' in Circle 2 |
| `is_schulsong` | Checkbox | false | Shows 'S' in Circle 3 |
| `status` | Single Select | Confirmed | Admin-controlled status (Confirmed, On Hold, Cancelled) |

### Backwards Compatibility

Events with `event_type='Minimusikertag Kita'` automatically show the K circle without requiring `is_kita=true`.

## UI Design

### Booking Table Columns

**Before:** School Name | Contact | Children Count | Category | Status | Booking Date

**After:** School Name | Contact | Children Count | Status | Event Type | Booking Date

### Status Column (Traffic Light)

Small colored circles indicating booking status:
- **Green (#22c55e)** = Confirmed
- **Red (#ef4444)** = On Hold
- **Grey (#9ca3af)** = Cancelled

Tooltip shows status text on hover.

### Event Type Column (Letter Circles)

Up to 3 horizontally-laid circles (20-24px, 4px gap):

| Circle | Color | Letter | Condition |
|--------|-------|--------|-----------|
| 1 | Light blue (#93c5fd) | M | Default (always shown) |
| 1 | Light blue (#93c5fd) | + | When is_minimusikertag_plus=true |
| 2 | Light purple (#c4b5fd) | K | When is_kita=true OR event_type='Minimusikertag Kita' |
| 3 | Light peach (#fdba74) | S | When is_schulsong=true |

### Event Details Page Controls

Located next to existing "Change Date" functionality:

1. **Status Dropdown**
   - Options: Confirmed, On Hold, Cancelled
   - Color indicator matches selection
   - Saves immediately on change

2. **Event Type Toggles**
   - Minimusikertag PLUS toggle (controls + vs M)
   - Kita toggle
   - Schulsong toggle
   - Each saves immediately to Airtable
   - Preview circles shown alongside

## Technical Implementation

### API Changes

**PATCH /api/admin/events/[eventId]**
```typescript
// New supported fields
{
  status?: 'Confirmed' | 'On Hold' | 'Cancelled',
  is_minimusikertag_plus?: boolean,
  is_kita?: boolean,
  is_schulsong?: boolean
}
```

**GET /api/admin/bookings**
```typescript
// BookingWithDetails response includes
{
  eventStatus: 'Confirmed' | 'On Hold' | 'Cancelled',
  isMinimusikertragPlus: boolean,
  isKita: boolean,
  isSchulsong: boolean,
  eventType: string // for backwards compatibility check
}
```

### Component Structure

```
src/components/admin/bookings/
├── BookingsTable.tsx          # Updated columns
├── StatusCircle.tsx           # New - traffic light circle
├── EventTypeCircles.tsx       # New - M/+, K, S circles
└── BookingStatusBadge.tsx     # Deprecated (replaced by StatusCircle)
```

## Decisions Made

1. **Data model:** Separate boolean fields (not multi-select) for flexibility
2. **Circle 1 logic:** 'M' is always shown by default, '+' overrides when enabled
3. **Kita compatibility:** Respects existing event_type='Minimusikertag Kita' values
4. **Save behavior:** Immediate save on toggle/dropdown change
5. **Toggle location:** Event Details page only (not in expanded booking row)
6. **Category column:** Removed completely (info available in expanded details)
