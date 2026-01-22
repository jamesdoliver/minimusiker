# Clothing Order Tasks Feature Design

## Overview

Add a clothing order task view to the admin portal that aggregates Shopify clothing orders by event and surfaces them for processing 18 days before the event date. Staff can view order summaries, see detailed breakdowns, mark orders complete with supplier costs, and upload invoices later.

## Requirements

### Business Rules
- **Order Day**: 18 days before event date (deadline to place supplier order)
- **Visibility Window**: Cards appear 3 days before Order Day (21 days before event)
- **Urgency**: Cards show countdown, turn orange on Order Day, red when overdue
- **Completion Required**: Cards stay visible until explicitly marked complete
- **Clothing Items**: Filtered by Shopify product tags `custom-shirt` and `custom-hoodie` (identified via variant IDs)

### User Stories
1. As an admin, I can see upcoming clothing orders grouped by event with urgency indicators
2. As an admin, I can expand a card to see aggregated item counts by type and size
3. As an admin, I can view individual order details with customer information
4. As an admin, I can mark an order complete by entering the supplier cost
5. As an admin, I can filter completed tasks by type and upload invoices later

---

## Data Architecture

### Existing Tables Used

**Orders Table** (`tblu9AGaLSoEVwqq7`)
- `line_items`: JSON array with Shopify variant codes
- `booking_id`: Event ID in `evt_` format
- `event_id`: Linked record to Events table
- `class_id`: Linked record to Classes table
- `total_amount`: Order revenue
- `order_date`: When order was placed

**Events Table** (`tblVWx1RrsGRjsNn5`)
- `event_id`: Primary identifier
- `event_date`: Used to calculate Order Day
- `school_name`: Display name

**Tasks Table** (`tblf59JyawJjgDqPJ`)
- Clothing completion records stored with `task_type: 'clothing_order'`
- One task per event (created when admin marks complete)
- `completion_data`: JSON with `{ amount: number, notes?: string, invoice_r2_key?: string }`

**GuesstimateOrders Table** (`tblvNKyWN47i4blkr`)
- GO-ID created on completion for cost tracking
- Links supplier cost to event for analytics

### New Configuration (Code Only)

**Clothing Variant Config** (`/src/lib/config/clothingVariants.ts`)
- Hardcoded mapping of Shopify variant IDs to item type and size
- Enables filtering clothing items from `line_items` JSON

```typescript
export const CLOTHING_VARIANTS: Record<string, { type: 'tshirt' | 'hoodie'; size: string }> = {
  // T-Shirt (Personalisiert) - Product ID: 10663662747994
  '53328502194522': { type: 'tshirt', size: '98/104' },
  '53328502227290': { type: 'tshirt', size: '110/116' },
  '53328502260058': { type: 'tshirt', size: '122/128' },
  '53328502292826': { type: 'tshirt', size: '134/146' },
  '53328502325594': { type: 'tshirt', size: '152/164' },
  // Hoodie (Personalisiert) - Product ID: 10664195916122
  '53328494788954': { type: 'hoodie', size: '116' },
  '53328494821722': { type: 'hoodie', size: '128' },
  '53328494854490': { type: 'hoodie', size: '140' },
  '53328494887258': { type: 'hoodie', size: '152' },
  '53328494920026': { type: 'hoodie', size: '164' },
};
```

---

## UI Components

### 1. Pending Clothing Orders View

**Location**: Tasks page, "Clothing Orders" tab

**Query Logic**:
```
Show events where:
- today >= event_date - 21 days (within visibility window)
- Event has at least one order with clothing line items
- No completed clothing_order task exists for this event
```

**Sorting**: By urgency (overdue first, then by days remaining ascending)

### 2. ClothingOrderCard (Accordion)

**Closed State**:
```
┌─────────────────────────────────────────────────────────┐
│ [URGENCY BADGE]                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ {School Name}              Event: {DD MMM YYYY}    │ │
│ │ {X} orders - {€XXX.XX} revenue                  ▼  │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Urgency Badge Styling**:
- `3 days` / `2 days` / `1 day`: Gray background
- `Order Day`: Orange background
- `X days overdue`: Red background, red card border

**Expanded State**:
```
┌─────────────────────────────────────────────────────────┐
│ {School Name}                    Event: {DD MMM YYYY}  │
│ {X} orders - {€XXX.XX} revenue                      ▲  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   T-Shirts              Hoodies                        │
│   ──────────            ────────                       │
│   98/104:   {n}         116:    {n}                    │
│   110/116:  {n}         128:    {n}                    │
│   122/128:  {n}         140:    {n}                    │
│   134/140:  {n}         152:    {n}                    │
│   146/152:  {n}         164:    {n}                    │
│                                                         │
│   Total: {n}            Total: {n}                     │
│                                                         │
│  [View Order List]              [Mark Complete]        │
└─────────────────────────────────────────────────────────┘
```

### 3. ClothingOrderListModal

**Triggered by**: "View Order List" button

```
┌─────────────────────────────────────────────────────────────┐
│  Clothing Orders - {School Name}                         ✕  │
│  Event: {DD MMM YYYY} - {X} orders - {€XXX.XX} total       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Search by name or order #...                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ #{order_number} - {DD MMM YYYY}            {€XX.XX} │   │
│  │ {Parent Name} -> {Child Name(s)}                    │   │
│  │ {Item} ({Size}) x{Qty}, {Item} ({Size}) x{Qty}     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ... (scrollable list)                                     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                              [Close]        │
└─────────────────────────────────────────────────────────────┘
```

**Order Details Shown**:
- Order number + order date + order total
- Parent name -> Child name(s)
- Clothing line items with size and quantity

**Features**:
- Search by parent name, child name, or order number
- Sorted by order date (newest first)

### 4. ClothingOrderCompletionModal

**Triggered by**: "Mark Complete" button

```
┌─────────────────────────────────────────────────────────────┐
│  Complete Clothing Order                                 ✕  │
│  {School Name} - {DD MMM YYYY}                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Order Summary                                              │
│  ─────────────                                              │
│  T-Shirts: {n} items                                       │
│  Hoodies:  {n} items                                       │
│  Customer Revenue: {€XXX.XX}                               │
│                                                             │
│  Supplier Order Cost (EUR) *                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Notes (optional)                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ This will create:                                   │   │
│  │   - GO-ID for supplier order tracking               │   │
│  │   - Task record in Completed Tasks                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                        [Cancel]  [Complete Order]          │
└─────────────────────────────────────────────────────────────┘
```

**On Completion Creates**:

1. **Task Record** (`clothing_order` type):
   - `event_id`: linked
   - `status`: 'completed'
   - `completed_at`: current timestamp
   - `completion_data`: `{ amount, notes }`
   - `order_ids`: comma-separated Shopify order IDs

2. **GuesstimateOrder Record**:
   - `event_id`: linked
   - `order_amount`: supplier cost
   - `order_ids`: same as task
   - `contains`: JSON of aggregated items

### 5. Completed Tasks Enhancements

**Task Type Filter**:
```
┌──────────────────┐
│ All Types      ▼ │
├──────────────────┤
│ All Types        │
│ Paper Orders     │
│ Clothing Orders  │
│ Shipping         │
│ CD Master        │
│ CD Production    │
└──────────────────┘
```

**Invoice Column in Table**:
```
┌────────┬──────────────────┬────────────┬─────────┬──────────┬───────────┐
│ Task # │ School           │ Type       │ Amount  │ Date     │ Invoice   │
├────────┼──────────────────┼────────────┼─────────┼──────────┼───────────┤
│ TSK-42 │ Grundschule Park │ Clothing   │ €187.50 │ 23 Jan   │ [Upload]  │
├────────┼──────────────────┼────────────┼─────────┼──────────┼───────────┤
│ TSK-41 │ Maria Schule     │ Clothing   │ €94.20  │ 22 Jan   │ View      │
└────────┴──────────────────┴────────────┴─────────┴──────────┴───────────┘
```

**Invoice States**:
- `[Upload]`: No invoice, click to upload file
- `View`: Invoice exists, click to view/download

**Invoice Storage**: R2 at `invoices/{task_id}/{filename}`

---

## API Endpoints

### New Endpoints

#### GET `/api/admin/tasks/clothing-orders`

Returns pending clothing order aggregations.

**Response**:
```typescript
{
  events: [
    {
      event_id: string;
      event_record_id: string;
      school_name: string;
      event_date: string;
      days_until_order_day: number;  // negative = overdue
      is_overdue: boolean;
      total_orders: number;
      total_revenue: number;
      aggregated_items: {
        tshirts: { [size: string]: number };
        hoodies: { [size: string]: number };
      };
      order_ids: string[];
    }
  ]
}
```

#### GET `/api/admin/tasks/clothing-orders/[eventId]/orders`

Returns individual orders for modal display.

**Response**:
```typescript
{
  orders: [
    {
      order_id: string;
      order_number: string;
      order_date: string;
      total_amount: number;
      parent_name: string;
      child_names: string[];
      clothing_items: [
        { type: 'tshirt' | 'hoodie', size: string, quantity: number }
      ]
    }
  ]
}
```

#### POST `/api/admin/tasks/clothing-orders/[eventId]/complete`

Marks clothing order as complete.

**Request**:
```typescript
{
  amount: number;
  notes?: string;
  order_ids: string[];
}
```

**Response**:
```typescript
{
  task_id: string;
  go_id: string;
}
```

#### POST `/api/admin/tasks/[taskId]/invoice`

Uploads invoice to R2.

**Request**: `FormData` with file

**Response**:
```typescript
{
  invoice_url: string;
}
```

### Modified Endpoints

#### GET `/api/admin/tasks`

Add `type` query parameter to filter completed tasks by task type.

**New Query Param**: `?type=clothing_order`

---

## File Structure

### New Files

```
src/
├── lib/
│   └── config/
│       └── clothingVariants.ts          # Variant ID -> item type/size mapping
│
├── components/
│   └── admin/
│       └── tasks/
│           ├── ClothingOrderCard.tsx        # Accordion card component
│           ├── ClothingOrderListModal.tsx   # Order details popup
│           ├── ClothingOrderCompletionModal.tsx  # Complete with cost
│           ├── ClothingOrdersView.tsx       # Container for pending cards
│           ├── InvoiceUploadButton.tsx      # Upload/view invoice
│           └── TaskTypeFilter.tsx           # Dropdown filter for completed
│
├── app/
│   └── api/
│       └── admin/
│           └── tasks/
│               ├── clothing-orders/
│               │   ├── route.ts             # GET pending aggregations
│               │   └── [eventId]/
│               │       ├── orders/
│               │       │   └── route.ts     # GET individual orders
│               │       └── complete/
│               │           └── route.ts     # POST mark complete
│               └── [taskId]/
│                   └── invoice/
│                       └── route.ts         # POST upload invoice
```

### Modified Files

```
src/
├── components/
│   └── admin/
│       └── tasks/
│           ├── TaskQueue.tsx            # Add ClothingOrdersView for clothing tab
│           └── CompletedTasksTable.tsx  # Add type filter + invoice column
│
├── app/
│   └── api/
│       └── admin/
│           └── tasks/
│               └── route.ts             # Add type filter param
```

---

## Implementation Order

### Phase 1: Data Foundation
1. Create `clothingVariants.ts` with variant ID mappings
2. Add `type` query param to existing `GET /api/admin/tasks`

### Phase 2: Pending View
3. Create `GET /api/admin/tasks/clothing-orders` endpoint
4. Create `ClothingOrderCard.tsx` accordion component
5. Create `ClothingOrdersView.tsx` container
6. Integrate into `TaskQueue.tsx` for clothing tab

### Phase 3: Order Details Modal
7. Create `GET /api/admin/tasks/clothing-orders/[eventId]/orders` endpoint
8. Create `ClothingOrderListModal.tsx`

### Phase 4: Completion Flow
9. Create `POST /api/admin/tasks/clothing-orders/[eventId]/complete` endpoint
10. Create `ClothingOrderCompletionModal.tsx`

### Phase 5: Completed Tasks Enhancements
11. Create `TaskTypeFilter.tsx` dropdown
12. Create `InvoiceUploadButton.tsx` component
13. Create `POST /api/admin/tasks/[taskId]/invoice` endpoint
14. Update `CompletedTasksTable.tsx` with filter + invoice column

---

## Prerequisites

All prerequisites have been gathered:

- **T-Shirt Variant IDs**: 53328502194522 (98/104), 53328502227290 (110/116), 53328502260058 (122/128), 53328502292826 (134/146), 53328502325594 (152/164)
- **Hoodie Variant IDs**: 53328494788954 (116), 53328494821722 (128), 53328494854490 (140), 53328494887258 (152), 53328494920026 (164)

---

## Summary

This feature adds clothing order management to the existing task system by:

1. Dynamically aggregating Shopify orders with clothing items by event
2. Surfacing them 3 days before the 18-day order deadline
3. Providing clear urgency indicators (gray -> orange -> red)
4. Showing aggregated item counts in an accordion view
5. Allowing drill-down to individual orders via modal
6. Requiring supplier cost entry to mark complete
7. Creating GO-ID records for cost tracking
8. Enabling invoice upload after completion
9. Adding task type filtering to completed tasks view
