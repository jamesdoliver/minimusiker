# Task System Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> **CRITICAL:** Before EVERY task, re-read the design document at `docs/plans/2026-03-09-task-system-overhaul-design.md` for context. Reference it constantly — it is your source of truth for what we are building.

**Goal:** Replace the single Tasks page with a cross-event matrix + date-grouped workload view, add a new Orders fulfillment dashboard with Shopify orchestration, implement audio/CD task workflows, and restructure the task timeline to 11 tasks with prefix-based categories.

**Architecture:** Two new top-level admin pages (Tasks, Orders). Tasks page has By Event matrix and By Date calendar views with per-event drill-down. Orders page is an event-centric Shopify-mirror with split-screen Welle 1/Welle 2 and "Fulfill All" orchestration. Airtable remains the data layer (middleman between app and Shopify). New `shipment_wave` field on Orders table for wave classification.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Airtable (database), Shopify Admin GraphQL API (fulfillment), R2 (file storage), existing admin auth (JWT in `admin_token` cookie via `requireAdmin` middleware).

---

## Reference Files

**Design doc (READ BEFORE EVERY TASK):** `docs/plans/2026-03-09-task-system-overhaul-design.md`

### Airtable Table IDs
| Table | ID |
|-------|-----|
| Tasks | `tblf59JyawJjgDqPJ` |
| GuesstimateOrders | `tblvNKyWN47i4blkr` |
| Orders | `tblu9AGaLSoEVwqq7` |
| Events | Check `src/lib/types/airtable.ts` for current ID |
| Songs | `tblPjGWQlHuG8jp5X` |
| AudioFiles | `tbloCM4tmH7mYoyXR` |

### Key Airtable Field IDs — Tasks Table (`tblf59JyawJjgDqPJ`)
| Field | ID | Type |
|-------|-----|------|
| task_id | fldYwXmqYLHXmCd1B | Autonumber |
| template_id | fldVXRwHmCbmRwAoe | Single line text |
| event_id | fldsyDbcBy1yzjbdI | Linked record → Events |
| task_type | fld1BhaWmhl0opQBU | Single select |
| task_name | fldKx1kQZX571SlUG | Single line text |
| description | fldOBfsp7Ahso72rJ | Long text |
| completion_type | fldLgArrpofS6dlHk | Single select |
| timeline_offset | flddNjbhxVtoKvzeE | Number |
| deadline | fld3KdpL5s6HKYm6t | Date |
| status | fldTlA0kywaIji0BL | Single select |
| completed_at | fldMPIc4fgagb9YTx | Date |
| completed_by | fldF1iEru5pHcNupv | Single line text |
| completion_data | fldHeL68HQXjcHGQk | Long text (JSON) |
| go_id | fld4zyH5ApLKQNq5V | Linked record → GuesstimateOrders |
| order_ids | fldqilVgYKVAQsTpr | Long text |
| parent_task_id | fldN73QVTWRGYbaVJ | Linked record → Tasks |
| created_at | fldt32Ff4DXY8ax47 | Date |

### Key Airtable Field IDs — Orders Table (`tblu9AGaLSoEVwqq7`)
| Field | ID | Type |
|-------|-----|------|
| order_id | fldPfSw1zCFI7gqXo | Shopify order GID |
| order_number | fldKVJtsO24WemkgA | Display number |
| parent_id | fldLbmO6NwPAfcqMX | Link → Parents |
| event_id | fldxJwmQCsx533oe0 | Link → Events |
| class_id | fldvwFX0XhPPZ9XBd | Link → Classes |
| line_items | fld9iRwg7rV6nMWrN | Long text (JSON) |
| fulfillment_status | fldAipl3jqPM46q5y | Single select |
| payment_status | fld1zfZ9ouEPJv8ju | Single select |
| total_amount | fldp5IVjGhtfnBKlR | Currency EUR |
| school_name | fld0oMH0XTGHi7fV0 | Single line text |
| order_date | fldpQj3Pba3Y2D6wo | Date |
| shipment_wave | **NEW — must be created in Airtable** | Single select |

### Key Airtable Field IDs — Songs Table (`tblPjGWQlHuG8jp5X`)
| Field | ID | Type |
|-------|-----|------|
| title | fldLjwkTwckDqT3Xl | Single line text |
| class_id | fldK4wCT5oKZDN6sE | Link → Classes |
| event_id | fldCKN3IXHPczIWfs | Single line text |
| album_order | fldj1xXfAhsaWcEE7 | Number |
| order | fld2RSJGY8pAqBaej | Number (class setlist position) |

### Key Airtable Field IDs — AudioFiles Table (`tbloCM4tmH7mYoyXR`)
| Field | ID | Type |
|-------|-----|------|
| song_id | fldehSfLpy3iozdBt | Link → Songs |
| event_id | fldwtYA1GwhVf3Ia7 | Single line text |
| r2_key | fldvzj75CspwfOfPX | Single line text |
| type | fldOMmFN7BqHVAqfH | Single select (raw/preview/final) |
| status | fldCAcEMu0IF1bWgz | Single select (pending/processing/ready/error) |
| duration_seconds | fldNzuiQghH3FhmdU | Number |

### Variant Classification
| Category | Variant IDs | Config File |
|----------|------------|-------------|
| School T-Shirts | 53328502194522-53328502325594 | `src/lib/config/clothingVariants.ts` → `CLOTHING_VARIANTS` |
| School Hoodies | 53328494788954-53328494920026 | Same file |
| Standard T-Shirts | 53328491512154-53328491643226 | Same file → `STANDARD_CLOTHING_VARIANTS` |
| Standard Hoodies | 53325998948698-53325999079770 | Same file |
| Audio/CD variants | **Must be identified** — check Shopify products | Not yet in config |

### Existing Services & Their Locations
| Service | File | Key Methods |
|---------|------|-------------|
| TaskService | `src/lib/services/taskService.ts` | `generateTasksForEvent()`, `completeTask()`, `getTasks()`, `getTaskById()` |
| ClothingOrdersService | `src/lib/services/clothingOrdersService.ts` | Event aggregation for clothing orders |
| MinicardOrdersService | `src/lib/services/minicardOrdersService.ts` | Minicard order fetching |
| StandardClothingBatchService | `src/lib/services/standardClothingBatchService.ts` | Weekly batch aggregation |
| TeacherService | `src/lib/services/teacherService.ts` | `getAlbumTracksData()`, `getAudioFilesByEventId()`, `getSongsByEventId()` |
| ShopifyAdminService | `src/lib/services/shopifyAdminService.ts` | Shopify GraphQL queries (API v2025-01) |
| OrdersHelper | `src/lib/services/ordersHelper.ts` | `getOrdersByEventRecordId()`, `resolveEventRecordId()` |

### Existing Admin Nav
File: `src/app/admin/layout.tsx` — navigation array with 9 items. "Tasks" is at index 3 with href `/admin/tasks`.

---

## Phase 1: Data Model & Configuration

### Task 1.1: Create New Task Timeline Config

**Files:**
- Create: `src/lib/config/taskTimeline.ts`
- Modify: `src/lib/types/tasks.ts`

**Context:** The design doc (Section 9) defines 11 tasks with new prefix-based categories. The old `taskTemplates.ts` defines 7 templates with different offsets and types. We are creating a NEW config file — the old one stays until migration.

**Step 1: Create the new task timeline config**

Create `src/lib/config/taskTimeline.ts`:

```typescript
// New task timeline configuration
// Design doc: docs/plans/2026-03-09-task-system-overhaul-design.md, Section 9

export type TaskPrefix = 'Ship' | 'Order' | 'Shipment' | 'Audio';

export type TaskCompletionType = 'monetary' | 'orchestrated' | 'tracklist' | 'quantity_checkbox';

export interface TaskTimelineEntry {
  id: string;
  prefix: TaskPrefix;
  name: string;
  displayName: string; // "Ship: Poster"
  offset: number; // Days relative to event. Negative = before, positive = after.
  completion: TaskCompletionType;
  creates_go_id: boolean;
  description: string;
}

export const TASK_TIMELINE: TaskTimelineEntry[] = [
  {
    id: 'ship_poster',
    prefix: 'Ship',
    name: 'Poster',
    displayName: 'Ship: Poster',
    offset: -45,
    completion: 'monetary',
    creates_go_id: true,
    description: 'Order and ship poster to school',
  },
  {
    id: 'ship_flyer_1',
    prefix: 'Ship',
    name: 'Flyer 1',
    displayName: 'Ship: Flyer 1',
    offset: -43,
    completion: 'monetary',
    creates_go_id: true,
    description: 'Order and ship first flyer batch',
  },
  {
    id: 'order_schul_clothing',
    prefix: 'Order',
    name: 'Schul Clothing',
    displayName: 'Order: Schul Clothing',
    offset: -18,
    completion: 'monetary',
    creates_go_id: true,
    description: 'Place school-branded clothing order with supplier',
  },
  {
    id: 'ship_flyer_2',
    prefix: 'Ship',
    name: 'Flyer 2',
    displayName: 'Ship: Flyer 2',
    offset: -18,
    completion: 'monetary',
    creates_go_id: true,
    description: 'Order and ship second flyer batch',
  },
  {
    id: 'ship_flyer_3',
    prefix: 'Ship',
    name: 'Flyer 3',
    displayName: 'Ship: Flyer 3',
    offset: -10,
    completion: 'monetary',
    creates_go_id: true,
    description: 'Order and ship third flyer batch',
  },
  {
    id: 'shipment_welle_1',
    prefix: 'Shipment',
    name: 'Welle 1',
    displayName: 'Shipment: Welle 1',
    offset: -9,
    completion: 'orchestrated',
    creates_go_id: false,
    description: 'Batch ship clothing items to customers. Mixed orders partially fulfilled.',
  },
  {
    id: 'order_minicard',
    prefix: 'Order',
    name: 'Minicard',
    displayName: 'Order: Minicard',
    offset: 5,
    completion: 'monetary',
    creates_go_id: true,
    description: 'Order minicards after event',
  },
  {
    id: 'order_schul_clothing_2',
    prefix: 'Order',
    name: 'Schul Clothing 2',
    displayName: 'Order: Schul Clothing 2',
    offset: 7,
    completion: 'monetary',
    creates_go_id: true,
    description: 'Second school clothing order for late/additional orders. Cutoff for school-specific clothing.',
  },
  {
    id: 'audio_master_cd',
    prefix: 'Audio',
    name: 'Master CD',
    displayName: 'Audio: Master CD',
    offset: 11,
    completion: 'tracklist',
    creates_go_id: false,
    description: 'Assemble mastered audio in album order for CD production',
  },
  {
    id: 'audio_cd_production',
    prefix: 'Audio',
    name: 'CD Production',
    displayName: 'Audio: CD Production',
    offset: 12,
    completion: 'quantity_checkbox',
    creates_go_id: false,
    description: 'Produce CDs in-house based on order quantity',
  },
  {
    id: 'shipment_welle_2',
    prefix: 'Shipment',
    name: 'Welle 2',
    displayName: 'Ship: Welle 2',
    offset: 14,
    completion: 'orchestrated',
    creates_go_id: false,
    description: 'Ship remaining audio items to customers. Completes mixed order fulfillment.',
  },
];

// Column order for matrix view (matches timeline order)
export const TASK_TIMELINE_ORDER = TASK_TIMELINE.map(t => t.id);

// Lookup helpers
export function getTimelineEntry(id: string): TaskTimelineEntry | undefined {
  return TASK_TIMELINE.find(t => t.id === id);
}

export function getTimelineEntriesByPrefix(prefix: TaskPrefix): TaskTimelineEntry[] {
  return TASK_TIMELINE.filter(t => t.prefix === prefix);
}

export function calculateDeadline(eventDate: Date, offset: number): Date {
  const deadline = new Date(eventDate);
  deadline.setDate(deadline.getDate() + offset);
  return deadline;
}

// Prefix styling for UI
export const PREFIX_STYLES: Record<TaskPrefix, { label: string; color: string; bgColor: string; icon: string }> = {
  Ship: { label: 'Ship', color: 'text-blue-700', bgColor: 'bg-blue-50', icon: '📦' },
  Order: { label: 'Order', color: 'text-purple-700', bgColor: 'bg-purple-50', icon: '🛒' },
  Shipment: { label: 'Shipment', color: 'text-teal-700', bgColor: 'bg-teal-50', icon: '🚚' },
  Audio: { label: 'Audio', color: 'text-amber-700', bgColor: 'bg-amber-50', icon: '🎵' },
};
```

**Step 2: Update task types**

Modify `src/lib/types/tasks.ts` — add new types alongside existing ones (old types stay for backward compatibility during migration):

Add these new types at the end of the file:

```typescript
// === NEW TASK SYSTEM TYPES (Overhaul) ===

export type NewTaskPrefix = 'Ship' | 'Order' | 'Shipment' | 'Audio';
export type NewTaskCompletionType = 'monetary' | 'orchestrated' | 'tracklist' | 'quantity_checkbox';

// Status colors for matrix view
export type TaskCellStatus = 'white' | 'yellow' | 'red' | 'green' | 'grey';

export interface TaskMatrixCell {
  taskId: string;
  templateId: string;
  status: TaskStatus;
  cellStatus: TaskCellStatus;
  deadline: string;
  daysUntilDue: number;
  completedAt?: string;
}

export interface TaskMatrixRow {
  eventId: string;
  eventRecordId: string;
  schoolName: string;
  eventDate: string;
  completedCount: number;
  totalCount: number;
  cells: Record<string, TaskMatrixCell>; // keyed by template_id
}

// Shipment wave for Orders
export type ShipmentWave = 'Welle 1' | 'Welle 2' | 'Both' | 'Rolling';
```

**Step 3: Commit**

```bash
git add src/lib/config/taskTimeline.ts src/lib/types/tasks.ts
git commit -m "feat: add new task timeline config with 11 tasks and prefix-based categories"
```

---

### Task 1.2: Create Variant Classification Config

**Files:**
- Create: `src/lib/config/variantClassification.ts`

**Context:** The design doc (Section 8) requires auto-computing `shipment_wave` based on line item variants. We need a config that classifies variants as clothing (Welle 1) or audio (Welle 2). Clothing variants already exist in `src/lib/config/clothingVariants.ts`. Audio/CD variant IDs need to be identified from Shopify.

**Step 1: Create variant classification config**

Create `src/lib/config/variantClassification.ts`:

```typescript
// Variant classification for shipment wave auto-computation
// Design doc: docs/plans/2026-03-09-task-system-overhaul-design.md, Section 8
//
// Classifies Shopify line item variants into wave categories:
// - clothing → Welle 1 (ships before/around event)
// - audio → Welle 2 (ships after event, post-production)
// - standard → Rolling (weekly batch, not event-specific)

import { CLOTHING_VARIANTS, STANDARD_CLOTHING_VARIANTS } from './clothingVariants';
import type { ShipmentWave } from '@/lib/types/tasks';

export type VariantCategory = 'clothing' | 'audio' | 'standard';

// Audio/CD product variant IDs from Shopify
// TODO: Populate with actual Shopify variant IDs for CD products
export const AUDIO_VARIANTS: Record<string, { type: string; description: string }> = {
  // Example: '12345678901234': { type: 'cd', description: 'Event CD' },
  // These must be filled in with actual Shopify variant IDs
};

/**
 * Classify a single variant ID into a category.
 * Returns undefined if the variant is not recognized (e.g. digital-only products).
 */
export function classifyVariant(variantId: string): VariantCategory | undefined {
  // Strip GID prefix if present
  const numericId = variantId.replace('gid://shopify/ProductVariant/', '');

  if (numericId in CLOTHING_VARIANTS) return 'clothing';
  if (numericId in STANDARD_CLOTHING_VARIANTS) return 'standard';
  if (numericId in AUDIO_VARIANTS) return 'audio';

  return undefined;
}

/**
 * Auto-compute shipment wave for an order based on its line items.
 *
 * Logic:
 * - All clothing (school-branded) → Welle 1
 * - All audio → Welle 2
 * - Mix of clothing + audio → Both
 * - All standard (non-school) → Rolling
 * - Standard + anything else → the non-standard wave wins
 * - Unrecognized variants are ignored (e.g. digital products)
 */
export function computeShipmentWave(
  lineItems: Array<{ variant_id: string; quantity: number }>
): ShipmentWave | null {
  const categories = new Set<VariantCategory>();

  for (const item of lineItems) {
    const category = classifyVariant(item.variant_id);
    if (category) categories.add(category);
  }

  // If only standard items
  if (categories.size === 1 && categories.has('standard')) return 'Rolling';

  const hasClothing = categories.has('clothing');
  const hasAudio = categories.has('audio');

  if (hasClothing && hasAudio) return 'Both';
  if (hasClothing) return 'Welle 1';
  if (hasAudio) return 'Welle 2';

  // Standard mixed with school clothing or audio
  if (categories.has('standard')) {
    if (hasClothing) return 'Welle 1';
    if (hasAudio) return 'Welle 2';
  }

  // No physical items recognized (digital-only order)
  return null;
}
```

**Step 2: Commit**

```bash
git add src/lib/config/variantClassification.ts
git commit -m "feat: add variant classification config for shipment wave auto-computation"
```

---

### Task 1.3: Add shipment_wave Field to Airtable Types

**Files:**
- Modify: `src/lib/types/airtable.ts`

**Context:** A new `shipment_wave` single-select field must be created in the Airtable Orders table. The field ID will be assigned by Airtable when created.

**Step 1: Add field to Airtable types**

In `src/lib/types/airtable.ts`, find the Orders table field definitions and add:

```typescript
// In the ORDERS field IDs section, add:
shipment_wave: 'fldXXXXXXXXXXXXXX', // TODO: Replace with actual field ID after creating in Airtable
```

**Step 2: Update the ShopifyOrder interface**

Find the `ShopifyOrder` interface and add:

```typescript
shipment_wave?: 'Welle 1' | 'Welle 2' | 'Both' | 'Rolling';
```

**Step 3: Create the field in Airtable**

**MANUAL STEP:** Go to Airtable → Orders table → Add field:
- Name: `shipment_wave`
- Type: Single select
- Options: `Welle 1`, `Welle 2`, `Both`, `Rolling`
- Copy the field ID back into the types file

**Step 4: Commit**

```bash
git add src/lib/types/airtable.ts
git commit -m "feat: add shipment_wave field to Orders Airtable schema"
```

---

## Phase 2: Task Service Updates

### Task 2.1: Update Task Generation for New Timeline

**Files:**
- Modify: `src/lib/services/taskService.ts`

**Context:** Currently `generateTasksForEvent()` uses templates from `src/lib/config/taskTemplates.ts` (old system: poster_letter at -58, flyer1 at -42, etc.). We need to update it to use the new `TASK_TIMELINE` config from `src/lib/config/taskTimeline.ts` (poster at -45, flyer1 at -43, etc.).

**IMPORTANT:** Read the existing `generateTasksForEvent()` method first. It creates tasks in Airtable with fields: `template_id`, `event_id`, `task_type`, `task_name`, `description`, `completion_type`, `timeline_offset`, `deadline`, `status`.

**Step 1: Read the current implementation**

Read `src/lib/services/taskService.ts` fully — understand the `generateTasksForEvent()` flow.

**Step 2: Add new generation method**

Add a new method `generateTasksForEventV2()` that uses the new timeline config. Keep the old method for backward compatibility. The new method:

- Imports `TASK_TIMELINE` from `src/lib/config/taskTimeline.ts`
- Maps `TaskPrefix` to Airtable `task_type` values:
  - `Ship` → `paper_order` (reuse existing)
  - `Order` → `clothing_order` (reuse existing)
  - `Shipment` → `shipping` (reuse existing)
  - `Audio` → `cd_master` or `cd_production` (reuse existing)
- Maps `TaskCompletionType` to Airtable `completion_type` values:
  - `monetary` → `monetary`
  - `orchestrated` → `checkbox` (closest existing type)
  - `tracklist` → `submit_only` (closest existing type)
  - `quantity_checkbox` → `checkbox`
- Creates all 11 tasks with correct `template_id`, `timeline_offset`, `deadline`
- Does NOT create automatic shipping child tasks (Welle 1/2 replace the old auto-shipping)

**Step 3: Add matrix data fetching method**

Add `getTaskMatrix()` method to TaskService:

```typescript
async getTaskMatrix(filters?: { dateFrom?: string; dateTo?: string; search?: string }): Promise<TaskMatrixRow[]>
```

This method:
1. Fetches all tasks with status != cancelled
2. Groups by event_id
3. For each event, builds a `TaskMatrixRow` with cells keyed by template_id
4. Computes `cellStatus` for each cell:
   - `green` if status === 'completed'
   - `grey` if status === 'cancelled'
   - `red` if deadline passed and status === 'pending'
   - `yellow` if deadline within 3 days and status === 'pending'
   - `white` otherwise
5. Returns rows sorted by urgency (most red/yellow cells first)

**Step 4: Add date-grouped fetching method**

Add `getTasksByDate()` method:

```typescript
async getTasksByDate(dateFrom: string, dateTo: string): Promise<Record<string, TaskWithEventDetails[]>>
```

This method:
1. Fetches pending tasks with deadlines in the date range
2. Groups by deadline date (YYYY-MM-DD)
3. Returns a Record keyed by date string

**Step 5: Commit**

```bash
git add src/lib/services/taskService.ts
git commit -m "feat: add task generation V2 with new timeline, matrix and date-grouped fetching"
```

---

### Task 2.2: Add Welle Completion Logic to Task Service

**Files:**
- Modify: `src/lib/services/taskService.ts`
- Create: `src/lib/services/fulfillmentService.ts`

**Context:** When a Welle task is completed (design doc Section 6), the system must call Shopify's Fulfillment API. This is the orchestration layer.

**Step 1: Read existing Shopify admin service**

Read `src/lib/services/shopifyAdminService.ts` to understand how GraphQL calls are made to Shopify.

**Step 2: Create fulfillment service**

Create `src/lib/services/fulfillmentService.ts`:

```typescript
// Shopify fulfillment orchestration for Welle 1/2
// Design doc: docs/plans/2026-03-09-task-system-overhaul-design.md, Section 8

export interface FulfillmentResult {
  orderId: string;
  orderNumber: string;
  success: boolean;
  error?: string;
  fulfillmentId?: string;
}

export interface WelleFulfillmentSummary {
  total: number;
  succeeded: number;
  failed: number;
  results: FulfillmentResult[];
}

export class FulfillmentService {
  /**
   * Fulfill all orders for a given event and wave.
   * - Welle 1: fulfills clothing line items only (partial for "Both" orders)
   * - Welle 2: fulfills audio line items only (completes "Both" orders)
   */
  async fulfillWelle(eventRecordId: string, welle: 'Welle 1' | 'Welle 2'): Promise<WelleFulfillmentSummary>

  /**
   * Fulfill a single order on Shopify.
   * Uses Shopify Admin GraphQL fulfillmentCreateV2 mutation.
   * For partial fulfillment, only includes specified line item IDs.
   */
  private async fulfillOrder(shopifyOrderId: string, lineItemIds?: string[]): Promise<FulfillmentResult>

  /**
   * Get fulfillment order ID and line items from Shopify for a given order.
   * Required before creating fulfillments.
   */
  private async getFulfillmentOrder(shopifyOrderId: string): Promise<{ fulfillmentOrderId: string; lineItems: Array<{ id: string; variantId: string; remainingQuantity: number }> }>
}
```

**Key Shopify GraphQL mutations needed:**

1. `fulfillmentOrders` query — get fulfillment order ID for a Shopify order
2. `fulfillmentCreateV2` mutation — create fulfillment with specific line items

**IMPORTANT:** Look up the exact Shopify Admin API v2025-01 schema for these mutations. The existing `shopifyAdminService.ts` already has the Shopify GraphQL client setup — reuse the same authentication pattern.

**Step 3: Wire Welle completion into task service**

In `taskService.ts`, update `completeTask()` to handle orchestrated completion type:

- When template_id is `shipment_welle_1` or `shipment_welle_2`:
  - Call `fulfillmentService.fulfillWelle(eventId, wave)`
  - If all orders fulfilled successfully → mark task complete
  - If some failed → return failure details, keep task pending
  - Store `WelleFulfillmentSummary` in `completion_data` JSON

**Step 4: Commit**

```bash
git add src/lib/services/fulfillmentService.ts src/lib/services/taskService.ts
git commit -m "feat: add fulfillment service for Welle orchestration with Shopify API"
```

---

### Task 2.3: Add Master CD and CD Production Completion Logic

**Files:**
- Modify: `src/lib/services/taskService.ts`
- Create: `src/lib/services/masterCdService.ts`

**Context:** Design doc Section 7 defines the Master CD tracklist assembly and CD Production quantity display.

**Step 1: Create Master CD service**

Create `src/lib/services/masterCdService.ts`:

```typescript
// Master CD tracklist assembly service
// Design doc: docs/plans/2026-03-09-task-system-overhaul-design.md, Section 7
//
// Data flow:
// Songs table (album_order) → AudioFiles table (song_id → r2_key) → R2 (audio files)

export interface MasterCdTrack {
  trackNumber: number;          // From album_order
  songId: string;               // Songs table record ID
  title: string;                // Songs.title (fldLjwkTwckDqT3Xl)
  className: string;            // From linked Classes table
  audioFileId?: string;         // AudioFiles record ID
  r2Key?: string;               // AudioFiles.r2_key (fldvzj75CspwfOfPX)
  durationSeconds?: number;     // AudioFiles.duration_seconds (fldNzuiQghH3FhmdU)
  status: 'ready' | 'pending' | 'processing' | 'error' | 'missing';
  downloadUrl?: string;         // Signed R2 URL (generated on request)
}

export interface MasterCdData {
  eventId: string;
  schoolName: string;
  tracks: MasterCdTrack[];
  allReady: boolean;            // True only if ALL tracks have status 'ready'
  readyCount: number;
  totalCount: number;
}

export class MasterCdService {
  /**
   * Get tracklist data for Master CD task.
   *
   * 1. Fetch songs for event via TeacherService.getSongsByEventId()
   * 2. Sort by album_order (fldj1xXfAhsaWcEE7)
   * 3. Fetch audio files via TeacherService.getAudioFilesByEventId()
   * 4. Match audio files to songs via song_id field
   * 5. Only include type='final' and check status='ready'
   * 6. Return MasterCdData with tracks and readiness status
   */
  async getTracklist(eventId: string): Promise<MasterCdData>

  /**
   * Generate signed R2 download URLs for all ready tracks.
   * Returns URLs with numbered filename format: "1. Song Title - Class Name.mp3"
   */
  async getDownloadUrls(eventId: string): Promise<Array<{ trackNumber: number; filename: string; url: string }>>

  /**
   * Check if Master CD can be completed (all tracks ready).
   */
  async canComplete(eventId: string): Promise<boolean>
}
```

**Step 2: Add CD quantity helper**

Add to `taskService.ts` or create inline:

```typescript
/**
 * Get CD order quantity for an event.
 * Counts all audio/CD variant line items from Orders table for this event.
 */
async getCdQuantityForEvent(eventRecordId: string): Promise<number>
```

This queries the Orders table filtered by `event_id` and sums quantities for audio variants.

**Step 3: Commit**

```bash
git add src/lib/services/masterCdService.ts src/lib/services/taskService.ts
git commit -m "feat: add Master CD tracklist service and CD quantity helper"
```

---

### Task 2.4: Add Order Wave Service

**Files:**
- Create: `src/lib/services/orderWaveService.ts`

**Context:** Design doc Section 6 defines the Orders page data needs. This service groups orders by event and wave, provides fulfillment summaries, and handles wave overrides.

**Step 1: Create order wave service**

Create `src/lib/services/orderWaveService.ts`:

```typescript
// Order wave service — groups orders by event and shipment wave
// Design doc: docs/plans/2026-03-09-task-system-overhaul-design.md, Section 6
//
// Data source: Airtable Orders table (tblu9AGaLSoEVwqq7)
// Wave field: shipment_wave (auto-computed, manually overridable)

import type { ShipmentWave } from '@/lib/types/tasks';

export interface OrderLineItem {
  variantId: string;
  productTitle: string;
  variantTitle?: string;
  quantity: number;
  price: number;
  total: number;
  waveCategory: 'clothing' | 'audio' | 'standard' | 'unknown';
}

export interface WaveOrder {
  recordId: string;             // Airtable record ID
  orderId: string;              // Shopify order GID
  orderNumber: string;          // Display number (#1001)
  customerName: string;         // From linked parent
  schoolName: string;
  shipmentWave: ShipmentWave;
  fulfillmentStatus: string;    // pending, partial, fulfilled
  paymentStatus: string;
  totalAmount: number;
  orderDate: string;
  lineItems: OrderLineItem[];
  // Full Shopify mirror fields:
  shippingAddress?: object;
  customerNotes?: string;
  discountCodes?: string[];
  parentId?: string;
  eventId?: string;
  classId?: string;
}

export interface EventWaveSummary {
  eventRecordId: string;
  eventId: string;
  schoolName: string;
  eventDate: string;
  welle1: {
    deadline: string;           // eventDate + offset(-9)
    orderCount: number;
    itemSummary: Record<string, number>; // e.g. { "T-Shirt M": 5, "Hoodie S": 3 }
    fulfillmentStatus: 'unfulfilled' | 'partial' | 'fulfilled';
    orders: WaveOrder[];
  };
  welle2: {
    deadline: string;           // eventDate + offset(+14)
    orderCount: number;
    itemSummary: Record<string, number>;
    fulfillmentStatus: 'unfulfilled' | 'partial' | 'fulfilled';
    orders: WaveOrder[];
  };
}

export class OrderWaveService {
  /**
   * Get all events with their wave summaries for the Orders landing page.
   */
  async getEventWaveSummaries(): Promise<EventWaveSummary[]>

  /**
   * Get detailed orders for a specific event, split by wave.
   * Orders with wave='Both' appear in both welle1 and welle2,
   * with only relevant line items in each.
   */
  async getEventOrders(eventRecordId: string): Promise<EventWaveSummary>

  /**
   * Override the shipment wave for a specific order.
   * Updates the shipment_wave field in Airtable.
   */
  async overrideWave(orderRecordId: string, newWave: ShipmentWave): Promise<void>

  /**
   * Auto-compute and set shipment_wave for an order based on line items.
   * Called from orders-paid webhook.
   */
  async autoClassifyOrder(orderRecordId: string, lineItems: OrderLineItem[]): Promise<ShipmentWave | null>
}
```

**Step 2: Commit**

```bash
git add src/lib/services/orderWaveService.ts
git commit -m "feat: add order wave service for event-centric wave grouping"
```

---

## Phase 3: API Routes

### Task 3.1: Tasks Matrix & Date API Endpoints

**Files:**
- Create: `src/app/api/admin/tasks/matrix/route.ts`
- Create: `src/app/api/admin/tasks/by-date/route.ts`
- Create: `src/app/api/admin/tasks/events/[eventId]/route.ts`

**Context:** These endpoints power the new Tasks page views (design doc Sections 3, 4, 5).

**Step 1: Create matrix endpoint**

`GET /api/admin/tasks/matrix`

Query params: `dateFrom`, `dateTo`, `search`

Returns: `{ success: true, data: { rows: TaskMatrixRow[] } }`

Must use `requireAdmin` middleware (see existing task routes for pattern).

**Step 2: Create by-date endpoint**

`GET /api/admin/tasks/by-date`

Query params: `dateFrom`, `dateTo`

Returns: `{ success: true, data: { tasksByDate: Record<string, TaskWithEventDetails[]> } }`

**Step 3: Create per-event detail endpoint**

`GET /api/admin/tasks/events/[eventId]`

Returns: `{ success: true, data: { event: EventInfo, timeline: TaskWithEventDetails[], welle1Summary: WaveSummary, welle2Summary: WaveSummary } }`

This endpoint provides everything needed for the per-event detail view.

**Step 4: Commit**

```bash
git add src/app/api/admin/tasks/matrix/route.ts src/app/api/admin/tasks/by-date/route.ts src/app/api/admin/tasks/events/
git commit -m "feat: add API endpoints for task matrix, date view, and per-event detail"
```

---

### Task 3.2: Master CD & CD Production API Endpoints

**Files:**
- Create: `src/app/api/admin/tasks/[taskId]/tracklist/route.ts`
- Create: `src/app/api/admin/tasks/[taskId]/download/route.ts`
- Create: `src/app/api/admin/tasks/[taskId]/cd-quantity/route.ts`

**Context:** Design doc Section 7. Master CD needs tracklist data and download URLs. CD Production needs order quantity.

**Step 1: Create tracklist endpoint**

`GET /api/admin/tasks/[taskId]/tracklist`

Returns: `{ success: true, data: MasterCdData }`

Verifies the task is a `audio_master_cd` template before proceeding. Calls `masterCdService.getTracklist()`.

**Step 2: Create download endpoint**

`GET /api/admin/tasks/[taskId]/download`

Returns: `{ success: true, data: { tracks: Array<{ trackNumber, filename, url }> } }`

Returns signed R2 URLs for all ready tracks. Staff-side zip generation (or individual downloads).

**Step 3: Create CD quantity endpoint**

`GET /api/admin/tasks/[taskId]/cd-quantity`

Returns: `{ success: true, data: { quantity: number } }`

Counts audio/CD variant line items from all orders linked to this event.

**Step 4: Commit**

```bash
git add src/app/api/admin/tasks/\[taskId\]/tracklist src/app/api/admin/tasks/\[taskId\]/download src/app/api/admin/tasks/\[taskId\]/cd-quantity
git commit -m "feat: add API endpoints for Master CD tracklist and CD Production quantity"
```

---

### Task 3.3: Orders Page API Endpoints

**Files:**
- Create: `src/app/api/admin/orders/events/route.ts`
- Create: `src/app/api/admin/orders/events/[eventId]/route.ts`
- Create: `src/app/api/admin/orders/events/[eventId]/fulfill/route.ts`
- Create: `src/app/api/admin/orders/[orderId]/wave/route.ts`

**Context:** Design doc Section 6. The Orders page needs event list, per-event split-screen data, fulfill-all, and wave override.

**Step 1: Create events list endpoint**

`GET /api/admin/orders/events`

Returns: `{ success: true, data: { events: EventWaveSummary[] } }`

**Step 2: Create per-event orders endpoint**

`GET /api/admin/orders/events/[eventId]`

Returns: `{ success: true, data: EventWaveSummary }` (with full order details in each wave)

**Step 3: Create fulfill endpoint**

`POST /api/admin/orders/events/[eventId]/fulfill`

Body: `{ welle: 'Welle 1' | 'Welle 2' }`

Returns: `{ success: true, data: WelleFulfillmentSummary }`

Calls `fulfillmentService.fulfillWelle()`. This is the orchestration trigger.

**Step 4: Create wave override endpoint**

`PATCH /api/admin/orders/[orderId]/wave`

Body: `{ shipment_wave: ShipmentWave }`

Returns: `{ success: true }`

Updates `shipment_wave` in Airtable for the specified order.

**Step 5: Commit**

```bash
git add src/app/api/admin/orders/
git commit -m "feat: add Orders page API endpoints with fulfillment orchestration"
```

---

### Task 3.4: Update orders-paid Webhook for Wave Auto-Classification

**Files:**
- Modify: `src/app/api/webhooks/shopify/orders-paid/route.ts`

**Context:** Design doc Section 8. When a new order is paid, auto-compute `shipment_wave` and store it.

**Step 1: Read the existing webhook**

Read `src/app/api/webhooks/shopify/orders-paid/route.ts` fully.

**Step 2: Add wave classification**

After the order record is created in Airtable (the existing `createRecord` call), add:

```typescript
import { computeShipmentWave } from '@/lib/config/variantClassification';

// After creating the order record...
const wave = computeShipmentWave(lineItems);
if (wave) {
  // Update the order record with shipment_wave
  await airtable.updateRecord('Orders', orderRecordId, {
    shipment_wave: wave,
  });
}
```

**IMPORTANT:** The field ID for `shipment_wave` must be set in `airtable.ts` first (Task 1.3).

**Step 3: Commit**

```bash
git add src/app/api/webhooks/shopify/orders-paid/route.ts
git commit -m "feat: auto-compute shipment_wave on order creation in orders-paid webhook"
```

---

## Phase 4: Tasks Page — UI Components

### Task 4.1: Update Admin Navigation

**Files:**
- Modify: `src/app/admin/layout.tsx`

**Context:** Add "Orders" as a new sidebar item after "Tasks".

**Step 1: Read the layout file**

Read `src/app/admin/layout.tsx`.

**Step 2: Add Orders nav item**

In the `navigation` array, add after the Tasks entry:

```typescript
{ name: 'Orders', href: '/admin/orders', icon: '📋' },
```

Choose an icon that distinguishes it from Tasks (✅). Suggested: 📋 or 🛍️.

**Step 3: Commit**

```bash
git add src/app/admin/layout.tsx
git commit -m "feat: add Orders to admin sidebar navigation"
```

---

### Task 4.2: Build Task Matrix Component

**Files:**
- Create: `src/components/admin/tasks/TaskMatrix.tsx`
- Create: `src/components/admin/tasks/TaskMatrixCell.tsx`
- Create: `src/components/admin/tasks/TaskMatrixPopover.tsx`

**Context:** Design doc Section 3. Cross-event matrix with color-coded cells.

**Step 1: Create TaskMatrixCell component**

Props: `cell: TaskMatrixCell`, `templateId: string`, `onAction: (action, taskId) => void`

Renders:
- Colored div based on `cellStatus`: white/yellow/red/green/grey
- Click handler opens popover

Cell color mapping (use Tailwind classes):
- `white` → `bg-white border border-gray-200`
- `yellow` → `bg-yellow-100 border border-yellow-400`
- `red` → `bg-red-100 border border-red-400`
- `green` → `bg-green-100 border border-green-400`
- `grey` → `bg-gray-100 border border-gray-300`

**Step 2: Create TaskMatrixPopover component**

Props: `cell: TaskMatrixCell`, `templateId: string`, `eventId: string`

Shows on cell click:
- Task display name (from `TASK_TIMELINE` config by templateId)
- Deadline date
- Quick-complete button (for monetary/checkbox tasks)
- "View event details" link → `/admin/tasks/[eventId]`
- Cancel/skip option

Use a popover pattern (absolute positioned div with click-outside-to-close).

**Step 3: Create TaskMatrix component**

Props: `rows: TaskMatrixRow[]`, `isLoading: boolean`

Renders:
- Horizontal scrollable `<table>`
- Sticky first column (event info: school name, event date, progress)
- Header row with task display names and offsets from `TASK_TIMELINE`
- Body rows from `TaskMatrixRow[]`
- Each cell renders `TaskMatrixCell`
- Loading state: skeleton rows

**Step 4: Commit**

```bash
git add src/components/admin/tasks/TaskMatrix.tsx src/components/admin/tasks/TaskMatrixCell.tsx src/components/admin/tasks/TaskMatrixPopover.tsx
git commit -m "feat: build cross-event task matrix component with color-coded cells"
```

---

### Task 4.3: Build Task Date View Component

**Files:**
- Create: `src/components/admin/tasks/TaskDateView.tsx`
- Create: `src/components/admin/tasks/TaskDateGroup.tsx`

**Context:** Design doc Section 4. Date-grouped workload view with This Week / This Month toggle.

**Step 1: Create TaskDateGroup component**

Props: `date: string`, `tasks: TaskWithEventDetails[]`, `onTaskAction: (action, task) => void`

Renders:
- Date header (formatted: "Monday, 10 Mar")
- List of tasks for that date, each showing:
  - Status dot (color matches cell status logic)
  - Task display name (e.g. "Ship: Poster")
  - School name
  - Overdue indicator if past deadline

**Step 2: Create TaskDateView component**

Props: none (fetches its own data)

State:
- `viewMode`: 'week' | 'month'
- `currentDate`: Date (for navigation)
- `tasksByDate`: Record<string, TaskWithEventDetails[]>

Features:
- Toggle buttons: "This Week" | "This Month"
- Prev/Next navigation arrows to scroll through weeks/months
- Calculates date range based on viewMode + currentDate
- Fetches from `GET /api/admin/tasks/by-date?dateFrom=X&dateTo=Y`
- Renders `TaskDateGroup` for each date in range
- Empty dates show "(no tasks)" in muted text

**Step 3: Commit**

```bash
git add src/components/admin/tasks/TaskDateView.tsx src/components/admin/tasks/TaskDateGroup.tsx
git commit -m "feat: build date-grouped task view with week/month toggle"
```

---

### Task 4.4: Build Per-Event Detail View

**Files:**
- Create: `src/app/admin/tasks/[eventId]/page.tsx`
- Create: `src/components/admin/tasks/EventDetailTimeline.tsx`
- Create: `src/components/admin/tasks/EventWelleBreakdown.tsx`

**Context:** Design doc Section 5. Three-panel layout: event info bar, horizontal timeline, order breakdown.

**Step 1: Create EventDetailTimeline component**

Props: `tasks: TaskWithEventDetails[]`, `eventDate: string`

Renders:
- Horizontal timeline line
- Event day marker at center
- Task dots positioned relative to event date
- Each dot is color-coded (green/white/yellow/red/grey)
- Click dot → expand below to show task details / completion form
- For `audio_master_cd` → shows tracklist UI (Task 4.6)
- For `audio_cd_production` → shows quantity UI (Task 4.7)
- For `shipment_welle_*` → shows Welle completion UI (Task 4.8)

**Step 2: Create EventWelleBreakdown component**

Props: `eventId: string`

Renders:
- Two-column layout: Welle 1 | Welle 2
- Each column shows: deadline, order count, item summary, fulfillment status
- Expandable to individual orders
- "View in Orders" link → `/admin/orders/[eventId]`

Fetches from `GET /api/admin/tasks/events/[eventId]`

**Step 3: Create per-event page**

`src/app/admin/tasks/[eventId]/page.tsx`:
- Fetches event data from API
- Renders three panels: EventInfoBar, EventDetailTimeline, EventWelleBreakdown
- Back button to return to matrix/date view

**Step 4: Commit**

```bash
git add src/app/admin/tasks/\[eventId\]/ src/components/admin/tasks/EventDetailTimeline.tsx src/components/admin/tasks/EventWelleBreakdown.tsx
git commit -m "feat: build per-event detail view with timeline and Welle breakdown"
```

---

### Task 4.5: Rebuild Tasks Page with View Toggle

**Files:**
- Modify: `src/app/admin/tasks/page.tsx`

**Context:** Replace the old three-view (Pending/Incoming/Completed) page with the new structure: By Event | By Date toggle, plus Incoming Orders and Completed tabs.

**Step 1: Read the current page**

Read `src/app/admin/tasks/page.tsx` fully.

**Step 2: Restructure the page**

New view modes: `'by-event' | 'by-date' | 'incoming' | 'completed'`

Layout:
- Top: View toggle buttons (By Event | By Date | Incoming Orders | Completed)
- Content area renders the appropriate component:
  - `by-event` → `<TaskMatrix />`
  - `by-date` → `<TaskDateView />`
  - `incoming` → `<IncomingOrdersView />` (existing, keep as-is)
  - `completed` → `<CompletedTasksView />` (existing, keep as-is)

Default view: `by-event`

**Step 3: Commit**

```bash
git add src/app/admin/tasks/page.tsx
git commit -m "feat: rebuild Tasks page with By Event matrix and By Date calendar views"
```

---

### Task 4.6: Build Master CD Completion UI

**Files:**
- Create: `src/components/admin/tasks/MasterCdCompletion.tsx`

**Context:** Design doc Section 7. Tracklist assembly with preview, download, and completion.

**Step 1: Create MasterCdCompletion component**

Props: `taskId: string`, `eventId: string`, `onComplete: () => void`

State:
- `tracklist: MasterCdData | null`
- `isLoading`, `isDownloading`

Fetch: `GET /api/admin/tasks/[taskId]/tracklist`

Renders:
- Header: "Album Tracklist — [School Name] ([N] tracks)"
- Table with columns: #, Song Title, Class, Duration, Status, Play
- Status column: ✅ Ready (green) | ⏳ Processing (yellow) | ❌ Missing (red)
- Play button: generates signed URL for preview
- "Download All" button: fetches `/api/admin/tasks/[taskId]/download`, triggers browser download
  - Available regardless of completion status (staff can prep early)
- "Mark Complete" button: ONLY enabled when `allReady === true`
  - Calls `PATCH /api/admin/tasks/[taskId]` with completion data
  - Disabled with tooltip "All tracks must be ready" if not ready

**Step 2: Commit**

```bash
git add src/components/admin/tasks/MasterCdCompletion.tsx
git commit -m "feat: build Master CD tracklist completion UI"
```

---

### Task 4.7: Build CD Production Completion UI

**Files:**
- Create: `src/components/admin/tasks/CdProductionCompletion.tsx`

**Context:** Design doc Section 7. Simple quantity display with checkbox.

**Step 1: Create CdProductionCompletion component**

Props: `taskId: string`, `eventId: string`, `onComplete: () => void`

Fetch: `GET /api/admin/tasks/[taskId]/cd-quantity`

Renders:
- Header: "CD Production — [School Name]"
- Large number display: "CDs Ordered: **31**"
- "Mark Complete" button

**Step 2: Commit**

```bash
git add src/components/admin/tasks/CdProductionCompletion.tsx
git commit -m "feat: build CD Production quantity display and completion UI"
```

---

### Task 4.8: Build Welle Completion UI

**Files:**
- Create: `src/components/admin/tasks/WelleCompletion.tsx`

**Context:** Design doc Section 6. Review orders, then "Fulfill All" triggers Shopify.

**Step 1: Create WelleCompletion component**

Props: `taskId: string`, `eventId: string`, `welle: 'Welle 1' | 'Welle 2'`, `onComplete: () => void`

State:
- `orders: WaveOrder[]`
- `fulfillmentResult: WelleFulfillmentSummary | null`
- `isFulfilling: boolean`

Fetch: `GET /api/admin/orders/events/[eventId]`
Filter orders to the relevant wave.

Renders:
- Header: "Shipment: Welle 1 — [School Name]"
- Order list with line items (only items for this wave)
- Order count summary
- "Fulfill All Welle [N]" button (teal, prominent)
  - Click → confirmation dialog: "This will create fulfillments on Shopify for [N] orders. Continue?"
  - Calls `POST /api/admin/orders/events/[eventId]/fulfill` with `{ welle }`
  - Shows progress during fulfillment
  - On completion: shows summary (X succeeded, Y failed)
  - If all succeeded → auto-completes the task
  - If some failed → shows failed orders with retry option

**Step 2: Commit**

```bash
git add src/components/admin/tasks/WelleCompletion.tsx
git commit -m "feat: build Welle fulfillment completion UI with Shopify orchestration"
```

---

## Phase 5: Orders Page — UI Components

### Task 5.1: Build Orders Event List (Landing Page)

**Files:**
- Create: `src/app/admin/orders/page.tsx`
- Create: `src/components/admin/orders/OrdersEventList.tsx`
- Create: `src/components/admin/orders/EventWaveCard.tsx`

**Context:** Design doc Section 6. Event-centric landing with Welle 1/2 summary cards.

**Step 1: Create EventWaveCard component**

Props: `event: EventWaveSummary`

Renders:
- School name, event date
- Two side-by-side panels: Welle 1 | Welle 2
- Each panel: deadline date, order count, item summary, fulfillment status badge
- Click → navigates to `/admin/orders/[eventId]`

**Step 2: Create OrdersEventList component**

Props: none (fetches own data)

State:
- `events: EventWaveSummary[]`
- `search: string`
- Filters: fulfillment status, date range

Fetch: `GET /api/admin/orders/events`

Renders:
- Search bar (order number, customer name, school)
- Filter dropdowns
- Grid of `EventWaveCard` components

**Step 3: Create Orders page**

`src/app/admin/orders/page.tsx`:
- Standard admin page with `requireAdmin`
- Renders `<OrdersEventList />`

**Step 4: Commit**

```bash
git add src/app/admin/orders/ src/components/admin/orders/
git commit -m "feat: build Orders landing page with event wave summary cards"
```

---

### Task 5.2: Build Orders Event Detail (Split-Screen Welle View)

**Files:**
- Create: `src/app/admin/orders/[eventId]/page.tsx`
- Create: `src/components/admin/orders/OrdersEventDetail.tsx`
- Create: `src/components/admin/orders/WelleColumn.tsx`
- Create: `src/components/admin/orders/OrderCard.tsx`

**Context:** Design doc Section 6. Split-screen showing Welle 1 and Welle 2 orders side by side.

**Step 1: Create OrderCard component**

Props: `order: WaveOrder`, `onWaveOverride: (orderId, wave) => void`

Renders:
- Order number + customer name
- Line items for this wave only
- Click to expand: full Shopify mirror details
  - Shipping address, customer notes, discount codes
  - Payment status, total amount
  - Fulfillment timeline
  - Wave override dropdown (Welle 1 / Welle 2 / Both / Rolling)

**Step 2: Create WelleColumn component**

Props: `title: string`, `deadline: string`, `orders: WaveOrder[]`, `fulfillmentStatus: string`, `onFulfillAll: () => void`

Renders:
- Header: "Welle 1" with deadline date
- Fulfillment status badge
- Order count
- List of `OrderCard` components
- "Fulfill All Welle [N]" button at bottom

**Step 3: Create OrdersEventDetail component**

Props: `eventId: string`

Fetch: `GET /api/admin/orders/events/[eventId]`

Renders:
- Back button to Orders landing
- Event info header (school name, event date)
- Two-column layout: `<WelleColumn />` for Welle 1 and Welle 2
- Both columns scroll independently

**Step 4: Create page**

`src/app/admin/orders/[eventId]/page.tsx`:
- Extract eventId from params
- Render `<OrdersEventDetail eventId={eventId} />`

**Step 5: Commit**

```bash
git add src/app/admin/orders/\[eventId\]/ src/components/admin/orders/OrdersEventDetail.tsx src/components/admin/orders/WelleColumn.tsx src/components/admin/orders/OrderCard.tsx
git commit -m "feat: build Orders split-screen Welle view with order details"
```

---

### Task 5.3: Build Wave Override & Fulfillment Controls

**Files:**
- Create: `src/components/admin/orders/WaveOverrideControl.tsx`
- Create: `src/components/admin/orders/FulfillmentButton.tsx`

**Context:** Design doc Section 6. Manual wave override per order and "Fulfill All" with progress/error display.

**Step 1: Create WaveOverrideControl component**

Props: `currentWave: ShipmentWave`, `orderId: string`, `onOverride: (newWave) => void`

Renders:
- Dropdown/select with options: Welle 1, Welle 2, Both, Rolling
- Current selection highlighted
- On change → calls `PATCH /api/admin/orders/[orderId]/wave`
- Shows loading spinner during API call

**Step 2: Create FulfillmentButton component**

Props: `eventId: string`, `welle: 'Welle 1' | 'Welle 2'`, `orderCount: number`, `onComplete: (result) => void`

State:
- `isConfirming`, `isFulfilling`, `result: WelleFulfillmentSummary | null`

Renders:
- Teal "Fulfill All Welle [N]" button with order count
- Confirmation dialog on click
- Progress state during fulfillment (spinner, "Fulfilling X of Y orders...")
- Result display: green success or red/yellow partial failure with failed order list
- Retry button for failed orders

**Step 3: Commit**

```bash
git add src/components/admin/orders/WaveOverrideControl.tsx src/components/admin/orders/FulfillmentButton.tsx
git commit -m "feat: build wave override control and fulfillment button with progress tracking"
```

---

## Phase 6: Webhook & Migration

### Task 6.1: Backfill shipment_wave on Existing Orders

**Files:**
- Create: `scripts/backfill-shipment-wave.ts`

**Context:** Existing orders in Airtable don't have `shipment_wave` set. We need a one-time migration script.

**Step 1: Create migration script**

```typescript
// scripts/backfill-shipment-wave.ts
// One-time script to set shipment_wave on all existing orders
//
// Usage: npx ts-node scripts/backfill-shipment-wave.ts
//
// Logic:
// 1. Fetch all orders from Airtable Orders table
// 2. Parse line_items JSON for each order
// 3. Classify using computeShipmentWave()
// 4. Update orders that have a computable wave

import { computeShipmentWave } from '../src/lib/config/variantClassification';
// ... Airtable client setup
```

The script should:
- Process in batches of 10 (Airtable rate limits)
- Log progress: "Processing order #1042... → Welle 1"
- Skip orders that already have a wave set
- Dry-run mode with `--dry-run` flag

**Step 2: Commit**

```bash
git add scripts/backfill-shipment-wave.ts
git commit -m "feat: add migration script to backfill shipment_wave on existing orders"
```

---

### Task 6.2: Map Old Tasks to New Template IDs

**Files:**
- Create: `scripts/migrate-task-templates.ts`

**Context:** Existing tasks in Airtable have old template_ids (poster_letter, flyer1, etc.). They need to be mapped to new IDs and have their deadlines recalculated.

**Step 1: Create migration script**

Template ID mapping:
```typescript
const TEMPLATE_MAPPING: Record<string, string> = {
  'poster_letter': 'ship_poster',
  'flyer1': 'ship_flyer_1',
  'flyer2': 'ship_flyer_2',
  'flyer3': 'ship_flyer_3',
  'minicard': 'order_minicard',
  'order_schul_shirts': 'order_schul_clothing',
};

// New tasks with no old equivalent (must be created for existing events):
// - order_schul_clothing_2 (+7)
// - shipment_welle_1 (-9)
// - shipment_welle_2 (+14)
// - audio_master_cd (+11)
// - audio_cd_production (+12)
```

The script should:
1. Update `template_id` fields for existing tasks
2. Recalculate `timeline_offset` and `deadline` based on new offsets
3. Create missing tasks (new types) for events that are still pending/upcoming
4. Log all changes
5. Support `--dry-run`

**Step 2: Commit**

```bash
git add scripts/migrate-task-templates.ts
git commit -m "feat: add migration script to map old task templates to new timeline"
```

---

## Phase 7: Integration & Testing

### Task 7.1: End-to-End Welle Fulfillment Test

**Files:**
- Manual testing steps

**Step 1: Test Welle 1 fulfillment flow**

1. Create a test event with tasks generated using new timeline
2. Complete Ship/Order tasks up to Welle 1
3. Verify orders appear correctly in Orders page split-screen
4. Click "Fulfill All Welle 1"
5. Verify Shopify orders are partially fulfilled (clothing only)
6. Verify Airtable orders updated via webhook
7. Verify task marked as complete

**Step 2: Test Welle 2 fulfillment flow**

1. Complete tasks through to Welle 2
2. Verify remaining audio items show in Welle 2 column
3. Click "Fulfill All Welle 2"
4. Verify mixed orders now fully fulfilled on Shopify
5. Verify audio-only orders fulfilled
6. Verify task marked as complete

**Step 3: Test error scenarios**

1. Disconnect Shopify API → verify error handling
2. Test partial failure (some orders fulfill, some fail)
3. Verify retry mechanism works for failed orders

---

### Task 7.2: Test Master CD Flow

**Step 1: Test tracklist display**

1. Navigate to a test event's per-event detail view
2. Click Master CD task
3. Verify tracks display in album_order sequence
4. Verify status column shows correct audio file status

**Step 2: Test download**

1. Click "Download All"
2. Verify files download with numbered prefix format
3. Verify download works even when some tracks aren't ready

**Step 3: Test completion blocking**

1. With tracks missing audio → verify "Mark Complete" is disabled
2. With all tracks ready → verify "Mark Complete" is enabled
3. Complete task → verify it appears green in matrix

---

### Task 7.3: Test Matrix & Date Views

**Step 1: Test matrix view**

1. Verify events appear as rows with correct cell colors
2. Test cell click → popover with quick actions
3. Test quick-complete from popover
4. Verify cell turns green after completion
5. Test sorting (urgency, date, name)
6. Test filters (date range, search)
7. Test horizontal scroll with sticky event column

**Step 2: Test date view**

1. Toggle to "By Date" view
2. Verify tasks grouped by deadline date across events
3. Test "This Week" / "This Month" toggle
4. Test prev/next navigation
5. Verify overdue tasks show on original date with red styling

---

## Execution Order Summary

| Phase | Tasks | Dependencies |
|-------|-------|-------------|
| **Phase 1: Data Model** | 1.1, 1.2, 1.3 | None — start here |
| **Phase 2: Services** | 2.1, 2.2, 2.3, 2.4 | Phase 1 complete |
| **Phase 3: API Routes** | 3.1, 3.2, 3.3, 3.4 | Phase 2 complete |
| **Phase 4: Tasks UI** | 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8 | Phase 3 complete |
| **Phase 5: Orders UI** | 5.1, 5.2, 5.3 | Phase 3 complete (can parallel with Phase 4) |
| **Phase 6: Migration** | 6.1, 6.2 | Phases 1-2 complete (can run anytime after) |
| **Phase 7: Testing** | 7.1, 7.2, 7.3 | All phases complete |

**Parallelizable:** Phase 4 (Tasks UI) and Phase 5 (Orders UI) can be built in parallel since they share only API endpoints, not components.
