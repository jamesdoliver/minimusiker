# Triple-State Tier Switch Design

**Date:** 2026-02-16
**Status:** Approved

## Problem

The current two-sided segmented control (Minimusikertag / PLUS) forces every event to have one of those tiers active. Events that are Schulsong-only cannot be represented because `handleTierSwitch` always sets `is_minimusikertag = !is_plus`.

## Solution

Add a third "Off" state to the left of the existing segmented control:

```
[ — ] [ M ] [ + ]
```

| State | Label | Style | is_minimusikertag | is_plus |
|-------|-------|-------|-------------------|---------|
| Off | `—` | Gray | false | false |
| Minimusikertag | `M` | Green | true | false |
| PLUS | `+` | Blue | false | true |

Schulsong and Kita toggles remain independent and unchanged.

## Scope

**Single file change:** `src/app/admin/events/[eventId]/page.tsx`

1. `handleTierSwitch(boolean)` becomes `handleTierSwitch('off' | 'minimusikertag' | 'plus')`
2. Segmented control gains a third "Off" button
3. Current tier derived as: `isPlus ? 'plus' : isMinimusikertag ? 'minimusikertag' : 'off'`

**No changes to:** Airtable schema, API routes, EventTypeCircles, Schulsong/Kita toggles.
