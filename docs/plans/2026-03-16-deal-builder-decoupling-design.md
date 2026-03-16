# Deal Builder Decoupling — Design Document

**Date:** 2026-03-16
**Status:** Approved

## Overview

Decouple the deal builder from all functional control of the application. It becomes a **visual-only cost-tracking tool** for admins — an advanced note-taker with preset costs and free-form line items. All functional behavior (shop profile, product visibility, event type flags) moves to Event Settings.

## Current State

The deal builder currently controls:
1. **Shop profile resolution** — determines products/prices in parent shop
2. **Legacy flag auto-sync** — sets `is_plus`, `is_minimusikertag`, `is_schulsong`, `is_kita` from deal type
3. **Early-bird discount logic** — checkout skips early-bird for schulsong-only deal types
4. **Admin toggle lockout** — grays out event type toggles when deal builder is active
5. **SCS UI** — SchulClothingOrder appears only for `mimu_scs` deals with shirts
6. **Fee calculation** — computes and stores fee breakdowns

## Changes

### 1. Deal Builder — Visual-Only Cost Tracker

- **Remove deal type selector** (mimu, mimu_scs, schus, schus_xl) — event type comes from existing toggles
- **Remove `deal_builder_enabled` master toggle** — always visible, always editable
- **All cost presets in one flat compact list**, each row: toggle + label + editable amount
  - Pauschale
  - SCS Pauschale
  - Distance surcharge
  - Kleine Einrichtung
  - Grosse Einrichtung
  - Schulsong discount
  - Shirts discount
- **Gratis items** — free T-shirts (toggle + qty), free Minicards (toggle + qty)
- **Custom line items** — add title + amount rows
- **Bulk School Orders** — read-only display pulled from Event Settings (SCS shirts count, minicard order count)
- **Summary total** — auto-calculated from all enabled items
- **Save** persists to `deal_config` — no functional side effects

### 2. New Airtable Fields

| Field | Type | Purpose |
|-------|------|---------|
| `scs_shirts_included` | Checkbox | Enables SchulClothingOrder UI |
| `minicard_order_enabled` | Checkbox | Enables bulk minicard tracking |
| `minicard_order_quantity` | Number | How many minicards the school ordered |

These live on the main event detail page in a new **"Bulk School Orders"** section alongside existing event type toggles. Both are independent — an event can have shirts only, minicards only, both, or neither.

### 3. Simplified `deal_config` Structure

```typescript
interface DealConfig {
  presets: {
    pauschale?: { enabled: boolean; amount: number };
    scs_pauschale?: { enabled: boolean; amount: number };
    distance_surcharge?: { enabled: boolean; amount: number };
    kleine_einrichtung?: { enabled: boolean; amount: number };
    grosse_einrichtung?: { enabled: boolean; amount: number };
    schulsong_discount?: { enabled: boolean; amount: number };
    shirts_discount?: { enabled: boolean; amount: number };
  };
  gratis_tshirts?: { enabled: boolean; quantity: number };
  gratis_minicards?: { enabled: boolean; quantity: number };
  additional_fees?: { title: string; amount: number }[];
  calculated_fee?: number;
  fee_breakdown?: FeeBreakdownItem[];
}
```

No more `deal_type`, `scs_audio_pricing`, `music_pricing_enabled`, or any functional config.

### 4. Code Decoupling

**`resolveShopProfile()` (`shopProfiles.ts`):**
- Remove deal builder code path entirely
- Add `isScs` to `ShopProfileFlags`
- New priority: SCS > Schulsong-only > Plus > Minimusikertag
- SCS + `is_plus` → SCS_PLUS_PROFILE; SCS alone → SCS_PROFILE

**PATCH `/api/admin/events/[eventId]`:**
- Remove `dealTypeToFlags()` auto-sync
- Accept new fields: `scs_shirts_included`, `minicard_order_enabled`, `minicard_order_quantity`
- `deal_config` saves persist with no side effects

**Checkout route (`create-checkout`):**
- Replace `deal_type` check with `is_schulsong && !is_minimusikertag` for early-bird logic

**Admin event detail page:**
- Remove "controlled by Deal Builder" lockout on type toggles
- Add "Bulk School Orders" section
- SchulClothingOrder triggered by `scs_shirts_included` (not deal type)
- Replace deal builder component with simplified visual-only version

**Parent/teacher portals:**
- `resolveShopProfile()` calls updated automatically (no deal params)
- SchulClothingOrder visibility driven by `scs_shirts_included`

### 5. Fields That Become Unused

- `deal_builder_enabled` — no longer drives behavior
- `deal_type` — removed from UI

Can be cleaned up in a later pass.

## Migration Strategy

### Step 1: Dry-Run Script
Scans all events with `deal_builder_enabled=true` and reports:
- Event ID, name, date, status
- Current deal type and config summary
- Current legacy flags vs what `dealTypeToFlags()` would produce
- Whether `scs_shirts_included` needs to be set
- Whether `hidden_products` needs updating for SCS events
- Mismatch/needs-attention flags

### Step 2: Migration Script (after review)
- Bake legacy flags into any mismatched events
- Set `scs_shirts_included` on SCS events with shirts
- Set `hidden_products` for SCS events (hide minicard, bundles, t-shirt)
- Convert existing `deal_config` to new simplified structure
- Preserve old config in logs (no data loss)

### Step 3: Code Deployment
- Deploy decoupled code
- `deal_builder_enabled` and `deal_type` become inert
