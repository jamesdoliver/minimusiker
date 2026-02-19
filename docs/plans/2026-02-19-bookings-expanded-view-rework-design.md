# Bookings Expanded View Rework

**Date:** 2026-02-19
**Branch:** bookings_rework
**Status:** Design

## Overview

Rework the admin bookings expanded row view into a structured 3-column layout with a working activity log. The current expanded view has scattered data, a broken activity log (data not writing to Airtable), and manual call history hacked into the notes field. This rework consolidates information, gives notes more space, and surfaces a proper activity timeline with manual entry support.

## Layout Structure

The expanded booking card has three vertical sections stacked top to bottom:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Information            │  Notes                │  Activity Log     │
│                         │                       │                   │
│  Contact Person         │  ┌─────────────────┐  │  [+ Call][+ Email]│
│  Email (mailto)         │  │                 │  │                   │
│  Phone (tel)            │  │  Auto-save      │  │  ● Status changed │
│  Address                │  │  textarea        │  │    Admin · 2h ago │
│  Region & Team          │  │                 │  │                   │
│  Booking Code           │  │                 │  │  ● Call 'School'  │
│  Discount Code (copy)   │  │                 │  │    Admin · 1d ago │
│  Time                   │  │                 │  │                   │
│  [Copy QR Link]         │  │                 │  │  ● Event created  │
│                         │  └─────────────────┘  │    System · 5d ago│
│                         │  Saving... / Saved    │                   │
├─────────────────────────┴───────────────────────┴───────────────────┤
│  Audio Setup                                                        │
├─────────────────────────────────────────────────────────────────────┤
│  [Delete] [Edit] [Refresh] [Confirm Printables] [Order] [View]     │
└─────────────────────────────────────────────────────────────────────┘
```

## Column 1: Information (Left)

A simple vertical list of label-value pairs. Read-only display.

| Field | Source | Behavior |
|-------|--------|----------|
| Contact Person | `booking.contactPerson` | Plain text |
| Email | `booking.contactEmail` | Clickable mailto link |
| Phone | `booking.phone` | Clickable tel link |
| Address | `booking.address`, `booking.postalCode`, `booking.city` | Single line |
| Region & Team | `booking.region`, `booking.assignedStaffNames` | Region + staff names |
| Booking Code | `booking.code` | Monospace font |
| Discount Code | `booking.discountCode` | Monospace font, small copy button |
| Time | `booking.startTime` – `booking.endTime` | Formatted time range |
| Copy QR Link | `booking.shortUrl` | Button, copies `https://{shortUrl}` to clipboard with "Copied!" feedback |

No QR code image. No download button. Just the copy button.

## Column 2: Notes (Middle)

A single tall textarea filling the column height.

- **Auto-save with debounce:** 1000ms after user stops typing
- **API:** `PATCH /api/admin/events/[eventId]` with `{ admin_notes: value }`
- **Save status:** Small text below textarea — "Saving..." / "Saved"
- **No Lead History parsing:** The `--- Lead History ---` separator logic is removed. Notes become pure freeform text.
- **Height:** Fills available column height to match sibling columns

Same implementation as current `handleNotesChange` with `notesTimerRef` debounce pattern.

## Column 3: Activity Log (Right)

An independently scrollable timeline container with fixed max-height matching the other columns. Most recent entries at the top.

### Entry Display

Each timeline entry shows:
- Colored icon/emoji based on activity type (existing mapping from `EventActivityTimeline.tsx`)
- Description text
- Actor badge (Admin / Teacher / System)
- Relative timestamp ("2 hours ago", "Yesterday", etc.)

### Manual Entry Buttons

Two small buttons at the top of the column:
- **"+ Call"** — opens inline text input for description, saves as `phone_call` type
- **"+ Email"** — opens inline text input for description, saves as `email_discussion` type

Display format:
- Phone call: "Call 'School Name': description"
- Email discussion: "Email 'School Name': description"

### Scrolling

- Fixed max-height container with `overflow-y: auto`
- Pagination via "Load more" at the bottom (existing pattern)
- Default 20 entries per page

## Activity Types

### Complete List (20 types)

**Automatic (system-tracked):**

| Type | Trigger | Logged By |
|------|---------|-----------|
| `event_created` | Event creation | System |
| `event_deleted` | Event deletion | Admin |
| `date_changed` | Admin changes event date | Admin |
| `staff_assigned` | Staff assigned to event | Admin |
| `staff_unassigned` | Staff removed from event | Admin |
| `class_added` | Class created | Admin / Teacher |
| `class_updated` | Class modified | Admin / Teacher |
| `class_deleted` | Class removed | Admin / Teacher |
| `group_created` | Group created | Admin |
| `group_updated` | Group modified | Admin |
| `group_deleted` | Group removed | Admin |
| `song_added` | Song added | Admin / Teacher |
| `song_updated` | Song modified | Admin / Teacher |
| `song_deleted` | Song removed | Admin / Teacher |
| `tasks_generated` | Task generation triggered | Admin / System |
| `booking_status_changed` | Status transition | Admin / System |
| `audio_uploaded` | Audio file uploaded | Teacher |
| `email_sent` | System email sent | System |

**Manual (admin-entered):**

| Type | Trigger | Display Format |
|------|---------|----------------|
| `phone_call` | Admin clicks "+ Call" | "Call 'School Name': description" |
| `email_discussion` | Admin clicks "+ Email" | "Email 'School Name': description" |

### New Activity Types to Add

These 4 types need to be added to:
- `EventActivityType` union type in `src/lib/types/airtable.ts`
- `activityConfig` mapping in `EventActivityTimeline.tsx`
- Airtable EVENT_ACTIVITY table `activity_type` single-select field

| New Type | Icon | Color |
|----------|------|-------|
| `phone_call` | Phone icon | blue |
| `email_discussion` | Mail icon | blue |
| `audio_uploaded` | Music/mic icon | purple |
| `email_sent` | Mail icon | green |

## Audio Setup Section

Same as current implementation. No changes. Rendered below the three columns.

## Action Buttons Row

Same buttons as current expanded view, rendered below the audio section:
- Delete
- Edit
- Refresh
- Confirm Printables
- Order Overview
- View Event Details

**Style change:** Smaller, more compact. Reduced font size and padding.

## Bug Fix: Activity Logging Not Writing

The existing `logActivity()` calls across 14 API routes are not writing records to Airtable. This needs investigation and repair before the activity log can display any data.

Investigation areas:
- Airtable API authentication for EVENT_ACTIVITY table
- Field ID mappings in `EVENT_ACTIVITY_FIELD_IDS`
- Linked record format for `event_id` field
- Fire-and-forget error swallowing (errors may be silently caught)

## Data Migration: Lead History

A one-time migration script to:

1. Query all Event records where `admin_notes` contains `--- Lead History ---`
2. Parse each call entry: `[Call N - DATE]\nDescription`
3. Create `phone_call` activity records in EVENT_ACTIVITY table with:
   - Original date preserved in `created_at` (or metadata if Airtable auto-sets created_at)
   - Description formatted as "Call 'School Name': description"
   - Actor type: `admin`
4. Strip the `--- Lead History ---` section from the admin_notes field
5. Log results (migrated count, errors)

## New API Endpoint

### POST /api/admin/events/[eventId]/activity

Creates manual activity log entries (phone_call, email_discussion).

**Request body:**
```json
{
  "activityType": "phone_call" | "email_discussion",
  "description": "Discussed rescheduling to March"
}
```

**Behavior:**
- Requires admin authentication
- Resolves event record ID from eventId parameter
- Calls `logActivity()` with actor from admin session
- Returns created activity record

## Integration Points for New Logging

### audio_uploaded
Hook into the audio upload API endpoint to log when a teacher uploads audio.

### email_sent
Hook into email sending utilities/endpoints to log when system emails are dispatched (confirmation emails, reminders, etc.).

## Files to Modify

| File | Change |
|------|--------|
| `src/components/admin/bookings/BookingDetailsBreakdown.tsx` | Rewrite layout: 3 columns, remove QR image, remove Lead History, compact buttons |
| `src/components/admin/EventActivityTimeline.tsx` | Adapt for embedded use in card, add manual entry UI |
| `src/lib/types/airtable.ts` | Add 4 new activity types to `EventActivityType` |
| `src/lib/services/activityService.ts` | Fix broken logging, add new type descriptions |
| `src/app/api/admin/events/[eventId]/activity/route.ts` | Add POST handler for manual entries |
| Audio upload API route(s) | Add `audio_uploaded` logging |
| Email sending utilities | Add `email_sent` logging |

## Files to Create

| File | Purpose |
|------|---------|
| `scripts/migrate-lead-history.ts` | One-time migration of Lead History to activity log |
