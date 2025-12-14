# SimplyBook.me Integration Guide

This guide explains how to connect SimplyBook.me to MiniMusiker for automatic event creation when schools book through the booking system.

---

## Table of Contents

1. [Overview](#overview)
2. [Workflow](#workflow)
3. [Environment Variables](#environment-variables)
4. [SimplyBook API Reference](#simplybook-api-reference)
5. [Webhook Setup](#webhook-setup)
6. [Field Mapping](#field-mapping)
7. [Region to Staff Mapping](#region-to-staff-mapping)
8. [New Airtable Fields Required](#new-airtable-fields-required)
9. [API Endpoints to Create](#api-endpoints-to-create)
10. [Data Flow Diagram](#data-flow-diagram)
11. [Implementation Checklist](#implementation-checklist)
12. [Claude Code Implementation Prompts](#claude-code-implementation-prompts)

---

## Overview

SimplyBook.me is used by **schools** (B2B customers) to book MiniMusiker events. This is separate from the parent portal where parents register their children.

| System | Users | Purpose |
|--------|-------|---------|
| **SimplyBook.me** | Schools/Teachers | Book events (B2B) |
| **MiniMusiker Admin** | Staff | Manage events, classes, staff assignments |
| **Parent Portal** | Parents | Register children for events |
| **Shopify** | Parents | Purchase merchandise |

### Key Insight

SimplyBook.me does NOT handle:
- Parent registrations (handled by your portal)
- Class information (added by admin after event creation)
- Child names (entered by parents when registering)

SimplyBook.me DOES provide:
- School contact information
- Event date/time
- Main teacher contact
- Location/region (for staff assignment)
- Estimated number of children

---

## Workflow

```
┌────────────────────────────────────────────────────────────────────────┐
│                         EVENT LIFECYCLE                                 │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  1. SCHOOL BOOKS EVENT                                                 │
│     ┌──────────────────┐                                               │
│     │  SimplyBook.me   │                                               │
│     │  - School fills  │                                               │
│     │    intake form   │                                               │
│     │  - Selects date  │                                               │
│     │  - Selects region│                                               │
│     └────────┬─────────┘                                               │
│              │                                                         │
│              │ Webhook: booking_id, hash, notification_type            │
│              ▼                                                         │
│  2. WEBHOOK RECEIVES BOOKING                                           │
│     ┌──────────────────┐                                               │
│     │ /api/simplybook/ │                                               │
│     │    webhook       │                                               │
│     │  - Validates sig │                                               │
│     │  - Fetches full  │                                               │
│     │    booking data  │                                               │
│     └────────┬─────────┘                                               │
│              │                                                         │
│              │ booking details + intake form data                      │
│              ▼                                                         │
│  3. EVENT CREATED IN AIRTABLE                                          │
│     ┌──────────────────┐                                               │
│     │   Airtable       │                                               │
│     │  - Creates event │                                               │
│     │  - Assigns staff │                                               │
│     │    (by region)   │                                               │
│     └────────┬─────────┘                                               │
│              │                                                         │
│              ▼                                                         │
│  4. ADMIN ADDS CLASSES                                                 │
│     ┌──────────────────┐                                               │
│     │  Admin Panel     │                                               │
│     │  - Add classes   │                                               │
│     │    (Year 1, etc) │                                               │
│     │  - Set details   │                                               │
│     └────────┬─────────┘                                               │
│              │                                                         │
│              ▼                                                         │
│  5. PARENTS REGISTER CHILDREN                                          │
│     ┌──────────────────┐                                               │
│     │  Parent Portal   │                                               │
│     │  - Enter child   │                                               │
│     │    name          │                                               │
│     │  - Select class  │                                               │
│     │  - Purchase via  │                                               │
│     │    Shopify       │                                               │
│     └──────────────────┘                                               │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Environment Variables

Add these to your `.env.local` file:

```env
# SimplyBook.me Configuration
# Get from: SimplyBook Admin > Settings > API (Custom Feature must be enabled)

# Your company login (from SimplyBook URL: company_login.simplybook.me)
SIMPLYBOOK_COMPANY_LOGIN=minimusiker

# API Key for token authentication
# Get from: SimplyBook Admin > Plugins > API > Settings
SIMPLYBOOK_API_KEY=your_api_key_here

# Secret key for webhook signature verification
# Get from: SimplyBook Admin > Plugins > API > Settings
SIMPLYBOOK_SECRET_KEY=your_secret_key_here

# Optional: Webhook endpoint URL (for reference)
# This is YOUR server URL that SimplyBook will POST to
SIMPLYBOOK_WEBHOOK_URL=https://your-domain.com/api/simplybook/webhook
```

### Getting Your API Credentials

1. Log into SimplyBook.me admin panel
2. Go to **Custom Features** → Enable **API**
3. Go to **Settings** → **API keys**
4. Copy your:
   - Company login
   - API key
   - Secret key (for signature verification)

---

## SimplyBook API Reference

SimplyBook uses **JSON-RPC 2.0** protocol over HTTPS.

### Authentication

```typescript
// Step 1: Get access token (valid for 1 hour)
const tokenResponse = await fetch('https://user-api.simplybook.me/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'getToken',
    params: [COMPANY_LOGIN, API_KEY],
    id: 1,
  }),
});

const { result: token } = await tokenResponse.json();

// Step 2: Use token in subsequent requests
const headers = {
  'Content-Type': 'application/json',
  'X-Company-Login': COMPANY_LOGIN,
  'X-Token': token,
};
```

### Key API Methods

| Method | Purpose | Parameters |
|--------|---------|------------|
| `getToken` | Authenticate | `companyLogin`, `apiKey` |
| `getBookingDetails` | Get full booking | `bookingId`, `signature` |
| `getBookings` | List bookings | Filter object |
| `getEventList` | Get services | `isVisibleOnly` |
| `getUnitList` | Get providers | `isVisibleOnly` |
| `getAdditionalFields` | Get intake fields | `eventId` |
| `getLocationsList` | Get locations | (none) |

### Signature Generation

For security, `getBookingDetails` requires a signature:

```typescript
import crypto from 'crypto';

function generateSignature(bookingId: string, bookingHash: string, secretKey: string): string {
  return crypto
    .createHash('md5')
    .update(bookingId + bookingHash + secretKey)
    .digest('hex');
}
```

### getBookingDetails Response

```typescript
interface SimplyBookBookingDetails {
  id: string;
  code: string;
  hash: string;
  start_date_time: string;        // "2025-01-15 10:00:00"
  end_date_time: string;
  event_id: string;               // Service ID
  event_name: string;             // Service name
  unit_id: string;                // Provider ID (could be region)
  unit_name: string;              // Provider name
  client_id: string;
  client_name: string;            // School contact name
  client_email: string;
  client_phone: string;
  is_confirmed: boolean;
  additional_fields: {            // Intake form data
    [fieldName: string]: {
      title: string;
      value: string;
    };
  };
  location?: {
    id: string;
    title: string;
    address1: string;
    city: string;
  };
}
```

---

## Webhook Setup

### Webhook Payload (Incoming)

SimplyBook sends a minimal payload - you must fetch full details separately:

```typescript
interface SimplyBookWebhookPayload {
  booking_id: string;           // e.g., "12345"
  booking_hash: string;         // e.g., "abc123def456..."
  company: string;              // Your company login
  notification_type: 'create' | 'change' | 'cancel';
}
```

### Webhook Endpoint Configuration

In SimplyBook Admin:
1. Go to **Custom Features** → **API**
2. Find **Callback URL** setting
3. Enter your webhook URL: `https://your-domain.com/api/simplybook/webhook`

### Security Validation

Always validate incoming webhooks:

```typescript
function validateWebhook(
  bookingId: string,
  bookingHash: string,
  receivedCompany: string,
  expectedCompany: string,
  secretKey: string
): boolean {
  // Verify company matches
  if (receivedCompany !== expectedCompany) {
    return false;
  }

  // Signature is validated when calling getBookingDetails
  // The API will reject invalid signatures
  return true;
}
```

---

## Field Mapping

### SimplyBook → Airtable Field Mapping

| SimplyBook Field | SimplyBook Location | Airtable Field | Notes |
|------------------|---------------------|----------------|-------|
| `booking_id` | Webhook payload | `simplybook_id` (new) | Store for reference |
| `booking_hash` | Webhook payload | `simplybook_hash` (new) | Needed for API calls |
| `start_date_time` | Booking details | `booking_date` | Event date |
| `client_name` | Booking details | - | School contact name |
| `client_email` | Booking details | `school_contact_email` (new) | For school comms |
| `client_phone` | Booking details | `school_phone` (new) | School phone |
| Name (school) | Intake form | `school_name` | Primary school name |
| Contact Person | Intake form | `main_teacher` | Main teacher/contact |
| Address | Intake form | `school_address` (new) | School street address |
| Postal Code | Intake form | `school_postal_code` (new) | School postal code |
| Location/Region | Intake form OR unit | `region` (new) | For staff assignment |
| Number of Children | Intake form | `estimated_children` (new) | Estimated attendance |
| Size category | Intake form | `school_size_category` (new) | <150 or >150 |

### Your Intake Form Field Names

Based on your SimplyBook configuration:

```typescript
const SIMPLYBOOK_INTAKE_FIELD_MAPPING = {
  // The 'name' field in additional_fields maps to these
  'name': 'school_name',                    // "Name (name of school/location)"
  'email': 'school_contact_email',          // School email
  'phone': 'school_phone',                  // School phone
  'contact_person': 'main_teacher',         // "Contact Person (Main Teacher)"
  'address': 'school_address',              // School address
  'postal_code': 'school_postal_code',      // Postal code
  'location': 'region',                     // Region for staff assignment
  'number_of_children': 'estimated_children', // Number of children
  // Note: Size category (>150/<150) would be a separate field
};
```

**Important:** The exact field names in `additional_fields` depend on how they're named in SimplyBook. You may need to inspect the actual API response to get the exact field names.

---

## Region to Staff Mapping

Schools select a region when booking. This should auto-assign a staff member.

### Mapping Configuration

Create a mapping in your config or database:

```typescript
// src/config/regionStaffMapping.ts
export const REGION_STAFF_MAPPING: Record<string, string> = {
  // Region name (from SimplyBook) → Personen record ID (from Airtable)
  'Berlin': 'recXXXXXXXXX',
  'Hamburg': 'recYYYYYYYYY',
  'München': 'recZZZZZZZZZ',
  'Köln': 'recAAAAAAAAA',
  'Frankfurt': 'recBBBBBBBBB',
  // ... add all regions
};

export function getStaffIdForRegion(region: string): string | null {
  return REGION_STAFF_MAPPING[region] || null;
}
```

### Alternative: Store in Airtable

Create a `regions` table in Airtable:

| Field | Type | Description |
|-------|------|-------------|
| `region_name` | Text | Region name (matches SimplyBook) |
| `assigned_staff` | Link | Link to Personen table |
| `active` | Checkbox | Is region active? |

---

## New Airtable Fields Required

### Events Table (or new `events` table)

You may need to create a dedicated events table or add fields to existing structure:

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `simplybook_id` | Text | SimplyBook booking ID |
| `simplybook_hash` | Text | For API signature validation |
| `school_address` | Text | Street address from intake form |
| `school_postal_code` | Text | Postal code from intake form |
| `school_phone` | Phone | School phone number |
| `school_contact_email` | Email | School contact email |
| `estimated_children` | Number | Expected number of children |
| `school_size_category` | Single Select | "Less than 150" / "More than 150" |
| `region` | Single Select | Region for staff assignment |
| `simplybook_status` | Single Select | "pending" / "confirmed" / "cancelled" |
| `sync_status` | Single Select | "synced" / "error" / "pending" |
| `last_synced` | Date/Time | Last sync timestamp |

### Airtable Field IDs

After creating fields, note down the field IDs:

```typescript
// src/lib/types/airtable.ts - add these
export const SIMPLYBOOK_FIELD_IDS = {
  simplybook_id: 'fldXXXXXXXXX',
  simplybook_hash: 'fldXXXXXXXXX',
  school_address: 'fldXXXXXXXXX',
  school_postal_code: 'fldXXXXXXXXX',
  school_phone: 'fldXXXXXXXXX',
  school_contact_email: 'fldXXXXXXXXX',
  estimated_children: 'fldXXXXXXXXX',
  school_size_category: 'fldXXXXXXXXX',
  region: 'fldXXXXXXXXX',
  simplybook_status: 'fldXXXXXXXXX',
  sync_status: 'fldXXXXXXXXX',
  last_synced: 'fldXXXXXXXXX',
} as const;
```

---

## API Endpoints to Create

### 1. Webhook Receiver

**File:** `src/app/api/simplybook/webhook/route.ts`

```typescript
// Handles incoming webhooks from SimplyBook
export async function POST(request: NextRequest) {
  // 1. Parse webhook payload
  // 2. Validate source
  // 3. Fetch full booking details from SimplyBook API
  // 4. Map to Airtable schema
  // 5. Create/update event in Airtable
  // 6. Auto-assign staff based on region
  // 7. Return 200 OK
}
```

### 2. Manual Sync Endpoint

**File:** `src/app/api/simplybook/sync/route.ts`

```typescript
// For manual sync or re-sync of bookings
export async function POST(request: NextRequest) {
  // 1. Accept date range or booking IDs
  // 2. Fetch bookings from SimplyBook
  // 3. Sync each to Airtable
  // 4. Return sync report
}
```

### 3. Booking Status Check

**File:** `src/app/api/simplybook/status/[bookingId]/route.ts`

```typescript
// Check sync status of a specific booking
export async function GET(request: NextRequest) {
  // Return Airtable record status for given SimplyBook booking
}
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SIMPLYBOOK → MINIMUSIKER FLOW                    │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│  SimplyBook  │
│   Booking    │
│   Created    │
└──────┬───────┘
       │
       │ POST webhook
       │ {booking_id, hash, company, notification_type: "create"}
       ▼
┌──────────────────────────────────────────────────────────────────┐
│  /api/simplybook/webhook                                         │
│                                                                  │
│  1. Validate webhook origin                                      │
│  2. Generate signature: md5(booking_id + hash + secret_key)      │
│  3. Call SimplyBook API: getBookingDetails(id, signature)        │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               │ JSON-RPC request
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  SimplyBook API (user-api.simplybook.me)                         │
│                                                                  │
│  Returns: {                                                      │
│    id, start_date_time, client_name, client_email,              │
│    additional_fields: { school_name, teacher, region, ... }     │
│  }                                                               │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               │ Full booking data
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  SimplyBookService.mapToAirtableEvent()                          │
│                                                                  │
│  Maps SimplyBook fields → Airtable schema                        │
│  Looks up region → staff assignment                              │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               │ Mapped event data
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  Airtable API                                                    │
│                                                                  │
│  Creates/updates record in events table                          │
│  Links staff member (assigned_staff field)                       │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  Admin Panel (/admin/events)                                     │
│                                                                  │
│  Event appears with:                                             │
│  - School name, date, teacher                                    │
│  - Auto-assigned staff member                                    │
│  - Ready for class addition                                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

### Phase 1: SimplyBook Service Setup
- [ ] Add environment variables to `.env.local`
- [ ] Create `src/lib/services/simplybookService.ts`
- [ ] Implement token authentication
- [ ] Implement `getBookingDetails()` method
- [ ] Test API connectivity

### Phase 2: Airtable Schema Updates
- [ ] Add new fields to Airtable events table
- [ ] Note down all new field IDs
- [ ] Update `src/lib/types/airtable.ts` with new field IDs
- [ ] Create region → staff mapping (config or table)

### Phase 3: Webhook Endpoint
- [ ] Create `/api/simplybook/webhook/route.ts`
- [ ] Implement webhook validation
- [ ] Implement booking → event creation
- [ ] Implement region → staff auto-assignment
- [ ] Add error handling and logging

### Phase 4: Testing
- [ ] Configure webhook URL in SimplyBook
- [ ] Test with a real booking
- [ ] Verify event appears in Admin panel
- [ ] Verify staff assignment works
- [ ] Test error scenarios (invalid payload, API down, etc.)

### Phase 5: Manual Sync (Optional)
- [ ] Create manual sync endpoint
- [ ] Add admin UI button for manual sync
- [ ] Implement bulk sync for historical bookings

---

## Claude Code Implementation Prompts

Use these prompts with Claude Code to implement each phase.

---

### Phase 1: SimplyBook Service Setup

**Prerequisites:**
- SimplyBook API custom feature enabled
- API key, secret key, and company login obtained
- Environment variables added to `.env.local`

**Prompt:**

```
Create a SimplyBook.me service for the MiniMusiker project. The service should handle authentication and API calls to SimplyBook using JSON-RPC 2.0 protocol.

Requirements:

1. Create `src/lib/services/simplybookService.ts` following the singleton pattern used in `src/lib/services/airtableService.ts`

2. Implement these methods:
   - `getToken()` - Authenticate and get access token (cache for 55 minutes)
   - `getBookingDetails(bookingId: string, bookingHash: string)` - Fetch full booking details
   - `getBookings(dateFrom?: string, dateTo?: string)` - List bookings with optional date filter
   - `generateSignature(bookingId: string, bookingHash: string)` - Create MD5 signature

3. Create types in `src/lib/types/simplybook.ts`:
   - SimplyBookBookingDetails
   - SimplyBookWebhookPayload
   - SimplyBookIntakeFields

4. Environment variables to use:
   - SIMPLYBOOK_COMPANY_LOGIN
   - SIMPLYBOOK_API_KEY
   - SIMPLYBOOK_SECRET_KEY

5. SimplyBook API endpoints:
   - Login/Token: https://user-api.simplybook.me/login
   - Admin API: https://user-api.simplybook.me/admin

6. JSON-RPC 2.0 request format:
   {
     jsonrpc: "2.0",
     method: "methodName",
     params: [param1, param2],
     id: 1
   }

7. Required headers for authenticated requests:
   - Content-Type: application/json
   - X-Company-Login: {company_login}
   - X-Token: {access_token}

The service should handle token expiration, retry on auth errors, and provide clear error messages.
```

---

### Phase 2: Webhook Endpoint

**Prerequisites:**
- Phase 1 completed (SimplyBook service created)
- New Airtable fields added (see "New Airtable Fields Required" section)
- Field IDs noted and added to `src/lib/types/airtable.ts`

**Prompt:**

```
Create a webhook endpoint to receive SimplyBook.me booking notifications and create events in Airtable.

Requirements:

1. Create `/api/simplybook/webhook/route.ts` with POST handler

2. Webhook payload structure (from SimplyBook):
   {
     booking_id: string,
     booking_hash: string,
     company: string,
     notification_type: "create" | "change" | "cancel"
   }

3. Implementation flow:
   a. Parse incoming JSON payload
   b. Validate company matches SIMPLYBOOK_COMPANY_LOGIN
   c. Use SimplybookService.getBookingDetails() to fetch full booking
   d. Extract intake form data from additional_fields
   e. Map to Airtable event schema
   f. Create or update event in Airtable
   g. Return 200 OK (SimplyBook expects quick response)

4. Field mapping from SimplyBook intake forms to Airtable:
   - "Name" (or similar) → school_name
   - "Contact Person" → main_teacher
   - "Address" → school_address (new field)
   - "Postal Code" → school_postal_code (new field)
   - "Location" or region field → region (new field)
   - "Number of Children" → estimated_children (new field)
   - start_date_time → booking_date
   - client_email → school_contact_email (new field)
   - client_phone → school_phone (new field)

5. Also store:
   - simplybook_id (the booking_id)
   - simplybook_hash (the booking_hash)
   - sync_status: "synced"
   - last_synced: current timestamp

6. Handle notification_type:
   - "create": Create new event
   - "change": Update existing event (find by simplybook_id)
   - "cancel": Update status to "cancelled"

7. Add comprehensive error handling:
   - Log all incoming webhooks
   - Return 200 even on errors (to prevent SimplyBook retries)
   - Store error details for debugging

Use the existing AirtableService pattern. The intake form field names might vary - check the actual API response and adjust field mapping as needed.
```

---

### Phase 3: Region to Staff Auto-Assignment

**Prerequisites:**
- Phase 2 completed (webhook endpoint working)
- Region → staff mapping created (either in config or Airtable)
- Staff members exist in Personen table

**Prompt:**

```
Add automatic staff assignment based on region to the SimplyBook webhook handler.

Requirements:

1. Create `src/config/regionStaffMapping.ts` with region → staff record ID mapping:
   - Map German regions to Personen table record IDs
   - Include all regions available in your SimplyBook booking form
   - Export a function: getStaffIdForRegion(region: string): string | null

2. Update the webhook handler to:
   a. Extract region from booking intake form fields
   b. Look up staff member ID using getStaffIdForRegion()
   c. Set assigned_staff field when creating/updating event
   d. Log if no staff found for region (but don't fail)

3. The regions in your SimplyBook intake form are German regions. Example mapping structure:
   {
     "Berlin": "recXXXXXXXXX",      // Replace with actual Personen record IDs
     "Hamburg": "recYYYYYYYYY",
     "München": "recZZZZZZZZZ",
     // ... etc
   }

4. To get Personen record IDs:
   - Use the existing AirtableService.getTeamMembers() method
   - Or query Airtable directly for the Personen table

5. Handle edge cases:
   - Unknown region: Log warning, create event without staff
   - Staff member not found: Log warning, continue without assignment
   - Multiple staff per region: Use first match (or create logic for rotation)

The assigned_staff field in Airtable is a linked record field that connects to the Personen table.
```

---

### Phase 4: Admin Sync Button (Optional)

**Prerequisites:**
- Phases 1-3 completed
- Basic webhook integration working

**Prompt:**

```
Add a manual sync feature to the admin panel for syncing SimplyBook bookings.

Requirements:

1. Create `/api/simplybook/sync/route.ts`:
   - POST: Sync bookings for a date range
   - Accept body: { dateFrom?: string, dateTo?: string, bookingIds?: string[] }
   - Return: { synced: number, failed: number, errors: string[] }

2. Add sync button to admin events page or create dedicated sync page:
   - Button: "Sync from SimplyBook"
   - Date range picker (optional)
   - Progress indicator
   - Results display (synced count, any errors)

3. Implementation:
   a. Call SimplybookService.getBookings(dateFrom, dateTo)
   b. For each booking, check if already in Airtable (by simplybook_id)
   c. Create new events or update existing ones
   d. Return summary

4. Add to the events admin page at `src/app/admin/events/page.tsx`:
   - Sync button in header area
   - Simple modal or dropdown for date range
   - Toast notification for results

This is useful for:
- Initial migration of existing bookings
- Recovery if webhooks were missed
- Manual verification of sync status
```

---

### Phase 5: Full Integration Test

**Prerequisites:**
- All previous phases completed
- SimplyBook webhook URL configured
- Test booking created in SimplyBook

**Prompt:**

```
Test the complete SimplyBook integration end-to-end.

Test Checklist:

1. Service Connectivity:
   - Call SimplybookService.getToken() - should return valid token
   - Call SimplybookService.getBookings() - should return bookings list
   - Verify token caching works (second call should be faster)

2. Webhook Reception:
   - Create a test booking in SimplyBook
   - Check server logs for incoming webhook
   - Verify payload parsing works

3. Event Creation:
   - After booking, check Airtable for new event
   - Verify all fields mapped correctly:
     □ school_name
     □ main_teacher
     □ booking_date
     □ school_address
     □ school_postal_code
     □ region
     □ estimated_children
     □ simplybook_id
     □ simplybook_hash
     □ sync_status = "synced"

4. Staff Assignment:
   - Verify assigned_staff field is populated
   - Check it links to correct Personen record for the region

5. Admin Panel:
   - Navigate to /admin/events
   - Verify new event appears in list
   - Check event details page shows all info
   - Verify staff assignment is visible

6. Error Handling:
   - Test with invalid webhook payload
   - Test with invalid SimplyBook credentials
   - Test with missing intake form fields
   - Verify errors are logged but don't crash

7. Update Flow:
   - Modify booking in SimplyBook
   - Verify webhook triggers with notification_type: "change"
   - Check Airtable record is updated (not duplicated)

8. Cancellation Flow:
   - Cancel booking in SimplyBook
   - Verify event status updates to "cancelled"

Please run these tests and report:
- Any failures or issues
- Suggested fixes
- Any edge cases discovered
```

---

## Troubleshooting

### Common Issues

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| Webhook not received | URL not configured | Check SimplyBook API settings |
| Invalid signature error | Wrong secret key | Verify SIMPLYBOOK_SECRET_KEY |
| Empty intake fields | Field names mismatch | Inspect API response, adjust mapping |
| Token expired | Cache not working | Check token refresh logic |
| Event not created | Airtable error | Check field IDs and permissions |
| Staff not assigned | Region not mapped | Add region to mapping config |

### Debug Logging

Add comprehensive logging:

```typescript
console.log('[SimplyBook Webhook]', {
  bookingId: payload.booking_id,
  notificationType: payload.notification_type,
  timestamp: new Date().toISOString(),
});
```

### Testing Webhooks Locally

Use ngrok for local testing:

```bash
ngrok http 3000
# Copy the HTTPS URL to SimplyBook callback settings
```

---

## Support

For questions about this integration:
- SimplyBook API docs: https://simplybook.me/en/api/developer-api
- SimplyBook help: https://help.simplybook.me/index.php/User_API_guide
- Existing service patterns: `src/lib/services/airtableService.ts`
- Type definitions: `src/lib/types/`
