# MiniMusiker Integration Guide

This guide explains how to connect the Analytics and Stock sections with external services: Shopify, Airtable, and Flyeralarm.

---

## Table of Contents

1. [Overview](#overview)
2. [Current State](#current-state)
3. [Environment Variables](#environment-variables)
4. [Airtable Setup](#airtable-setup)
5. [Shopify Setup](#shopify-setup)
6. [Analytics Integration](#analytics-integration)
7. [Stock Integration](#stock-integration)
8. [API Endpoints](#api-endpoints)
9. [Data Flow Diagrams](#data-flow-diagrams)
10. [Implementation Checklist](#implementation-checklist)
11. [Claude Code Implementation Prompts](#claude-code-implementation-prompts)

---

## Overview

The MiniMusiker admin tool consists of several integrated sections:

| Section | Purpose | Data Sources |
|---------|---------|--------------|
| **Analytics** | Event performance tracking | Airtable (events), Shopify (revenue), Stock (costs) |
| **Stock** | Inventory & order management | Airtable (inventory), Flyeralarm API (orders) |
| **Events** | Event management | Airtable (parent_journey_table) |

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      MiniMusiker Admin                          │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Analytics     │     Stock       │         Events              │
│                 │                 │                             │
│  ┌───────────┐  │  ┌───────────┐  │  ┌───────────────────────┐  │
│  │ Revenue   │  │  │ Inventory │  │  │ parent_journey_table  │  │
│  │ (Shopify) │  │  │ (Airtable)│  │  │      (Airtable)       │  │
│  └─────┬─────┘  │  └─────┬─────┘  │  └───────────┬───────────┘  │
│        │        │        │        │              │              │
│  ┌─────┴─────┐  │  ┌─────┴─────┐  │              │              │
│  │ Costs     │  │  │ Orders    │  │              │              │
│  │ (Stock DB)│  │  │(Flyeralarm│  │              │              │
│  └───────────┘  │  └───────────┘  │              │              │
└─────────────────┴─────────────────┴──────────────┴──────────────┘
                           │
              ┌────────────┴────────────┐
              │    External Services    │
              ├─────────────────────────┤
              │  Airtable  │  Shopify   │
              │  Flyeralarm│  SendGrid  │
              └─────────────────────────┘
```

---

## Current State

### What's Working (Real Data)

| Feature | Data Source | Status |
|---------|-------------|--------|
| Event list | Airtable `parent_journey_table` | ✅ Live |
| Event details | Airtable | ✅ Live |
| Registration counts | Airtable | ✅ Live |
| Staff assignments | Airtable `Personen` table | ✅ Live |

### What's Mocked (Needs Integration)

| Feature | Current State | Target Integration |
|---------|---------------|-------------------|
| **Revenue** | Random €500-€3000 | Shopify orders API |
| **Variable Costs** | Random quantities | Stock inventory database |
| **Stock Inventory** | In-memory mock data | Airtable `stock_inventory` table |
| **Stock Orders** | In-memory mock data | Airtable `stock_orders` or Flyeralarm API |

---

## Environment Variables

Copy `.env.local.example` to `.env.local` and configure:

### Airtable (Required)

```env
# Get from: https://airtable.com/create/tokens
AIRTABLE_API_KEY=pat_XXXXXXXXXXXX

# Get from: Your Airtable base URL (airtable.com/appXXXXXXXXX)
AIRTABLE_BASE_ID=appXXXXXXXXX
```

### Shopify (Required for Revenue)

```env
# Your Shopify store domain (without https://)
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com

# Storefront API token (for product queries)
# Get from: Shopify Admin > Apps > Develop apps > Storefront API
SHOPIFY_STOREFRONT_ACCESS_TOKEN=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Admin API token (for order queries)
# Get from: Shopify Admin > Apps > Develop apps > Admin API
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Webhook secret for order notifications
SHOPIFY_WEBHOOK_SECRET=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Feature flag to enable/disable Shopify integration
ENABLE_SHOPIFY_INTEGRATION=true
```

### Optional Services

```env
# Cloudflare R2 (for recording storage)
R2_ENDPOINT=https://[account-id].r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_key
R2_SECRET_ACCESS_KEY=your_secret
R2_BUCKET_NAME=school-recordings

# SendGrid (for email campaigns)
SENDGRID_API_KEY=SG.XXXXX
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

---

## Airtable Setup

### Existing Table: `parent_journey_table`

This is the main events table. Each row represents a parent-child-event registration.

#### Key Field IDs (for API queries)

```typescript
const AIRTABLE_FIELD_IDS = {
  booking_id: 'fldUB8dAiQd61VncB',      // Event identifier (school + date)
  school_name: 'fld2Rd4S9aWGOjkJI',
  booking_date: 'fldZx9CQHCvoqjJ71',    // Event date
  class_id: 'fldtiPDposZlSD2lm',        // Class identifier
  registered_child: 'flddZJuHdOqeighMf',
  parent_email: 'fldwiX1CSfJZS0AIz',
  parent_id: 'fld4mmx0n71PSr1JM',
  order_number: 'fldeYzYUhAWIZxFX3',     // Shopify order reference
  assigned_staff: 'fldf0OQES4ZPn6HAv',   // Links to Personen table
  total_children: 'fldonCg4373zaXQfM',
};
```

#### Relationship to Shopify

The `order_number` field stores Shopify order IDs (e.g., `#1234`). This links parent registrations to their purchases.

### New Table: `stock_inventory`

Create this table in Airtable for inventory management.

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `item` | Single Select | T-Shirt, Hoodie, Mug, Sport Bag, CD, Minicard |
| `size` | Single Select | 92, 98, 104, 116, 128, 140, 152, 164 (for T-Shirt/Hoodie only) |
| `in_stock` | Number | Current quantity in stock |
| `cost_per_unit` | Currency (€) | Base cost from supplier API |
| `cost_override` | Currency (€) | Admin override (leave empty to use base cost) |
| `last_updated` | Date | Timestamp of last sync/update |

#### Sample Records

| item | size | in_stock | cost_per_unit | cost_override | last_updated |
|------|------|----------|---------------|---------------|--------------|
| T-Shirt | 92 | 12 | €8.50 | | 2025-12-09 |
| T-Shirt | 98 | 8 | €8.50 | | 2025-12-09 |
| Hoodie | 128 | 5 | €18.00 | €17.50 | 2025-12-09 |
| Mug | | 25 | €6.50 | | 2025-12-09 |

### New Table: `stock_orders`

Create this table for tracking Flyeralarm orders.

| Field Name | Field Type | Description |
|------------|------------|-------------|
| `order_date` | Date | Monday of order week |
| `status` | Single Select | pending, placed, completed, failed |
| `total_items` | Number | Count of unique line item types |
| `total_quantity` | Number | Sum of all quantities |
| `total_cost` | Currency (€) | Total order cost |
| `cost_change_percent` | Number | % change vs previous week |
| `line_items` | Long Text | JSON array of line items (see schema below) |

#### Line Items JSON Schema

```json
[
  {
    "item": "T-Shirt",
    "size": "116",
    "quantity": 12,
    "unitCost": 8.50,
    "totalCost": 102.00,
    "shopifyOrderIds": ["#1001", "#1002"],
    "eventCodes": ["EVT-001"]
  }
]
```

---

## Shopify Setup

### Store Requirements

1. **Shopify Plan**: Basic or higher (for API access)
2. **Products**: Set up with proper variants for sizes
3. **Order Metadata**: Configure to capture event/booking IDs

### API Scopes Required

When creating your app in Shopify Admin > Apps > Develop apps:

**Storefront API Scopes:**
- `unauthenticated_read_product_listings`
- `unauthenticated_read_checkouts`
- `unauthenticated_write_checkouts`

**Admin API Scopes:**
- `read_orders`
- `read_products`
- `write_orders` (if creating orders programmatically)

### Order Metadata for Event Linking

When creating checkouts, include custom attributes to link orders to events:

```typescript
const customAttributes = {
  booking_id: 'evt_123',     // Links to Airtable event
  parent_id: 'parent_456',   // Links to parent record
  class_id: 'class_789',     // Links to specific class
};
```

The Shopify checkout mutation already supports this:

```graphql
mutation CheckoutCreate($input: CheckoutCreateInput!) {
  checkoutCreate(input: $input) {
    checkout {
      id
      webUrl
    }
  }
}
```

### Querying Orders by Event

To get revenue for a specific event, you'll need to:

1. Query Shopify Admin API for orders
2. Filter by custom attributes containing `booking_id`
3. Sum order totals

```typescript
// Example: Query orders for an event
const query = `
  query GetOrdersByEvent($query: String!) {
    orders(first: 100, query: $query) {
      edges {
        node {
          id
          name
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          customAttributes {
            key
            value
          }
        }
      }
    }
  }
`;

// Filter by booking_id in custom attributes
const variables = { query: "custom_attributes.booking_id:evt_123" };
```

---

## Analytics Integration

### Current Implementation

**File:** `src/app/admin/analytics/page.tsx`

The analytics page currently:
1. Fetches events from `/api/airtable/get-events`
2. Generates **filler data** for revenue and costs
3. Calculates profit = revenue - costs

### To Enable Real Revenue Data

1. **Enable Shopify Integration:**
   ```env
   ENABLE_SHOPIFY_INTEGRATION=true
   ```

2. **Update `transformToAnalyticsRow()` function:**

   Replace the filler revenue generation:
   ```typescript
   // Current (mocked)
   const revenue = generateFillerRevenue(); // €500-€3000 random

   // Target (real)
   const revenue = await getShopifyRevenueByEvent(event.eventId);
   ```

3. **Create Shopify revenue helper:**

   ```typescript
   // src/lib/services/shopifyService.ts

   async getOrdersByBookingId(bookingId: string): Promise<number> {
     // 1. Query Admin API for orders with booking_id
     // 2. Filter by custom attributes
     // 3. Sum totalPrice values
     // 4. Return total revenue
   }
   ```

### To Enable Real Cost Data

1. **Create stock inventory API route** (see [API Endpoints](#api-endpoints))

2. **Update `transformToAnalyticsRow()` function:**

   Replace the filler costs generation:
   ```typescript
   // Current (mocked)
   const variableCosts = generateFillerVariableCosts();

   // Target (real)
   const variableCosts = await getEventVariableCosts(event.eventId);
   ```

3. **Link stock to events:**

   Track which stock items were used for each event in Airtable, then query costs from `stock_inventory`.

---

## Stock Integration

### Inventory Management

**Files:**
- `src/app/admin/stock/page.tsx` - Main page
- `src/app/api/admin/stock/inventory/route.ts` - API route

#### Current Implementation (Mock)

```typescript
// In-memory cache with mock data
let inventoryCache: StockItem[] | null = null;

export async function GET() {
  if (!inventoryCache) {
    inventoryCache = generateMockInventory();
  }
  return NextResponse.json({ inventory: inventoryCache });
}
```

#### Target Implementation (Airtable)

```typescript
import Airtable from 'airtable';

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID!);

export async function GET() {
  const records = await base('stock_inventory').select().all();

  const inventory = records.map(record => ({
    id: record.id,
    item: record.fields.item,
    size: record.fields.size,
    inStock: record.fields.in_stock,
    costPerUnit: record.fields.cost_override || record.fields.cost_per_unit,
    baseCost: record.fields.cost_per_unit,
    costOverride: record.fields.cost_override,
    lastUpdated: record.fields.last_updated,
  }));

  return NextResponse.json({ inventory });
}

export async function PUT(request: NextRequest) {
  const { id, costOverride } = await request.json();

  await base('stock_inventory').update(id, {
    cost_override: costOverride,
    last_updated: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
```

### Order Management

**Files:**
- `src/app/api/admin/stock/orders/route.ts` - API route

#### Current Implementation (Mock)

Uses in-memory mock data with 6 weeks of sample orders.

#### Target Implementation (Airtable)

```typescript
export async function GET() {
  const records = await base('stock_orders')
    .select({ sort: [{ field: 'order_date', direction: 'desc' }] })
    .all();

  const orders = records.map(record => ({
    id: record.id,
    orderDate: record.fields.order_date,
    status: record.fields.status,
    totalItems: record.fields.total_items,
    totalQuantity: record.fields.total_quantity,
    totalCost: record.fields.total_cost,
    costChangePercent: record.fields.cost_change_percent,
    lineItems: JSON.parse(record.fields.line_items || '[]'),
  }));

  return NextResponse.json({ orders });
}
```

#### Future: Flyeralarm API Integration

When Flyeralarm API access is available:

1. Create scheduled job to sync prices weekly
2. Auto-populate `stock_orders` when orders are placed
3. Update `stock_inventory` quantities automatically

---

## API Endpoints

### Existing Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/airtable/get-events` | GET | Fetch all events (SchoolEventSummary[]) |
| `/api/shopify/products` | GET | Fetch Shopify products |
| `/api/shopify/create-checkout` | POST | Create Shopify checkout |

### Stock Endpoints (Need Airtable Connection)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/stock/inventory` | GET | Fetch all inventory items |
| `/api/admin/stock/inventory` | PUT | Update cost override |
| `/api/admin/stock/orders` | GET | Fetch all stock orders |

### Required Changes

**`/api/admin/stock/inventory/route.ts`:**
- Replace `generateMockInventory()` with Airtable query
- Connect PUT to Airtable update

**`/api/admin/stock/orders/route.ts`:**
- Replace `generateMockOrders()` with Airtable query

---

## Data Flow Diagrams

### Analytics Revenue Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Shopify    │     │   Airtable   │     │  Analytics   │
│    Orders    │     │    Events    │     │    Page      │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │  order_number      │  booking_id        │
       │  ───────────────►  │  ◄────────────────│
       │                    │                    │
       │  custom_attributes │                    │
       │  (booking_id)      │                    │
       │  ◄─────────────────┤                    │
       │                    │                    │
       │  totalPrice        │  event data        │
       │  ────────────────────────────────────►  │
       │                    │                    │
```

### Stock Management Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Flyeralarm  │     │   Airtable   │     │  Stock Page  │
│     API      │     │  Inventory   │     │              │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │  (future: prices)  │  GET inventory     │
       │  ───────────────►  │  ◄────────────────│
       │                    │                    │
       │                    │  PUT cost_override │
       │                    │  ◄────────────────│
       │                    │                    │
       │  (future: orders)  │                    │
       │  ───────────────►  │                    │
       │                    │                    │
```

---

## Implementation Checklist

### Phase 1: Airtable Stock Tables
- [ ] Create `stock_inventory` table in Airtable
- [ ] Create `stock_orders` table in Airtable
- [ ] Populate initial inventory data
- [ ] Update `/api/admin/stock/inventory` to use Airtable
- [ ] Update `/api/admin/stock/orders` to use Airtable

### Phase 2: Shopify Revenue Integration
- [ ] Enable `ENABLE_SHOPIFY_INTEGRATION=true`
- [ ] Add Admin API token to environment
- [ ] Create `getOrdersByBookingId()` method in ShopifyService
- [ ] Update Analytics page to fetch real revenue
- [ ] Test order-to-event linking via custom attributes

### Phase 3: Cost Integration
- [ ] Create method to query stock costs by event
- [ ] Update Analytics to use real variable costs from stock
- [ ] Link stock usage to events (track which items per event)

### Phase 4: Flyeralarm Integration (Future)
- [ ] Obtain Flyeralarm API access
- [ ] Create sync job for pricing updates
- [ ] Auto-create stock orders
- [ ] Update inventory quantities automatically

---

## Claude Code Implementation Prompts

Once you've completed the Airtable table setup, use these prompts with Claude Code to implement each integration phase.

### Phase 1: Connect Stock to Airtable

**Prerequisites:**
- Created `stock_inventory` table in Airtable with fields: `item`, `size`, `in_stock`, `cost_per_unit`, `cost_override`, `last_updated`
- Created `stock_orders` table in Airtable with fields: `order_date`, `status`, `total_items`, `total_quantity`, `total_cost`, `cost_change_percent`, `line_items`
- Note down your table IDs from Airtable (visible in the URL when viewing each table)

**Prompt:**

```
Connect the Stock section to Airtable. I've created two new tables in my Airtable base:

1. `stock_inventory` table (Table ID: tblXXXXXXXXX) with fields:
   - item (Single Select): T-Shirt, Hoodie, Mug, Sport Bag, CD, Minicard
   - size (Single Select): 92, 98, 104, 116, 128, 140, 152, 164
   - in_stock (Number)
   - cost_per_unit (Currency)
   - cost_override (Currency, nullable)
   - last_updated (Date)

2. `stock_orders` table (Table ID: tblYYYYYYYYY) with fields:
   - order_date (Date)
   - status (Single Select): pending, placed, completed, failed
   - total_items (Number)
   - total_quantity (Number)
   - total_cost (Currency)
   - cost_change_percent (Number)
   - line_items (Long Text - JSON)

Please update these files to use Airtable instead of mock data:
- src/app/api/admin/stock/inventory/route.ts
- src/app/api/admin/stock/orders/route.ts

Follow the existing patterns in src/lib/services/airtableService.ts for Airtable queries. The Stock page (src/app/admin/stock/page.tsx) should continue working without changes - just update the API routes.
```

---

### Phase 2: Connect Analytics Revenue to Shopify

**Prerequisites:**
- Shopify Admin API token configured in `.env.local`
- `ENABLE_SHOPIFY_INTEGRATION=true` in `.env.local`
- Shopify orders have `booking_id` in custom attributes (from checkout creation)

**Prompt:**

```
Connect the Analytics section to Shopify for real revenue data. Currently the analytics page uses generateFillerRevenue() which returns random €500-€3000 values.

Requirements:
1. Add a new method to src/lib/services/shopifyService.ts called `getRevenueByBookingId(bookingId: string)` that:
   - Uses Shopify Admin API (not Storefront API)
   - Queries orders that have the booking_id in their custom attributes
   - Sums and returns the total revenue for that event

2. Update src/app/admin/analytics/page.tsx to:
   - Fetch real revenue from Shopify for each event
   - Replace generateFillerRevenue() with the actual Shopify revenue
   - Handle the async nature (revenue fetching is async)
   - Show "Loading..." or a placeholder while revenue is being fetched
   - Gracefully handle errors (fall back to showing €0 or "N/A")

The booking_id is stored in Airtable as event.eventId and should match the custom_attributes.booking_id in Shopify orders.

Environment variables available:
- SHOPIFY_STORE_DOMAIN
- SHOPIFY_ADMIN_ACCESS_TOKEN
- ENABLE_SHOPIFY_INTEGRATION
```

---

### Phase 3: Connect Analytics Costs to Stock

**Prerequisites:**
- Phase 1 completed (Stock connected to Airtable)
- Need a way to track which stock items are used per event

**Prompt:**

```
Connect the Analytics section to use real variable costs from the Stock inventory.

Current state:
- Analytics page uses generateFillerVariableCosts() which creates random quantities
- Variable costs include: T-Shirts, Hoodies, Mugs, Sport Bags, CDs, Minicards
- Each event should show actual stock used, not random data

Required changes:

1. Add a new Airtable table or extend parent_journey_table to track stock usage per event:
   - Link stock items to booking_id (event)
   - Track quantity of each item type/size used

2. Create API endpoint or extend existing:
   - GET /api/admin/analytics/event-costs?bookingId=XXX
   - Returns the variable costs for a specific event

3. Update src/app/admin/analytics/page.tsx:
   - Fetch real variable costs from stock data
   - Replace generateFillerVariableCosts() with actual data
   - Use unit costs from stock_inventory table

4. Update src/lib/types/analytics.ts if needed for new data structures

The goal is for each event row in Analytics to show:
- Actual quantities of merchandise used/sold for that event
- Costs calculated from stock_inventory unit prices
- Real profit = real revenue - (fixed costs + real variable costs)
```

---

### Phase 4: Full Integration Test

**Prerequisites:**
- All three phases completed
- Real data in Airtable and Shopify

**Prompt:**

```
Run a full integration test for the Analytics and Stock sections. Please:

1. Navigate to /admin/stock and verify:
   - Inventory tab shows data from Airtable stock_inventory table
   - Orders tab shows data from Airtable stock_orders table
   - Editing a cost per unit saves to Airtable (shows "Override" badge)
   - Export CSV downloads real data

2. Navigate to /admin/analytics and verify:
   - Events show real revenue from Shopify (not random €500-€3000)
   - Variable costs come from stock inventory (not random quantities)
   - Profit calculation is correct (revenue - fixed costs - variable costs)
   - Expandable rows show correct cost breakdowns
   - Export CSV includes real data

3. Test error handling:
   - What happens if Shopify API is unavailable?
   - What happens if Airtable connection fails?
   - Are errors displayed gracefully to the user?

4. Report any issues found and suggest fixes.
```

---

## Support

For questions about this integration:
- Check the existing service files in `src/lib/services/`
- Review type definitions in `src/lib/types/`
- Contact the development team
