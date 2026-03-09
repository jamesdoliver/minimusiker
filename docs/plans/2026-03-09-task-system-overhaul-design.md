# Task System Overhaul — Design Document

**Date:** 2026-03-09
**Status:** Draft

---

## Overview

Complete overhaul of the task management system. Replaces the single Tasks page with two top-level admin pages: **Tasks** (operational workflow engine) and **Orders** (fulfillment dashboard). Introduces a new task timeline, cross-event matrix, date-grouped workload view, Shopify fulfillment orchestration, and new task types including audio/CD workflows.

---

## 1. Navigation & Page Structure

### Current
- Single "Tasks" sidebar item → three-view page (Pending / Incoming Orders / Completed)

### New
Two top-level sidebar items:

**Tasks** (`/admin/tasks`)
- Landing view toggle: **By Event** (matrix) | **By Date** (calendar)
- Click-through: per-event detail view (`/admin/tasks/[eventId]`)
- Tabs: Incoming Orders (GO-IDs), Completed Tasks

**Orders** (`/admin/orders`)
- Event-centric fulfillment dashboard
- Per-event split-screen: Welle 1 | Welle 2
- Full Shopify mirror with orchestration

---

## 2. Task Timeline — 11 Tasks

| # | Task | Prefix | Offset | Completion Type | Creates GO-ID |
|---|------|--------|--------|----------------|---------------|
| 1 | Ship: Poster | Ship | -45 | Monetary (cost entry, optional invoice) | Yes |
| 2 | Ship: Flyer 1 | Ship | -43 | Monetary | Yes |
| 3 | Order: Schul Clothing | Order | -18 | Monetary | Yes |
| 4 | Ship: Flyer 2 | Ship | -18 | Monetary | Yes |
| 5 | Ship: Flyer 3 | Ship | -10 | Monetary | Yes |
| 6 | Shipment: Welle 1 | Shipment | -9 | Orchestrated (Shopify fulfillment) | No |
| 7 | Order: Minicard | Order | +5 | Monetary | Yes |
| 8 | Order: Schul Clothing 2 | Order | +7 | Monetary | Yes |
| 9 | Audio: Master CD | Audio | +11 | Tracklist assembly + download | No |
| 10 | Audio: CD Production | Audio | +12 | Quantity display + checkbox | No |
| 11 | Ship: Welle 2 | Shipment | +14 | Orchestrated (Shopify fulfillment) | No |

### Task prefix categories

- **Ship** — Outbound print materials to school/supplier. Monetary completion with optional invoice upload.
- **Order** — Supplier orders (clothing, minicards). Monetary completion with optional invoice upload.
- **Audio** — In-house audio/CD work. Custom completion UIs (see Section 7).
- **Shipment** — Batch customer fulfillment waves. Triggers Shopify fulfillment API.

### Key timeline notes

- **Order: Schul Clothing 2 (+7):** Cutoff for school-specific clothing. Late/additional orders placed between event day and +7 are batched into a second supplier order. After +7, parents can only order standard MiniMusiker-branded items (Rolling cycle).
- **Shipment: Welle 1 (-9):** Ships clothing items from customer orders. Mixed orders (clothing + audio) are partially fulfilled — clothing ships, audio stays unfulfilled.
- **Ship: Welle 2 (+14):** Ships remaining audio items. Completes fulfillment for mixed orders that were partially fulfilled in Welle 1. Audio-only orders are fully fulfilled here.
- Invoice upload is optional on all task types.

---

## 3. Tasks Page — By Event View (Cross-Event Matrix)

### Layout
- **Top bar:** Filter controls (date range, school search, status filter)
- **Below:** Horizontally scrollable table

### Structure

| Event Info (sticky) | Ship: Poster -45 | Ship: Fly1 -43 | Order: Cloth -18 | Ship: Fly2 -18 | Ship: Fly3 -10 | Ship: W1 -9 | Order: Mini +5 | Order: Cloth2 +7 | Audio: Master +11 | Audio: CD Prod +12 | Ship: W2 +14 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| GS Sonnenberg, 15 Mar | 🟢 | 🟢 | 🟢 | 🟢 | 🔴 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Waldschule Essen, 22 Mar | 🟢 | 🟢 | 🟡 | 🟡 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

### Event info column (frozen/sticky on horizontal scroll)
- School name
- Event date
- Overall progress indicator (e.g. "5/11 complete")

### Cell states
- ⬜ **White** — No action yet (deadline is far out)
- 🟡 **Yellow** — Due within 3 days
- 🔴 **Red** — At or past deadline, action needed
- 🟢 **Green** — Completed
- ⚫ **Grey** — Cancelled/skipped

### Cell interaction
Click cell → popover with:
- Task name and deadline date
- Quick-complete button (for simple tasks)
- "View event details" link
- Cancel/skip option

### Row sorting
- Default: most urgent first (event with most red/yellow cells at top)
- Toggleable: by event date, by school name

---

## 4. Tasks Page — By Date View (Workload Calendar)

Answers the question: "What do I need to do today / this week / this month?"

### Layout
- Toggle: **This Week** (default) | **This Month**
- Navigation: Previous/next controls to scroll through weeks and months
- Tasks grouped by date, collated across all events

### Example — This Week

```
Monday, 10 Mar
  🔴 Ship: Poster — GS Sonnenberg (overdue by 2 days)
  🔴 Ship: Fly1 — Waldschule Essen (overdue by 1 day)

Tuesday, 11 Mar
  🟡 Order: Schul Clothing — KGS Am Rheindorf
  🟡 Ship: Fly2 — GS Sonnenberg

Wednesday, 12 Mar
  (no tasks)

Thursday, 13 Mar
  ⬜ Ship: Fly3 — Waldschule Essen
  ⬜ Audio: Master CD — Bergschule Mitte

Friday, 14 Mar
  ⬜ Shipment: Welle 1 — KGS Am Rheindorf
```

### Overdue tasks
Shown on their original deadline date with red styling. No sticky/pinned section — keeps the calendar chronologically accurate.

### This Month view
Scrollable month calendar. Each day shows task count and color indicators. Click a day to expand and see all tasks for that date.

---

## 5. Per-Event Detail View (`/admin/tasks/[eventId]`)

Accessible by clicking an event row from the matrix or date view.

### Layout — three panels

**Top: Event Info Bar**
- School name, event date, address, contact
- Overall progress (e.g. "5/11 tasks complete")
- Quick link to booking view

**Middle: Visual Timeline**
- Horizontal timeline centered on event day (day 0)
- Each task plotted at its real date with color-coded dot
- Pre-event tasks left of center, post-event tasks right
- Click a task dot → expands to show completion details or completion form
- Master CD task opens the tracklist/download UI
- CD Production shows quantity and complete button

**Bottom: Order Breakdown**
- Two columns: Welle 1 | Welle 2
- Each shows order count, item summary, fulfillment status
- Expandable to individual orders with line items
- Links through to the full Orders page filtered to this event

---

## 6. Orders Page (`/admin/orders`)

Full Shopify-mirror fulfillment dashboard. Separate top-level sidebar item.

### Landing view — Event list

Each event card shows at a glance:
- School name, event date
- Welle 1 panel: deadline date, order count, item summary, fulfillment status
- Welle 2 panel: deadline date, order count, item summary, fulfillment status

### Filters
- Search by order number, customer name, school
- Filter by event, shipment wave, fulfillment status, date range

### Click event → Split-screen Welle 1 | Welle 2

```
┌─ Welle 1 ──────────────────┬─ Welle 2 ──────────────────┐
│ Deadline: 6 Mar 2026       │ Deadline: 29 Mar 2026      │
│ Status: ⬜ Unfulfilled      │ Status: ⬜ Unfulfilled      │
│                            │                            │
│ Order #1042 — Müller       │ Order #1042 — Müller       │
│  2x T-Shirt M              │  1x CD                     │
│  1x Hoodie S               │                            │
│                            │ Order #1055 — Schmidt      │
│ Order #1048 — Weber        │  2x CD                     │
│  1x T-Shirt L              │                            │
│                            │ Order #1048 — Weber        │
│ "Fulfill All Welle 1" [→]  │  1x CD                     │
└────────────────────────────┴────────────────────────────┘
```

Mixed orders (Both) appear in both columns — clothing items under Welle 1, audio items under Welle 2.

### Per-order detail (click an order)
Full Shopify mirror:
- Shipping address, customer notes, discount codes
- Order metafields (parent_id, event_id, class_id)
- Line items with individual wave assignment
- Fulfillment timeline (when each partial fulfillment happened)
- Payment status, total amount
- Manual wave override control

### "Fulfill All" orchestration
- "Fulfill All Welle 1" → calls Shopify Fulfillment API:
  - `Welle 1` orders: full fulfillment
  - `Both` orders: partial fulfillment (clothing line items only)
- "Fulfill All Welle 2" → calls Shopify Fulfillment API:
  - `Welle 2` orders: full fulfillment
  - `Both` orders: fulfill remaining audio line items

---

## 7. Audio Task Completion UIs

### Audio: Master CD (+11) — Tracklist Assembly

**Purpose:** Assemble recorded audio files into album order for in-house CD burning.

**Data sources:**
- Songs table → `album_order` field (set by teachers via AlbumLayoutModal drag-drop)
- AudioFiles table → `song_id` link, `r2_key`, `type='final'`, `status='ready'`
- R2 storage → actual audio files

**UI:**
```
Audio: Master CD — GS Sonnenberg
Event: 15 Mar 2026 | Due: 26 Mar 2026

Album Tracklist (4 tracks)
─────────────────────────────────────────────
 #  │ Song Title          │ Class        │ Duration │ Status   │ ▶
 1  │ Unsere Schule       │ Klasse 2a    │ 3:12     │ ✅ Ready │ ▶
 2  │ Freunde             │ Klasse 3b    │ 2:48     │ ✅ Ready │ ▶
 3  │ Sonnenschein        │ Klasse 1a    │ 3:01     │ ✅ Ready │ ▶
 4  │ Alle Kinder         │ Alle Kinder  │ 4:15     │ ✅ Ready │ ▶

                              [Download All]  [Mark Complete]
```

**"Download All"** generates a zip with numbered files:
```
1. Unsere Schule - Klasse 2a.mp3
2. Freunde - Klasse 3b.mp3
3. Sonnenschein - Klasse 1a.mp3
4. Alle Kinder - Alle Kinder.mp3
```

**Completion rules:**
- Task can only be marked complete when ALL tracks have `status: ready` audio files
- "Download All" is always available regardless of completion status (staff can preview/prep early)
- Tracks missing audio are flagged with a warning status

### Audio: CD Production (+12) — Quantity & Confirm

**Purpose:** Staff produces CDs in-house. Shows how many to burn.

**UI:**
```
Audio: CD Production — GS Sonnenberg
Event: 15 Mar 2026 | Due: 27 Mar 2026

CDs Ordered: 31

                              [Mark Complete]
```

- Displays total CD quantity ordered for this event (from Shopify orders)
- Simple checkbox completion — no cost entry, no GO-ID
- No supplier involved (in-house production)

---

## 8. Shopify Integration & Data Model

### Airtable Orders table — new field

**`shipment_wave`** — Single select: `Welle 1` | `Welle 2` | `Both` | `Rolling`

- **Auto-computed** in the `orders-paid` webhook when order is created:
  - Classify line items by variant (clothing → Welle 1, audio → Welle 2)
  - All clothing → `Welle 1`
  - All audio → `Welle 2`
  - Mixed → `Both`
  - Standard MiniMusiker-branded (non-schul) → `Rolling`
- **Manually overridable** by staff from the Orders UI

### Sync architecture

```
Shopify ──webhooks──→ Airtable Orders ←──reads──── Orders Page UI
                           ↑                            │
                      updates status              "Fulfill All"
                           │                            │
                           └────── Shopify Fulfillment API ←─────┘
```

- **Read path:** Orders page reads from Airtable (already synced via existing webhooks)
- **Write path:** Staff clicks "Fulfill All Welle 1" → calls Shopify Fulfillment API → Shopify fires `orders-updated` webhook → Airtable status auto-updates
- **No separate data store needed.** Airtable is the middleman.

### Fulfillment orchestration

When "Fulfill All" is triggered for a wave:
1. Fetch all orders for event with matching `shipment_wave`
2. For each order, call Shopify Fulfillment API:
   - `Welle 1` / `Welle 2` orders: fulfill all line items
   - `Both` orders: fulfill only the relevant line items (clothing for W1, audio for W2)
3. Track success/failure per order
4. Failed orders flagged in Orders view for manual retry
5. Task stays incomplete until all orders are fulfilled (or manually marked as handled)
6. Shopify fires `orders-updated` webhook → Airtable fulfillment_status auto-syncs

### Error handling
- If a fulfillment call fails mid-batch, system records which orders succeeded and which failed
- Failed orders are visually flagged in the Orders view
- Staff can retry individual failed orders or retry the entire batch
- Existing `orders-updated` webhook handles the return sync automatically

---

## 9. Task Templates — Updated Configuration

```typescript
const TASK_TIMELINE = [
  { id: 'ship_poster',          prefix: 'Ship',     name: 'Poster',          offset: -45, completion: 'monetary', creates_go_id: true },
  { id: 'ship_flyer_1',         prefix: 'Ship',     name: 'Flyer 1',         offset: -43, completion: 'monetary', creates_go_id: true },
  { id: 'order_schul_clothing', prefix: 'Order',    name: 'Schul Clothing',  offset: -18, completion: 'monetary', creates_go_id: true },
  { id: 'ship_flyer_2',         prefix: 'Ship',     name: 'Flyer 2',         offset: -18, completion: 'monetary', creates_go_id: true },
  { id: 'ship_flyer_3',         prefix: 'Ship',     name: 'Flyer 3',         offset: -10, completion: 'monetary', creates_go_id: true },
  { id: 'shipment_welle_1',     prefix: 'Shipment', name: 'Welle 1',         offset:  -9, completion: 'orchestrated', creates_go_id: false },
  { id: 'order_minicard',       prefix: 'Order',    name: 'Minicard',        offset:  +5, completion: 'monetary', creates_go_id: true },
  { id: 'order_schul_clothing_2', prefix: 'Order',  name: 'Schul Clothing 2', offset: +7, completion: 'monetary', creates_go_id: true },
  { id: 'audio_master_cd',      prefix: 'Audio',    name: 'Master CD',       offset: +11, completion: 'tracklist', creates_go_id: false },
  { id: 'audio_cd_production',  prefix: 'Audio',    name: 'CD Production',   offset: +12, completion: 'quantity_checkbox', creates_go_id: false },
  { id: 'shipment_welle_2',     prefix: 'Shipment', name: 'Welle 2',         offset: +14, completion: 'orchestrated', creates_go_id: false },
];
```

### Completion types

- **monetary** — Enter supplier cost (required), upload invoice (optional). Creates GO-ID.
- **orchestrated** — Review order list, "Fulfill All" triggers Shopify fulfillment API. No GO-ID.
- **tracklist** — Fetch songs by album_order, display with audio status, download all as numbered zip. Blocked until all audio ready.
- **quantity_checkbox** — Display quantity from Shopify orders, simple checkbox to mark complete.

---

## 10. Migration Considerations

### Data migration
- Existing tasks in Airtable need `template_id` values mapped to new task IDs
- Timeline offsets updated for existing pending tasks (recalculate deadlines)
- New `shipment_wave` field added to Airtable Orders table
- Existing orders backfilled with auto-computed wave classification

### Backward compatibility
- Old task types (`paper_order`, `clothing_order`, `standard_clothing_order`, `shipping`) mapped to new prefix system
- Completed tasks retain their original data for audit history
- GO-ID system unchanged — still created for supplier orders

### New webhook logic
- `orders-paid` webhook updated to auto-compute `shipment_wave` on order creation
- Variant classification config needed: which variant IDs are clothing vs. audio

---

## 11. File Structure (Anticipated)

```
src/
├── app/admin/
│   ├── tasks/
│   │   ├── page.tsx                    # Matrix + Date view toggle
│   │   └── [eventId]/
│   │       └── page.tsx                # Per-event detail view
│   └── orders/
│       ├── page.tsx                    # Event list with Welle summaries
│       └── [eventId]/
│           └── page.tsx                # Split-screen Welle 1 | Welle 2
├── components/admin/
│   ├── tasks/
│   │   ├── TaskMatrix.tsx              # Cross-event matrix grid
│   │   ├── TaskMatrixCell.tsx          # Individual cell with color + popover
│   │   ├── TaskDateView.tsx           # By Date calendar view
│   │   ├── TaskDateGroup.tsx          # Day group with task list
│   │   ├── EventTimeline.tsx          # Per-event horizontal timeline
│   │   ├── MasterCdCompletion.tsx     # Tracklist assembly UI
│   │   ├── CdProductionCompletion.tsx # Quantity display + checkbox
│   │   ├── WelleCompletion.tsx        # Order review + Fulfill All
│   │   └── ... (existing components adapted)
│   └── orders/
│       ├── OrdersEventList.tsx        # Landing: event cards with Welle summaries
│       ├── OrdersEventDetail.tsx      # Split-screen Welle 1 | Welle 2
│       ├── OrderCard.tsx              # Individual order with line items
│       ├── OrderDetailPanel.tsx       # Full Shopify mirror per order
│       ├── WaveOverrideControl.tsx    # Manual shipment_wave override
│       └── FulfillmentButton.tsx      # "Fulfill All" with progress/error UI
├── lib/
│   ├── config/
│   │   ├── taskTimeline.ts            # New 11-task timeline config
│   │   └── variantClassification.ts   # Variant → wave mapping
│   ├── services/
│   │   ├── taskService.ts             # Updated with new task types
│   │   ├── fulfillmentService.ts      # NEW: Shopify fulfillment orchestration
│   │   └── orderWaveService.ts        # NEW: Wave classification + order grouping
│   └── types/
│       ├── tasks.ts                   # Updated task types
│       └── orders.ts                  # Updated with shipment_wave
└── app/api/
    ├── admin/
    │   ├── tasks/                     # Updated endpoints
    │   └── orders/                    # NEW: Orders page API
    │       ├── route.ts               # Event list with wave summaries
    │       ├── [eventId]/
    │       │   ├── route.ts           # Orders for event by wave
    │       │   └── fulfill/
    │       │       └── route.ts       # Fulfill All orchestration endpoint
    │       └── [orderId]/
    │           └── wave/
    │               └── route.ts       # Manual wave override
    └── webhooks/shopify/
        └── orders-paid/route.ts       # Updated: auto-compute shipment_wave
```
