# Leads CRM / Sales Pipeline Design

**Date:** 2026-02-13
**Status:** Approved

## Overview

Build a "Leads" view as a mini CRM/sales pipeline for tracking incoming leads before they become confirmed bookings. Leads are managed separately from bookings, with their own pipeline stages, call-based notes, follow-up reminders, and estimated dates. When a deal is closed, the lead is converted into a confirmed booking via the existing Create Booking flow, carrying all notes and context forward.

## Goals

- Allow sales users to track incoming leads through a pipeline
- Capture call notes chronologically across multiple conversations
- Set follow-up reminders with email notifications
- Convert leads to bookings seamlessly, retaining all context
- Auto-link or auto-create Einrichtung (institution) records

## Data Model

### New Airtable Table: "Leads"

| Field | Type | Notes |
|-------|------|-------|
| lead_id | Formula/Auto | Unique identifier (L-xxx format) |
| school_name | Text | Required |
| contact_person | Text | Required |
| contact_email | Email | At least one of email/phone required |
| contact_phone | Phone | At least one of email/phone required |
| address | Text | Optional |
| postal_code | Text | Optional |
| city | Text | Optional |
| region | Link to Regionen | Optional |
| estimated_children | Number | Optional |
| event_type_interest | Multi-select | Minimusikertag / Plus / Kita / Schulsong |
| lead_source | Single select | Inbound Call / Outbound Call / Website / Referral / Repeat Customer / Event-Fair / Other |
| stage | Single select | New / Contacted / In Discussion / Won / Lost |
| lost_reason | Text | Only populated when stage = Lost |
| schulsong_upsell | Checkbox | Toggle |
| scs_funded | Checkbox | Toggle |
| einrichtung | Link to Einrichtungen | Auto-linked or auto-created |
| assigned_staff | Link to Personen | Sales owner |
| call_notes | Long text (JSON) | Array of {callNumber, date, notes} |
| next_follow_up | Date | Next follow-up reminder date |
| estimated_date | Date | Specific estimated event date (when known) |
| estimated_month | Text | Month-only estimate, format "2026-06" (when specific date not known) |
| created_at | Created time | Auto |
| updated_at | Last modified | Auto |
| converted_booking_id | Link to SchoolBookings | Set when converted to booking |

### CallNote JSON Structure

```json
[
  { "callNumber": 1, "date": "2026-02-13", "notes": "Initial call, interested in June event..." },
  { "callNumber": 2, "date": "2026-02-18", "notes": "Follow-up, confirmed 120 children..." }
]
```

## Pipeline Stages

| Stage | Colour | Description |
|-------|--------|-------------|
| New | Blue | Lead just came in, hasn't been contacted |
| Contacted | Yellow | Initial outreach made (call/email) |
| In Discussion | Orange | Active back-and-forth, negotiating details |
| Won | Green | Deal closed, triggers conversion flow |
| Lost | Red/Grey | Didn't work out (reason captured) |

## Page Layout

**Route:** `/admin/leads` — added to admin sidebar between "Bookings" and "Tasks".

```
LeadsPage
├── Header ("Leads" + count + "Create Lead" button)
├── Filter Bar
│   ├── Stage toggles: New / Contacted / In Discussion / Won / Lost
│   ├── Source dropdown filter
│   ├── Staff/owner dropdown filter
│   └── Text search (school name, contact name)
├── LeadsTable
│   ├── Columns: School Name | Contact | Phone | Stage | Source | Follow-Up | Created
│   ├── Expandable rows (same chevron pattern as bookings)
│   └── LeadDetailsBreakdown (expanded view)
│       ├── Contact Information card
│       ├── Location card
│       ├── Lead Details card (source, event interest, sliders, estimated children, estimated date)
│       ├── Call Notes section
│       │   ├── Call 1 (always visible on creation)
│       │   ├── Call 2, 3... (shown as added, older calls collapsible)
│       │   └── "+ Add Call" button
│       ├── Next Follow-Up date picker (below call notes)
│       ├── Stage selector (dropdown to move through pipeline)
│       └── Action buttons
│           ├── "Convert to Booking" (visible when stage allows)
│           └── "Mark as Lost" (opens reason input)
└── CreateLeadModal
```

### Sorting

Leads are sorted by priority:
1. Overdue follow-ups first (red highlight)
2. Follow-ups today
3. Follow-ups this week
4. Then by last updated (most recent first)

Won/Lost leads are greyed out and sorted to the bottom.

### Stage Badge Colours

Follow the existing StatusCircle pattern:
- New — Blue circle
- Contacted — Yellow circle
- In Discussion — Orange circle
- Won — Green circle
- Lost — Red/grey circle

## Create Lead Modal

### Fields

**Required:**
- School/Institution Name
- Contact Person Name
- Phone or Email (at least one)

**Optional:**
- Contact Email (if phone provided as required)
- Contact Phone (if email provided as required)
- Address / Postal Code / City
- Region (dropdown)
- Estimated Children (number)
- Lead Source (dropdown)
- Event Type Interest (multi-select checkboxes)
- Schulsong Upsell (toggle/slider)
- SCS Funded (toggle/slider)
- Estimated Date (date picker with month-only mode toggle)
- Initial Notes (pre-populates Call 1)

On creation:
- Stage defaults to "New"
- Call 1 is auto-created (with initial notes if provided, otherwise empty)
- Einrichtung is auto-linked if school name matches existing record, otherwise a new Einrichtung is created

## Call Notes

- **Call 1** is always present when a lead is created
- Each call entry shows: "Call X" header, date (auto-set to today, editable), textarea for notes
- **"+ Add Call"** button appends the next numbered call entry
- Notes auto-save on 1-second debounce (same pattern as existing admin notes)
- Calls displayed chronologically, most recent at bottom
- Older calls collapse to a single line showing date + first ~50 chars of notes
- Stored as JSON array in a long text Airtable field

## Follow-Up Reminders

- **"Next Follow-Up"** date picker sits below call notes section
- A small badge on the lead row shows the follow-up date (e.g. "Follow-up: 15 Mar")
- Daily cron/scheduled function queries leads where `next_follow_up = today`
- Sends reminder email to assigned staff member with lead summary and link to `/admin/leads`
- Uses existing email template system with new `lead-follow-up-reminder` template

## Estimated Event Date

- Two modes via toggle:
  - **Specific date** — standard date picker
  - **Month only** — month + year dropdown (e.g. "June 2026")
- Purely informational during lead phase
- On conversion: specific date pre-fills event date in Create Booking modal; month-only shows as a prompt note but leaves date field empty

## Conversion Flow (Lead → Booking)

When the sales person clicks **"Convert to Booking"**:

1. Lead stage moves to **"Won"**
2. The existing **CreateBookingModal** opens, pre-filled with:
   - School name, contact person, email, phone
   - Address, postal code, city, region
   - Estimated children
   - Event type (from interest field)
   - Schulsong upsell & SCS funded toggles
   - Event date (if specific estimated date was set)
3. Sales person reviews, fills in remaining fields (event date/times if needed), and confirms
4. On booking creation:
   - Lead record gets `converted_booking_id` linked to the new SchoolBooking
   - Call notes are copied to the booking record
   - Einrichtung link carries over
5. Lead remains in table as "Won" (greyed out, for pipeline reporting)

## Lead History on Bookings

In the existing booking expanded view (`BookingDetailsBreakdown`), a new **"Lead History"** card appears below the Admin Notes section:
- Shows call notes as a read-only chronological timeline
- Each entry shows "Call X" header, date, and notes
- Only displayed for bookings that were created via lead conversion

## Lead Sources

| Value | Description |
|-------|-------------|
| Inbound Call | They called us |
| Outbound Call | We called them (cold/warm outreach) |
| Website | Came through the website |
| Referral | Recommended by another school |
| Repeat Customer | Existing school, new booking |
| Event/Fair | Met at an event |
| Other | Free text available |

## Files to Create

| File | Purpose |
|------|---------|
| `src/app/admin/leads/page.tsx` | Main leads page with filters & table |
| `src/app/api/admin/leads/route.ts` | GET (list) and POST (create) endpoints |
| `src/app/api/admin/leads/[leadId]/route.ts` | PATCH (update) and DELETE endpoints |
| `src/app/api/admin/leads/[leadId]/convert/route.ts` | Conversion endpoint — marks Won, returns pre-fill data |
| `src/components/admin/leads/CreateLeadModal.tsx` | Create lead form |
| `src/components/admin/leads/LeadDetailsBreakdown.tsx` | Expanded row content |
| `src/components/admin/leads/CallNotes.tsx` | Call notes component with add/collapse |
| `src/components/admin/leads/LeadStageSelector.tsx` | Pipeline stage dropdown |
| `src/components/admin/leads/LeadStageBadge.tsx` | Coloured stage badges for table rows |

## Files to Modify

| File | Change |
|------|--------|
| `src/app/admin/layout.tsx` | Add "Leads" to sidebar navigation |
| `src/lib/services/airtableService.ts` | Add leads table methods (CRUD, Einrichtung auto-link/create) |
| `src/lib/types/airtable.ts` | Add Lead interface, CallNote type, LeadStage type |
| `src/components/admin/bookings/CreateBookingModal.tsx` | Accept optional `prefillData` prop for conversion flow |
| `src/app/admin/bookings/page.tsx` | Add "Lead History" card to BookingDetailsBreakdown |
| `src/app/api/admin/bookings/route.ts` | Store lead call notes on booking when created via conversion |

## Airtable Setup (Manual)

1. Create new "Leads" table with all fields from data model section
2. Create link field to Einrichtungen table
3. Create link field to Personen table (for assigned staff)
4. Create link field to SchoolBookings table (for converted_booking_id)
5. Add field IDs to environment config / constants file
