# Leads CRM Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a sales pipeline view at `/admin/leads` for tracking prospective bookings from first contact through to conversion into confirmed bookings.

**Architecture:** New Airtable "Leads" table (already created) with CRUD API routes, a page mirroring the bookings page pattern (filters + expandable table), and a conversion flow that pre-fills the existing CreateBookingModal. Call notes stored as JSON, auto-saved with debounce.

**Tech Stack:** Next.js App Router, Airtable REST API via `airtable` npm package, Tailwind CSS, Sonner toasts, existing auth via `verifyAdminSession`.

**Reference:** Design doc at `docs/plans/2026-02-13-leads-crm-design.md`. Types already added to `src/lib/types/airtable.ts` (LEADS_TABLE_ID, LEADS_FIELD_IDS, Lead, CallNote, LeadStage, etc.).

---

## Task 1: Airtable Service — Leads CRUD Methods

**Files:**
- Modify: `src/lib/services/airtableService.ts`

**What to build:** Add methods to the existing AirtableService class for leads operations. Follow the existing patterns exactly (returnFieldsByFieldId, transform methods, error handling).

**Step 1: Add the transform method and getAllLeads()**

Add to `airtableService.ts` inside the class, after the Einrichtungen section:

```typescript
// ==================== Leads Management ====================

private transformLeadRecord(record: Airtable.Record<FieldSet>): Lead {
  const callNotesRaw = record.fields[LEADS_FIELD_IDS.call_notes] as string | undefined;
  let callNotes: CallNote[] = [];
  try {
    if (callNotesRaw) callNotes = JSON.parse(callNotesRaw);
  } catch { /* default to empty array */ }

  return {
    id: record.id,
    schoolName: (record.fields[LEADS_FIELD_IDS.school_name] as string) || '',
    contactPerson: (record.fields[LEADS_FIELD_IDS.contact_person] as string) || '',
    contactEmail: record.fields[LEADS_FIELD_IDS.contact_email] as string | undefined,
    contactPhone: record.fields[LEADS_FIELD_IDS.contact_phone] as string | undefined,
    address: record.fields[LEADS_FIELD_IDS.address] as string | undefined,
    postalCode: record.fields[LEADS_FIELD_IDS.postal_code] as string | undefined,
    city: record.fields[LEADS_FIELD_IDS.city] as string | undefined,
    regionId: ((record.fields[LEADS_FIELD_IDS.region] as string[]) || [])[0] || undefined,
    estimatedChildren: record.fields[LEADS_FIELD_IDS.estimated_children] as number | undefined,
    eventTypeInterest: record.fields[LEADS_FIELD_IDS.event_type_interest] as EventTypeInterest[] | undefined,
    leadSource: record.fields[LEADS_FIELD_IDS.lead_source] as LeadSource | undefined,
    stage: (record.fields[LEADS_FIELD_IDS.stage] as LeadStage) || 'New',
    lostReason: record.fields[LEADS_FIELD_IDS.lost_reason] as string | undefined,
    schulsongUpsell: record.fields[LEADS_FIELD_IDS.schulsong_upsell] as boolean | undefined,
    scsFunded: record.fields[LEADS_FIELD_IDS.scs_funded] as boolean | undefined,
    einrichtungId: ((record.fields[LEADS_FIELD_IDS.einrichtung] as string[]) || [])[0] || undefined,
    assignedStaffId: ((record.fields[LEADS_FIELD_IDS.assigned_staff] as string[]) || [])[0] || undefined,
    callNotes,
    nextFollowUp: record.fields[LEADS_FIELD_IDS.next_follow_up] as string | undefined,
    estimatedDate: record.fields[LEADS_FIELD_IDS.estimated_date] as string | undefined,
    estimatedMonth: record.fields[LEADS_FIELD_IDS.estimated_month] as string | undefined,
    convertedBookingId: ((record.fields[LEADS_FIELD_IDS.converted_booking_id] as string[]) || [])[0] || undefined,
    createdAt: '', // Airtable auto-populates; not stored via field ID
    updatedAt: '', // Airtable auto-populates; not stored via field ID
  };
}

async getAllLeads(): Promise<Lead[]> {
  try {
    const allRecords = await this.base(LEADS_TABLE_ID)
      .select({
        pageSize: 100,
        returnFieldsByFieldId: true,
      })
      .all();

    return allRecords.map((record) => this.transformLeadRecord(record));
  } catch (error) {
    console.error('Error fetching all leads:', error);
    throw new Error(`Failed to fetch all leads: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

Add the necessary imports at the top of the file — `Lead`, `CallNote`, `LeadStage`, `LeadSource`, `EventTypeInterest`, `LEADS_TABLE_ID`, `LEADS_FIELD_IDS` from `@/lib/types/airtable`.

**Step 2: Add createLead() method**

```typescript
async createLead(data: {
  schoolName: string;
  contactPerson: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  regionId?: string;
  estimatedChildren?: number;
  eventTypeInterest?: EventTypeInterest[];
  leadSource?: LeadSource;
  schulsongUpsell?: boolean;
  scsFunded?: boolean;
  assignedStaffId?: string;
  initialNotes?: string;
  estimatedDate?: string;
  estimatedMonth?: string;
}): Promise<Lead> {
  try {
    // Build initial call note
    const callNotes: CallNote[] = [{
      callNumber: 1,
      date: new Date().toISOString().split('T')[0],
      notes: data.initialNotes || '',
    }];

    const fields: Record<string, unknown> = {
      [LEADS_FIELD_IDS.school_name]: data.schoolName,
      [LEADS_FIELD_IDS.contact_person]: data.contactPerson,
      [LEADS_FIELD_IDS.stage]: 'New',
      [LEADS_FIELD_IDS.call_notes]: JSON.stringify(callNotes),
    };

    if (data.contactEmail) fields[LEADS_FIELD_IDS.contact_email] = data.contactEmail;
    if (data.contactPhone) fields[LEADS_FIELD_IDS.contact_phone] = data.contactPhone;
    if (data.address) fields[LEADS_FIELD_IDS.address] = data.address;
    if (data.postalCode) fields[LEADS_FIELD_IDS.postal_code] = data.postalCode;
    if (data.city) fields[LEADS_FIELD_IDS.city] = data.city;
    if (data.regionId) fields[LEADS_FIELD_IDS.region] = [data.regionId];
    if (data.estimatedChildren) fields[LEADS_FIELD_IDS.estimated_children] = data.estimatedChildren;
    if (data.eventTypeInterest?.length) fields[LEADS_FIELD_IDS.event_type_interest] = data.eventTypeInterest;
    if (data.leadSource) fields[LEADS_FIELD_IDS.lead_source] = data.leadSource;
    if (data.schulsongUpsell) fields[LEADS_FIELD_IDS.schulsong_upsell] = true;
    if (data.scsFunded) fields[LEADS_FIELD_IDS.scs_funded] = true;
    if (data.assignedStaffId) fields[LEADS_FIELD_IDS.assigned_staff] = [data.assignedStaffId];
    if (data.estimatedDate) fields[LEADS_FIELD_IDS.estimated_date] = data.estimatedDate;
    if (data.estimatedMonth) fields[LEADS_FIELD_IDS.estimated_month] = data.estimatedMonth;

    // Find or create Einrichtung
    const einrichtung = await this.findOrCreateEinrichtung(
      data.schoolName,
      data.contactEmail || 'admin@minimusiker.de'
    );
    fields[LEADS_FIELD_IDS.einrichtung] = [einrichtung.id];

    const record = await this.base(LEADS_TABLE_ID).create(fields);
    return this.transformLeadRecord(record);
  } catch (error) {
    console.error('Error creating lead:', error);
    throw new Error(`Failed to create lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

**Step 3: Add updateLead() method**

```typescript
async updateLead(leadId: string, data: {
  schoolName?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  regionId?: string;
  estimatedChildren?: number;
  eventTypeInterest?: EventTypeInterest[];
  leadSource?: LeadSource;
  stage?: LeadStage;
  lostReason?: string;
  schulsongUpsell?: boolean;
  scsFunded?: boolean;
  assignedStaffId?: string;
  callNotes?: CallNote[];
  nextFollowUp?: string | null;
  estimatedDate?: string | null;
  estimatedMonth?: string | null;
  convertedBookingId?: string;
}): Promise<Lead> {
  try {
    const fields: Record<string, unknown> = {};

    if (data.schoolName !== undefined) fields[LEADS_FIELD_IDS.school_name] = data.schoolName;
    if (data.contactPerson !== undefined) fields[LEADS_FIELD_IDS.contact_person] = data.contactPerson;
    if (data.contactEmail !== undefined) fields[LEADS_FIELD_IDS.contact_email] = data.contactEmail;
    if (data.contactPhone !== undefined) fields[LEADS_FIELD_IDS.contact_phone] = data.contactPhone;
    if (data.address !== undefined) fields[LEADS_FIELD_IDS.address] = data.address;
    if (data.postalCode !== undefined) fields[LEADS_FIELD_IDS.postal_code] = data.postalCode;
    if (data.city !== undefined) fields[LEADS_FIELD_IDS.city] = data.city;
    if (data.regionId !== undefined) fields[LEADS_FIELD_IDS.region] = data.regionId ? [data.regionId] : [];
    if (data.estimatedChildren !== undefined) fields[LEADS_FIELD_IDS.estimated_children] = data.estimatedChildren;
    if (data.eventTypeInterest !== undefined) fields[LEADS_FIELD_IDS.event_type_interest] = data.eventTypeInterest;
    if (data.leadSource !== undefined) fields[LEADS_FIELD_IDS.lead_source] = data.leadSource;
    if (data.stage !== undefined) fields[LEADS_FIELD_IDS.stage] = data.stage;
    if (data.lostReason !== undefined) fields[LEADS_FIELD_IDS.lost_reason] = data.lostReason;
    if (data.schulsongUpsell !== undefined) fields[LEADS_FIELD_IDS.schulsong_upsell] = data.schulsongUpsell;
    if (data.scsFunded !== undefined) fields[LEADS_FIELD_IDS.scs_funded] = data.scsFunded;
    if (data.assignedStaffId !== undefined) fields[LEADS_FIELD_IDS.assigned_staff] = data.assignedStaffId ? [data.assignedStaffId] : [];
    if (data.callNotes !== undefined) fields[LEADS_FIELD_IDS.call_notes] = JSON.stringify(data.callNotes);
    if (data.nextFollowUp !== undefined) fields[LEADS_FIELD_IDS.next_follow_up] = data.nextFollowUp;
    if (data.estimatedDate !== undefined) fields[LEADS_FIELD_IDS.estimated_date] = data.estimatedDate;
    if (data.estimatedMonth !== undefined) fields[LEADS_FIELD_IDS.estimated_month] = data.estimatedMonth;
    if (data.convertedBookingId !== undefined) fields[LEADS_FIELD_IDS.converted_booking_id] = [data.convertedBookingId];

    const record = await this.base(LEADS_TABLE_ID).update(leadId, fields);
    return this.transformLeadRecord(record);
  } catch (error) {
    console.error('Error updating lead:', error);
    throw new Error(`Failed to update lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

**Step 4: Add deleteLead() method**

```typescript
async deleteLead(leadId: string): Promise<void> {
  try {
    await this.base(LEADS_TABLE_ID).destroy(leadId);
  } catch (error) {
    console.error('Error deleting lead:', error);
    throw new Error(`Failed to delete lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

**Step 5: Verify build passes**

Run: `npx next build 2>&1 | head -30`
Expected: No type errors related to leads

**Step 6: Commit**

```
feat: add leads CRUD methods to airtable service
```

---

## Task 2: API Routes — GET and POST Leads

**Files:**
- Create: `src/app/api/admin/leads/route.ts`

**What to build:** GET endpoint to list all leads with staff/region lists, POST endpoint to create a new lead. Follow the exact pattern from `src/app/api/admin/bookings/route.ts`.

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';
import type { Lead, LeadStage } from '@/lib/types/airtable';

export const dynamic = 'force-dynamic';

export interface LeadWithStaffName extends Lead {
  assignedStaffName?: string;
}

export interface StaffOption {
  id: string;
  name: string;
}

export interface RegionOption {
  id: string;
  name: string;
}

export async function GET(request: NextRequest) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const airtableService = getAirtableService();

    const [leads, staffList, regionList] = await Promise.all([
      airtableService.getAllLeads(),
      airtableService.getAllStaffMembers(),
      airtableService.getAllRegions(),
    ]);

    // Enrich leads with staff names
    const staffMap = new Map(staffList.map(s => [s.id, s.name]));
    const enrichedLeads: LeadWithStaffName[] = leads.map(lead => ({
      ...lead,
      assignedStaffName: lead.assignedStaffId ? staffMap.get(lead.assignedStaffId) : undefined,
    }));

    return NextResponse.json({
      success: true,
      data: {
        leads: enrichedLeads,
        staffList,
        regionList,
      },
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const { schoolName, contactPerson, contactEmail, contactPhone } = body;
    if (!schoolName?.trim() || !contactPerson?.trim()) {
      return NextResponse.json(
        { success: false, error: 'School name and contact person are required' },
        { status: 400 }
      );
    }
    if (!contactEmail?.trim() && !contactPhone?.trim()) {
      return NextResponse.json(
        { success: false, error: 'At least one of email or phone is required' },
        { status: 400 }
      );
    }

    const airtableService = getAirtableService();
    const lead = await airtableService.createLead({
      schoolName: schoolName.trim(),
      contactPerson: contactPerson.trim(),
      contactEmail: contactEmail?.trim() || undefined,
      contactPhone: contactPhone?.trim() || undefined,
      address: body.address?.trim() || undefined,
      postalCode: body.postalCode?.trim() || undefined,
      city: body.city?.trim() || undefined,
      regionId: body.regionId || undefined,
      estimatedChildren: body.estimatedChildren ? Number(body.estimatedChildren) : undefined,
      eventTypeInterest: body.eventTypeInterest || undefined,
      leadSource: body.leadSource || undefined,
      schulsongUpsell: body.schulsongUpsell || false,
      scsFunded: body.scsFunded || false,
      assignedStaffId: body.assignedStaffId || undefined,
      initialNotes: body.initialNotes?.trim() || undefined,
      estimatedDate: body.estimatedDate || undefined,
      estimatedMonth: body.estimatedMonth || undefined,
    });

    return NextResponse.json({ success: true, data: lead });
  } catch (error) {
    console.error('Error creating lead:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create lead' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify build passes**

Run: `npx next build 2>&1 | head -30`

**Step 3: Commit**

```
feat: add leads API routes (GET list, POST create)
```

---

## Task 3: API Routes — PATCH and DELETE Lead

**Files:**
- Create: `src/app/api/admin/leads/[leadId]/route.ts`

**What to build:** PATCH for updating any lead fields (stage changes, call notes, follow-up dates, etc.), DELETE for removing leads.

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { leadId } = await params;
    const body = await request.json();
    const airtableService = getAirtableService();
    const lead = await airtableService.updateLead(leadId, body);

    return NextResponse.json({ success: true, data: lead });
  } catch (error) {
    console.error('Error updating lead:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update lead' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { leadId } = await params;
    const airtableService = getAirtableService();
    await airtableService.deleteLead(leadId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting lead:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete lead' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify build passes, then commit**

```
feat: add leads PATCH/DELETE API routes
```

---

## Task 4: API Route — Convert Lead to Booking

**Files:**
- Create: `src/app/api/admin/leads/[leadId]/convert/route.ts`

**What to build:** POST endpoint that marks the lead as "Won" and returns pre-fill data for the CreateBookingModal.

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { leadId } = await params;
    const airtableService = getAirtableService();

    // Update lead stage to Won
    const lead = await airtableService.updateLead(leadId, { stage: 'Won' });

    // Return pre-fill data for CreateBookingModal
    const prefillData = {
      leadId: lead.id,
      schoolName: lead.schoolName,
      contactName: lead.contactPerson,
      contactEmail: lead.contactEmail || '',
      phone: lead.contactPhone || '',
      address: lead.address || '',
      postalCode: lead.postalCode || '',
      city: lead.city || '',
      regionId: lead.regionId || '',
      estimatedChildren: lead.estimatedChildren?.toString() || '',
      eventDate: lead.estimatedDate || '',
      callNotes: lead.callNotes,
      // Event type flags derived from eventTypeInterest
      isMinimusikertag: lead.eventTypeInterest?.includes('Minimusikertag') || false,
      isPlus: lead.eventTypeInterest?.includes('Plus') || false,
      isKita: lead.eventTypeInterest?.includes('Kita') || false,
      isSchulsong: lead.eventTypeInterest?.includes('Schulsong') || false,
      schulsongUpsell: lead.schulsongUpsell || false,
      scsFunded: lead.scsFunded || false,
    };

    return NextResponse.json({ success: true, data: prefillData });
  } catch (error) {
    console.error('Error converting lead:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to convert lead' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify build passes, then commit**

```
feat: add lead conversion API route
```

---

## Task 5: Navigation — Add Leads to Sidebar

**Files:**
- Modify: `src/app/admin/layout.tsx`

**What to build:** Add "Leads" nav item between "Bookings" and "Tasks".

**Step 1: Add the nav item**

Find the `navigation` array in `layout.tsx` and add:

```typescript
{ name: 'Leads', href: '/admin/leads', icon: '🎯' },
```

Insert it after the "Bookings" entry and before "Tasks".

**Step 2: Verify build passes, then commit**

```
feat: add leads to admin sidebar navigation
```

---

## Task 6: CreateLeadModal Component

**Files:**
- Create: `src/components/admin/leads/CreateLeadModal.tsx`

**What to build:** Modal form for creating new leads. Follow the exact CreateBookingModal pattern (fixed header/footer, scrollable content, validation, toast notifications). Fields grouped into sections: Contact Info, Location, Lead Details.

Key behaviours:
- School Name, Contact Person required
- At least one of Email or Phone required
- Lead Source dropdown, Event Type Interest checkboxes
- Schulsong Upsell and SCS Funded toggle switches
- Estimated Date with specific date / month-only toggle
- Initial Notes textarea (pre-populates Call 1)
- On submit: POST to `/api/admin/leads`, toast success, call `onSuccess()`
- Region dropdown populated from `regions` prop (same as bookings)
- Staff dropdown populated from `staffList` prop

**Step 1: Create the component**

Follow the exact modal structure from `CreateBookingModal.tsx`:
- `fixed inset-0 z-50` backdrop
- `bg-white rounded-xl shadow-xl max-w-2xl` modal container
- Header with title and close button
- Scrollable content area with form sections
- Fixed footer with Cancel/Create buttons
- `useEffect` to reset form when `isOpen` changes
- `useRef` + click-outside handler
- Escape key handler
- Validation with error state object
- Submit with loading state

**Step 2: Verify build passes, then commit**

```
feat: add CreateLeadModal component
```

---

## Task 7: CallNotes Component

**Files:**
- Create: `src/components/admin/leads/CallNotes.tsx`

**What to build:** Reusable call notes component with add/collapse functionality and auto-save.

Props:
```typescript
interface CallNotesProps {
  callNotes: CallNote[];
  onChange: (notes: CallNote[]) => void;
  readOnly?: boolean; // For Lead History on bookings page
}
```

Key behaviours:
- Displays Call 1 through Call N in chronological order
- Each call: "Call X" header, editable date input, textarea for notes
- Older calls (all except the last two) are collapsed by default — showing date + first ~50 chars
- Click collapsed call to expand it
- "+ Add Call" button appends next call with today's date
- `onChange` fires on every edit — parent handles debounced save
- When `readOnly`, no edit controls, no add button, all calls expanded

**Step 1: Create the component**

Build with:
- `useState` for tracking which calls are expanded (Set of callNumbers)
- Last two calls always expanded by default
- Collapsed view: single line `text-gray-500 text-sm cursor-pointer` with truncated preview
- Date input: `type="date"`
- Notes: `<textarea>` with auto-resize
- "+ Add Call" button: `border-dashed border-2 border-gray-300` style

**Step 2: Verify build passes, then commit**

```
feat: add CallNotes component with collapse and auto-save
```

---

## Task 8: LeadStageBadge Component

**Files:**
- Create: `src/components/admin/leads/LeadStageBadge.tsx`

**What to build:** Small coloured badge for displaying lead stage in table rows.

```typescript
interface LeadStageBadgeProps {
  stage: LeadStage;
}
```

Colour mapping:
- New → `bg-blue-100 text-blue-800`
- Contacted → `bg-yellow-100 text-yellow-800`
- In Discussion → `bg-orange-100 text-orange-800`
- Won → `bg-green-100 text-green-800`
- Lost → `bg-gray-100 text-gray-500`

Render as: `<span className="px-2 py-0.5 rounded-full text-xs font-medium ...">{stage}</span>`

**Step 1: Create the component, verify build, commit**

```
feat: add LeadStageBadge component
```

---

## Task 9: LeadDetailsBreakdown Component

**Files:**
- Create: `src/components/admin/leads/LeadDetailsBreakdown.tsx`

**What to build:** Expanded row content for leads. Mirrors the BookingDetailsBreakdown pattern with cards.

Props:
```typescript
interface LeadDetailsBreakdownProps {
  lead: LeadWithStaffName;
  staffList: StaffOption[];
  regionList: RegionOption[];
  onUpdate: (leadId: string, data: Record<string, unknown>) => Promise<void>;
  onConvert: (leadId: string) => void;
  onDelete: (leadId: string) => void;
}
```

Layout (4-column grid for cards, full width for call notes):

1. **Contact Information card** — School name, contact person, email, phone (editable inline)
2. **Location card** — Address, postal code, city, region dropdown (editable)
3. **Lead Details card** — Source dropdown, event type interest checkboxes, estimated children, Schulsong upsell toggle, SCS funded toggle, estimated date (with specific/month toggle)
4. **Stage & Assignment card** — Stage selector dropdown, assigned staff dropdown
5. **Call Notes section** (full width) — Uses `CallNotes` component, with auto-save via 1s debounce on the `onUpdate` callback
6. **Next Follow-Up** — Date picker below call notes, auto-saves via debounce
7. **Action buttons row** — "Convert to Booking" (green, only if stage not Won/Lost), "Mark as Lost" (red, opens inline reason input), "Delete Lead" (grey, with confirmation)

Auto-save pattern: Use `useCallback` + `useRef` for debounce timer. On any field change, call `onUpdate(lead.id, { fieldName: newValue })` after 1 second of inactivity.

**Step 1: Create the component**

Follow the card layout from BookingDetailsBreakdown:
- `grid grid-cols-1 md:grid-cols-2 gap-4 p-4` for cards
- Each card: `bg-white border border-gray-200 rounded-lg p-4`
- Card title: `text-sm font-semibold text-gray-700 mb-3`

**Step 2: Verify build passes, then commit**

```
feat: add LeadDetailsBreakdown component with inline editing
```

---

## Task 10: Leads Page

**Files:**
- Create: `src/app/admin/leads/page.tsx`

**What to build:** Main leads page with filters, table, and CreateLeadModal. Follow the bookings page pattern exactly.

Key behaviours:

**Data fetching:**
- `fetchLeads()` calls GET `/api/admin/leads` with `credentials: 'include'`
- Stores `leads`, `staffList`, `regionList` in state
- Loading spinner while fetching

**Filters:**
- Stage toggles (multi-select, OR logic) — default to all active stages (New, Contacted, In Discussion)
- Lead source dropdown filter
- Staff/owner dropdown filter
- Text search (school name, contact person)

**Table columns:**
- School Name | Contact | Phone | Stage (badge) | Source | Follow-Up | Created
- Follow-up column: shows date with colour coding (red if overdue, orange if today, grey otherwise)
- Expandable rows using Fragment pattern from bookings

**Sorting:**
- Overdue follow-ups first (red)
- Follow-ups today
- Follow-ups this week
- Then by last updated
- Won/Lost leads sorted to bottom, greyed out with `opacity-50`

**Update handler:**
- `handleUpdateLead(leadId, data)` calls PATCH `/api/admin/leads/${leadId}`
- Optimistically updates local state
- Toast on error

**Convert handler:**
- `handleConvertLead(leadId)` calls POST `/api/admin/leads/${leadId}/convert`
- Opens CreateBookingModal with pre-fill data
- After booking created, updates lead's `converted_booking_id`

**Delete handler:**
- `handleDeleteLead(leadId)` calls DELETE `/api/admin/leads/${leadId}`
- Removes from local state, toast success

**Step 1: Create the page component**

Structure:
```
'use client';
// Header with title, count, "Create Lead" button
// Filter bar (stage toggles, source dropdown, staff dropdown, text search)
// Table with expandable rows
// CreateLeadModal
```

**Step 2: Verify build passes, then commit**

```
feat: add leads page with filters, table, and CRUD
```

---

## Task 11: Modify CreateBookingModal to Accept Pre-fill Data

**Files:**
- Modify: `src/components/admin/bookings/CreateBookingModal.tsx`

**What to build:** Add optional `prefillData` prop so the modal can be pre-filled when converting a lead.

**Step 1: Add prefillData prop**

Add to the props interface:

```typescript
interface CreateBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (bookingId?: string) => void; // Add optional bookingId parameter
  regions: RegionOption[];
  prefillData?: {
    leadId?: string;
    schoolName?: string;
    contactName?: string;
    contactEmail?: string;
    phone?: string;
    address?: string;
    postalCode?: string;
    city?: string;
    regionId?: string;
    estimatedChildren?: string;
    eventDate?: string;
    callNotes?: Array<{ callNumber: number; date: string; notes: string }>;
  };
}
```

**Step 2: Use prefillData in the reset useEffect**

In the existing `useEffect` that resets form on `isOpen`, add pre-fill logic:

```typescript
useEffect(() => {
  if (isOpen) {
    setSchoolName(prefillData?.schoolName || '');
    setContactName(prefillData?.contactName || '');
    setContactEmail(prefillData?.contactEmail || '');
    setPhone(prefillData?.phone || '');
    setAddress(prefillData?.address || '');
    setPostalCode(prefillData?.postalCode || '');
    setCity(prefillData?.city || '');
    setSelectedRegionId(prefillData?.regionId || '');
    setEstimatedChildren(prefillData?.estimatedChildren || '');
    setEventDate(prefillData?.eventDate || '');
    // ... rest of resets
    setErrors({});
  }
}, [isOpen, prefillData]);
```

**Step 3: Pass leadId and callNotes in submit payload**

In `handleSubmit`, add to the payload:

```typescript
if (prefillData?.leadId) payload.leadId = prefillData.leadId;
if (prefillData?.callNotes) payload.callNotes = prefillData.callNotes;
```

**Step 4: Update the modal title when pre-filling**

```typescript
<h2>{prefillData?.leadId ? 'Convert Lead to Booking' : 'Create Booking'}</h2>
```

**Step 5: Verify build passes, then commit**

```
feat: add prefillData support to CreateBookingModal for lead conversion
```

---

## Task 12: Store Lead Call Notes on Booking Creation

**Files:**
- Modify: `src/app/api/admin/bookings/route.ts`

**What to build:** When a booking is created with a `leadId` and `callNotes` in the payload, store the call notes on the booking and link the lead to the new booking.

**Step 1: In the POST handler, after booking is created**

Add after the existing post-creation chain:

```typescript
// If created from a lead conversion, link the lead and store call notes
if (body.leadId && body.callNotes) {
  try {
    const airtableService = getAirtableService();
    // Update the lead with the converted booking ID
    await airtableService.updateLead(body.leadId, {
      convertedBookingId: record.id,
      stage: 'Won',
    });

    // Store call notes on the SchoolBooking record as a custom field
    // (We'll store them in the admin_notes of the Event record that was just created)
    // The call notes will be appended as a "Lead History" section
    if (eventRecord) {
      const leadHistoryText = body.callNotes
        .map((note: { callNumber: number; date: string; notes: string }) =>
          `[Call ${note.callNumber} - ${note.date}]\n${note.notes}`
        )
        .join('\n\n');

      const existingNotes = eventRecord.admin_notes || '';
      const combinedNotes = existingNotes
        ? `${existingNotes}\n\n--- Lead History ---\n${leadHistoryText}`
        : `--- Lead History ---\n${leadHistoryText}`;

      await airtableService.updateEventField(
        eventRecord.id,
        EVENTS_FIELD_IDS.admin_notes,
        combinedNotes
      );
    }
  } catch (leadError) {
    console.error('Error linking lead to booking:', leadError);
    // Don't fail the booking creation if lead linking fails
  }
}
```

Note: Check if `updateEventField` method exists in airtableService. If not, use direct Airtable API call:

```typescript
await base.table(EVENTS_TABLE_ID).update(eventRecord.id, {
  [EVENTS_FIELD_IDS.admin_notes]: combinedNotes,
});
```

**Step 2: Return bookingId in response for the leads page to use**

Ensure the POST response includes `bookingId: record.id` (it likely already does).

**Step 3: Verify build passes, then commit**

```
feat: store lead call notes on booking during conversion
```

---

## Task 13: Lead History on Bookings Page

**Files:**
- Modify: `src/app/admin/bookings/page.tsx` (or wherever BookingDetailsBreakdown lives)

**What to build:** Display "Lead History" card in the booking expanded view when the admin_notes contain the `--- Lead History ---` marker.

**Step 1: In BookingDetailsBreakdown**

Add a conditional section after the existing Admin Notes:

```typescript
{/* Lead History - shown when booking was converted from a lead */}
{booking.adminNotes?.includes('--- Lead History ---') && (() => {
  const leadHistoryStart = booking.adminNotes!.indexOf('--- Lead History ---');
  const leadHistoryText = booking.adminNotes!.substring(leadHistoryStart + '--- Lead History ---'.length).trim();
  const calls = leadHistoryText.split(/\n\n/).filter(Boolean).map(block => {
    const headerMatch = block.match(/^\[Call (\d+) - (.+)\]\n([\s\S]*)$/);
    if (headerMatch) {
      return { callNumber: parseInt(headerMatch[1]), date: headerMatch[2], notes: headerMatch[3] };
    }
    return null;
  }).filter(Boolean);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-blue-800 mb-3">Lead History</h4>
      <div className="space-y-3">
        {calls.map((call, i) => (
          <div key={i} className="border-l-2 border-blue-300 pl-3">
            <div className="text-xs font-medium text-blue-700">
              Call {call!.callNumber} — {call!.date}
            </div>
            <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{call!.notes}</p>
          </div>
        ))}
      </div>
    </div>
  );
})()}
```

**Step 2: Verify build passes, then commit**

```
feat: display lead history in booking details breakdown
```

---

## Task 14: End-to-End Testing

**Files:** None (manual testing)

**Step 1: Test lead creation**
- Navigate to `/admin/leads`
- Click "Create Lead"
- Fill required fields (school name, contact, phone)
- Submit — verify lead appears in table with "New" stage

**Step 2: Test call notes**
- Expand a lead row
- Edit Call 1 notes — verify auto-save (wait 1s, refresh, check notes persisted)
- Click "+ Add Call" — verify Call 2 appears
- Add notes to Call 2, verify both saved

**Step 3: Test stage changes**
- Change stage to "Contacted" — verify badge colour changes
- Change to "In Discussion" — verify

**Step 4: Test follow-up**
- Set a follow-up date — verify badge appears in table row
- Set to today's date — verify orange highlight

**Step 5: Test filters**
- Toggle stage filters — verify correct leads shown
- Use text search — verify filtering works
- Use source/staff dropdowns — verify

**Step 6: Test conversion**
- Click "Convert to Booking" on a lead
- Verify CreateBookingModal opens pre-filled with lead data
- Submit the booking
- Verify lead shows as "Won" (greyed out)
- Navigate to bookings — verify new booking exists with Lead History

**Step 7: Test mark as lost**
- Click "Mark as Lost" on a lead
- Enter reason, confirm
- Verify lead shows as "Lost" (greyed out)

**Step 8: Verify build passes**

Run: `npx next build`
Expected: Clean build with no errors

**Step 9: Commit any fixes**

```
fix: address issues found during leads end-to-end testing
```

---

## Task Summary

| # | Task | Files | Estimated Size |
|---|------|-------|----------------|
| 1 | Airtable Service CRUD | Modify: airtableService.ts | ~150 lines |
| 2 | GET/POST API Routes | Create: api/admin/leads/route.ts | ~120 lines |
| 3 | PATCH/DELETE API Routes | Create: api/admin/leads/[leadId]/route.ts | ~60 lines |
| 4 | Convert API Route | Create: api/admin/leads/[leadId]/convert/route.ts | ~60 lines |
| 5 | Sidebar Navigation | Modify: admin/layout.tsx | 1 line |
| 6 | CreateLeadModal | Create: components/admin/leads/CreateLeadModal.tsx | ~350 lines |
| 7 | CallNotes Component | Create: components/admin/leads/CallNotes.tsx | ~120 lines |
| 8 | LeadStageBadge | Create: components/admin/leads/LeadStageBadge.tsx | ~30 lines |
| 9 | LeadDetailsBreakdown | Create: components/admin/leads/LeadDetailsBreakdown.tsx | ~400 lines |
| 10 | Leads Page | Create: admin/leads/page.tsx | ~400 lines |
| 11 | CreateBookingModal Prefill | Modify: CreateBookingModal.tsx | ~30 lines changed |
| 12 | Lead Notes on Booking | Modify: api/admin/bookings/route.ts | ~30 lines |
| 13 | Lead History Display | Modify: admin/bookings/page.tsx | ~30 lines |
| 14 | End-to-End Testing | Manual | — |

**Dependency order:** Tasks 1→2→3→4 (service + API layer), 5 (nav), 6→7→8→9→10 (UI components + page), 11→12→13 (conversion integration), 14 (testing).

**Parallelizable:** Tasks 6, 7, 8 can be built in parallel. Tasks 2, 3, 4 can be built in parallel after Task 1.
