# Event Detail Page Layout Redesign

**Date:** 2026-03-16
**Status:** Approved

## Problem

The event detail page header card is overloaded — it contains event info, stats, staff assignment, status, event type toggles, merch override, bulk school orders, the entire deal builder, SchulClothingOrder form, AND the registration progress bar in a single white card that can be 800+ pixels tall.

## Solution

Break the monolithic header card into 3 distinct cards with a responsive grid layout.

## Layout

```
┌─ Card 1: Event Overview (full width) ─────────────────────────┐
│  Row 1: Badge+Date+School+Teacher+Gear     Stats (C, K, P)    │
│  Row 2: Staff dropdown + Status dropdown   Registration bar   │
└────────────────────────────────────────────────────────────────┘

  Schulsong banners (conditional)

┌─ Card 2: Event Config (60%) ──┐  ┌─ Card 3: Deal Summary (40%) ─┐
│  Event Type                    │  │  Preset rows (compact)        │
│  (Off/Minimusikertag/PLUS)     │  │  Gratis Items                 │
│  Kita toggle                   │  │  Custom Fees                  │
│  Schulsong toggle              │  │  Summary total                │
│                                │  │  Save button                  │
│  Standard Merch Override       │  │                               │
│                                │  │                               │
│  Bulk School Orders            │  │                               │
│    SCS Shirts toggle           │  │                               │
│    Minicard Order + qty        │  │                               │
│                                │  │                               │
│  SchulClothingOrder (if SCS)   │  │                               │
└────────────────────────────────┘  └───────────────────────────────┘

  Booking Info (conditional)
  Classes & Songs
  Collections
  Admin Notes
  Activity Timeline
```

## Card Details

### Card 1: Event Overview
- Row 1: Event badge, clickable date, school name, teacher name, settings gear icon (left) + stats pills (right)
- Row 2: Staff assignment dropdown + event status dropdown side-by-side (left) + registration progress bar (right)
- Compact — 2 rows max

### Card 2: Event Configuration
- Event Type: Off/Minimusikertag/PLUS segmented control + Kita toggle + Schulsong toggle
- Standard Merch Override: Auto/Standard/Personalized segmented control
- Bulk School Orders: SCS Shirts toggle + Minicard Order toggle with quantity input
- SchulClothingOrder form: conditional, appears when SCS Shirts enabled

### Card 3: Deal Summary
- Always expanded (no collapse/toggle needed)
- Preset cost rows (compact)
- Gratis items section
- Custom fees section
- Summary total
- Save button
- Remove duplicate "Bulk School Orders" read-only display (already in Card 2)

### Responsive Behavior
- Desktop (`lg+`): Cards 2 + 3 side-by-side in `lg:grid-cols-5` — Card 2 = `col-span-3`, Card 3 = `col-span-2`
- Mobile (`< lg`): All cards stack vertically

## Changes Required

1. Split the header card JSX into 3 separate `<div>` cards
2. Move status dropdown from the "Event Status & Type Section" up into Card 1
3. Remove duplicate Bulk School Orders read-only display from DealBuilder component
4. Add the grid wrapper for Cards 2 + 3
5. Compact Card 1 layout (2 rows instead of 3 sections with dividers)
