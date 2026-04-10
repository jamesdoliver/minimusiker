# Deal Builder: Unlock Zusatzinformationen + Event Page Layout + Notes Sync

**Date:** 2026-04-09  
**Status:** Approved

## Overview

Three related changes:
1. Unlock Zusatzinformationen checkboxes in Deal Builder (deal-config-only, no event-level side effects)
2. Restructure event detail page layout: Event Config becomes full-width, Deal Builder + Admin Notes sit side-by-side below
3. Add explicit Save Notes button to both event detail page and bookings overview (replacing debounced auto-save)

## 1. Unlock Zusatzinformationen

All four checkboxes become editable, stored purely in `deal_config` JSON. They do not affect event-level fields.

**DealBuilder.tsx changes:**
- Remove props: `isPlus`, `scsShirtsIncluded`, `minicardOrderEnabled`, `minicardOrderQuantity`
- Checkboxes read/write `localConfig.info_*` fields instead of props
- Remove `disabled` attribute from all Zusatzinformationen checkboxes
- `handleSave` reads `info_*` from `localConfig` instead of props
- Quantity fields remain always visible and editable

| Field | Source before | Source after |
|-------|-------------|-------------|
| T-Shirts inkl. | `scsShirtsIncluded` prop (disabled) | `localConfig.info_tshirts_included` (editable) |
| T-Shirts qty | `localConfig.info_tshirts_quantity` | No change |
| Minicards inkl. | `minicardOrderEnabled` prop (disabled) | `localConfig.info_minicards_included` (editable) |
| Minicards qty | `localConfig.info_minicards_quantity` | No change |
| Start-Chancen-Schule | `scsShirtsIncluded` prop (disabled) | `localConfig.info_scs` (editable) |
| Plus-Preise | `isPlus` prop (disabled) | `localConfig.info_plus` (editable) |

## 2. Event Detail Page Layout

**Before:**
```
[ Event Overview Card                              ] (full width)
[ Status Banners                                   ] (conditional)
[ Event Config (col-span-3) | Deal Builder (col-span-2) ] (5-col grid)
```

**After:**
```
[ Event Overview Card                              ] (full width, unchanged)
[ Status Banners                                   ] (conditional, unchanged)
[ Event Configuration                              ] (full width card)
[ Deal Builder (50%)       | Admin Notes (50%)     ] (2-col grid)
```

Everything below (Booking Info, Lehrer-Status, Classes & Songs, Activity Timeline) is unchanged.

## 3. Admin Notes — Explicit Save Button

Replace debounced auto-save with an explicit Save Notes button in both locations.

**Behavior:**
- Textarea with local state, no auto-save
- "Save Notes" button enabled only when text differs from last-saved value
- Click triggers `PATCH /api/admin/events/[eventId]` with `{ admin_notes: string }`
- Shows "Saving..." while in flight, resets to disabled on success
- One `notes_updated` activity log entry per save

**Sync between pages:**
- Both pages write to same PATCH endpoint → same Airtable field
- Event detail page fetches fresh data on mount via `GET /api/admin/events/[eventId]`
- Bookings overview SWR has `revalidateOnFocus: true` — refetches on tab/page focus
- No special sync mechanism needed; natural page lifecycle handles it

## Files to Change

1. **`src/components/admin/DealBuilder.tsx`** — Unlock Zusatzinformationen, remove event-level props
2. **`src/app/admin/events/[eventId]/page.tsx`** — Restructure layout grid, add notes textarea + save button, stop passing removed props to DealBuilder
3. **`src/components/admin/bookings/BookingDetailsBreakdown.tsx`** — Replace debounced auto-save with Save Notes button, remove debounce timer/refs
4. **`src/app/admin/bookings/page.tsx`** — Minor: `handleNotesUpdate` callback now triggered by button instead of debounce (no logic change)

**No API or Airtable schema changes needed.**
