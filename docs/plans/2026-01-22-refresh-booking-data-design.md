# Refresh Booking Data Feature

## Overview

Add a "Refresh Booking Data" button to the admin booking accordion view that allows admins to re-sync missing data from SimplyBook when a booking has incomplete information.

## Problem

When bookings are synced from SimplyBook to Airtable, some fields may be missing due to:
- Sync issues at the time of booking creation
- Updates made in SimplyBook after initial sync

Admins currently have no way to re-fetch this data without running CLI scripts.

## Solution

A button in the admin accordion view that:
1. Fetches current data from SimplyBook API
2. Shows a preview of what would change
3. Lets admin confirm before applying updates
4. Warns about fields that are missing in SimplyBook (can't be fixed)

## User Flow

1. Admin expands a booking in the accordion view
2. Clicks "Refresh Booking Data" (blue button, left of existing buttons)
3. Button shows spinner with "Checking..." while fetching
4. Modal opens showing:
   - Fields that will be updated (current → new value)
   - Warning about fields still missing in SimplyBook
5. Admin clicks "Apply Updates" or "Cancel"
6. On apply: Airtable record updated, toast confirms success
7. Modal closes

## UI Design

### Button Placement

```
[Refresh Booking Data (blue)] [Confirm Printables (orange)] [View Event Details (teal)]
```

### Preview Modal

```
┌─────────────────────────────────────────────────┐
│  Refresh Booking Data                        X  │
├─────────────────────────────────────────────────┤
│                                                 │
│  ✓ 3 fields will be updated:                   │
│                                                 │
│    Contact Person:  "" → "Lucie Tüffers"       │
│    Address:         "" → "Bonnstraße 52"       │
│    Postal Code:     "" → "50321"               │
│                                                 │
│  ⚠ 2 fields still missing (not in SimplyBook): │
│    • Phone                                      │
│    • Estimated Children                         │
│                                                 │
├─────────────────────────────────────────────────┤
│              [Cancel]    [Apply Updates]        │
└─────────────────────────────────────────────────┘
```

### States

- **No updates available**: Modal shows "Already up to date" with Close button only
- **Updates available**: Shows comparison table + Apply/Cancel buttons
- **Error**: Toast notification with error message

## API Design

### Endpoint

`POST /api/admin/bookings/[id]/refresh`

### Query Parameters

- `preview=true` - Returns comparison data without making changes
- `preview=false` (or omitted) - Applies updates and returns result

### Preview Response

```typescript
interface RefreshPreviewResponse {
  success: true;
  updates: Array<{
    field: string;      // Airtable field name
    label: string;      // Human-readable label
    current: string;    // Current value in Airtable
    new: string;        // Value from SimplyBook
  }>;
  stillMissing: Array<{
    field: string;
    label: string;
  }>;
  hasUpdates: boolean;
}
```

### Apply Response

```typescript
interface RefreshApplyResponse {
  success: true;
  updatedCount: number;
  message: string;
}
```

### Error Response

```typescript
interface RefreshErrorResponse {
  success: false;
  error: string;
}
```

## Files to Create

### `src/app/api/admin/bookings/[id]/refresh/route.ts`

New API endpoint that:
- Fetches SchoolBooking from Airtable by ID
- Fetches booking from SimplyBook using stored `simplybook_id`
- Uses `mapIntakeFields` logic to extract data
- Compares and returns diff (preview) or applies updates

### `src/components/admin/bookings/RefreshBookingModal.tsx`

Modal component with:
- Props: `isOpen`, `onClose`, `bookingId`, `previewData`, `onApply`, `isApplying`
- Updates table with current → new values
- Warning section for missing fields
- Cancel and Apply buttons

## Files to Modify

### `src/components/admin/bookings/BookingDetailsBreakdown.tsx`

Add:
- State: `isRefreshing`, `showRefreshModal`, `refreshData`
- Handler: `handleRefresh()` - calls preview API, opens modal
- Handler: `handleApplyRefresh()` - calls apply API, shows toast
- Button: "Refresh Booking Data" positioned left of existing buttons
- Modal: `<RefreshBookingModal />` component

## Field Mapping

Fields checked for updates (reuses existing `mapIntakeFields` logic):

| Airtable Field | SimplyBook Source | Keywords |
|----------------|-------------------|----------|
| school_name | client, intake form | name, schule, school, einrichtung |
| school_contact_name | intake form, client_name | ansprechpartner, contact, kontakt |
| school_contact_email | client_email, intake form | email, e-mail |
| school_phone | client_phone, intake form | telefon, phone, tel |
| school_address | intake form, client_address1 | adresse, address, strasse, street |
| school_postal_code | intake form, client_zip | plz, postal, postleitzahl, postcode |
| city | client_city, intake form | stadt, city, ort |
| estimated_children | intake form | kinder, children, anzahl |

## Estimated Scope

- ~200-250 lines of new code
- 2 new files
- 1 modified file
