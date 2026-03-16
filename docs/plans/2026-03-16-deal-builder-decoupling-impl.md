# Deal Builder Decoupling — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Decouple the deal builder from all functional control, turning it into a visual-only cost tracker, and move functional behavior to Event Settings.

**Architecture:** Remove deal builder from shop profile resolution, flag syncing, and checkout logic. Add new standalone Event fields (`scs_shirts_included`, `minicard_order_enabled`, `minicard_order_quantity`). Rebuild the DealBuilder component as a flat preset cost list with editable amounts. The `deal_config` JSON blob persists cost-tracking data only.

**Tech Stack:** Next.js, React, TypeScript, Airtable, Tailwind CSS

**Design doc:** `docs/plans/2026-03-16-deal-builder-decoupling-design.md`

---

## Task 1: Create New Airtable Fields (Schema Script)

**Files:**
- Create: `scripts/create-deal-builder-v2-fields.ts`

**Step 1: Write the field creation script**

Create a script that adds three new fields to the Events table in Airtable:

```typescript
import Airtable from 'airtable';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! }).base(process.env.AIRTABLE_BASE_ID!);
const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';

async function createFields() {
  console.log('Creating new Event fields for deal builder v2...\n');

  // 1. scs_shirts_included — Checkbox
  try {
    const resp = await fetch(
      `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables/${EVENTS_TABLE_ID}/fields`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'scs_shirts_included',
          type: 'checkbox',
          options: { color: 'greenBright', icon: 'check' },
        }),
      }
    );
    const data = await resp.json();
    console.log('Created scs_shirts_included:', data.id);
  } catch (e) {
    console.error('Failed to create scs_shirts_included:', e);
  }

  // 2. minicard_order_enabled — Checkbox
  try {
    const resp = await fetch(
      `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables/${EVENTS_TABLE_ID}/fields`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'minicard_order_enabled',
          type: 'checkbox',
          options: { color: 'blueBright', icon: 'check' },
        }),
      }
    );
    const data = await resp.json();
    console.log('Created minicard_order_enabled:', data.id);
  } catch (e) {
    console.error('Failed to create minicard_order_enabled:', e);
  }

  // 3. minicard_order_quantity — Number
  try {
    const resp = await fetch(
      `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables/${EVENTS_TABLE_ID}/fields`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'minicard_order_quantity',
          type: 'number',
          options: { precision: 0 },
        }),
      }
    );
    const data = await resp.json();
    console.log('Created minicard_order_quantity:', data.id);
  } catch (e) {
    console.error('Failed to create minicard_order_quantity:', e);
  }

  console.log('\nDone! Add the field IDs above to EVENTS_FIELD_IDS in src/lib/types/airtable.ts');
}

createFields().catch(console.error);
```

**Step 2: Run the script**

Run: `npx tsx scripts/create-deal-builder-v2-fields.ts`

Note down the three field IDs printed. You'll need them in Task 2.

**Step 3: Commit**

```bash
git add scripts/create-deal-builder-v2-fields.ts
git commit -m "chore: add script to create deal builder v2 Airtable fields"
```

---

## Task 2: Add New Fields to Type System

**Files:**
- Modify: `src/lib/types/airtable.ts:569-572` (EVENTS_FIELD_IDS)
- Modify: `src/lib/types/airtable.ts:811-814` (Event interface)

**Step 1: Add field IDs to EVENTS_FIELD_IDS**

After the existing deal builder fields (line 572), add the three new field IDs (use the IDs from Task 1):

```typescript
  // Deal Builder fields
  deal_builder_enabled: 'fld19LJoYvr3ZVKpc',  // Checkbox - master toggle for Deal Builder
  deal_type: 'fldJNjJnyIPOMmb9y',                        // Single Select: mimu, mimu_scs, schus, schus_xl
  deal_config: 'fldw4PwiZTkShCZ7q',                    // Long Text - JSON blob with deal-specific config
  // Bulk School Orders
  scs_shirts_included: 'fldXXXXXXXXXXXXXXX',            // Checkbox - enables SchulClothingOrder
  minicard_order_enabled: 'fldYYYYYYYYYYYYYYY',          // Checkbox - enables bulk minicard order tracking
  minicard_order_quantity: 'fldZZZZZZZZZZZZZZZ',         // Number - quantity of minicards ordered
```

Replace `fldXXX...` with actual IDs from Task 1.

**Step 2: Add fields to Event interface**

After the deal builder fields (line 814), add:

```typescript
  // Bulk School Orders
  scs_shirts_included?: boolean;                   // Enables SchulClothingOrder UI
  minicard_order_enabled?: boolean;                 // Enables bulk minicard order tracking
  minicard_order_quantity?: number;                  // Number of minicards ordered by school
```

**Step 3: Update DealConfig type**

Find the existing `DealConfig` interface in the same file and replace it with the simplified structure:

```typescript
export interface DealConfigPreset {
  enabled: boolean;
  amount: number;
}

export interface DealConfig {
  // Preset cost toggles with editable amounts
  presets?: {
    pauschale?: DealConfigPreset;
    scs_pauschale?: DealConfigPreset;
    distance_surcharge?: DealConfigPreset;
    kleine_einrichtung?: DealConfigPreset;
    grosse_einrichtung?: DealConfigPreset;
    schulsong_discount?: DealConfigPreset;
    shirts_discount?: DealConfigPreset;
  };
  // Gratis items
  gratis_tshirts?: { enabled: boolean; quantity: number };
  gratis_minicards?: { enabled: boolean; quantity: number };
  // Custom line items
  additional_fees?: { title: string; amount: number }[];
  // Calculated
  calculated_fee?: number;
  fee_breakdown?: { label: string; amount: number }[];

  // === LEGACY FIELDS (kept for backward compat with old data, not used by new UI) ===
  pauschale_enabled?: boolean;
  music_pricing_enabled?: boolean;
  cheaper_music?: boolean;
  distance_surcharge?: boolean;
  kleine_einrichtung_enabled?: boolean;
  scs_pauschale_enabled?: boolean;
  grosse_einrichtung_enabled?: boolean;
  scs_song_option?: 'schusXL' | 'schus' | 'none';
  scs_shirts_included?: boolean;
  scs_audio_pricing?: 'standard' | 'plus';
  custom_fees?: Record<string, number>;
  gratis_tshirts_enabled?: boolean;
  gratis_tshirts_quantity?: number;
  gratis_minicards_enabled?: boolean;
  gratis_minicards_quantity?: number;
}
```

**Step 4: Verify build**

Run: `npx next build --no-lint 2>&1 | head -50`

If there are type errors, they're expected — we'll fix them in subsequent tasks.

**Step 5: Commit**

```bash
git add src/lib/types/airtable.ts
git commit -m "feat: add scs_shirts_included and minicard_order fields to Event type"
```

---

## Task 3: Add `isScs` to Shop Profile Resolution

**Files:**
- Modify: `src/lib/config/shopProfiles.ts:400-452`

**Step 1: Add `isScs` to ShopProfileFlags**

Change `ShopProfileFlags` (line 400-404) to:

```typescript
export interface ShopProfileFlags {
  isMinimusikertag?: boolean;
  isPlus?: boolean;
  isSchulsong?: boolean;
  isScs?: boolean;
}
```

**Step 2: Remove DealProfileOverride interface**

Delete the `DealProfileOverride` interface (lines 406-410) entirely.

**Step 3: Rewrite `resolveShopProfile`**

Replace the entire function (lines 420-452) with:

```typescript
/**
 * Resolve the shop profile from admin event type flags.
 *
 * Priority: SCS > schulsong-only > plus > minimusikertag
 */
export function resolveShopProfile(
  flags: ShopProfileFlags
): ShopProfile {
  const { isMinimusikertag, isPlus, isSchulsong, isScs } = flags;

  // SCS takes highest priority
  if (isScs) {
    return isPlus ? SCS_PLUS_PROFILE : SCS_PROFILE;
  }

  // Schulsong-only (schulsong flag set but NOT minimusikertag)
  if (isSchulsong && !isMinimusikertag) {
    return SCHULSONG_ONLY_PROFILE;
  }

  // PLUS pricing tier
  if (isPlus) {
    return PLUS_PROFILE;
  }

  // Default
  return MINIMUSIKERTAG_PROFILE;
}
```

**Step 4: Verify build**

Run: `npx next build --no-lint 2>&1 | head -80`

Expect type errors from callers passing `deal` param — that's fine, we fix those next.

**Step 5: Commit**

```bash
git add src/lib/config/shopProfiles.ts
git commit -m "feat: add isScs to shop profile resolution, remove deal builder dependency"
```

---

## Task 4: Update All `resolveShopProfile` Callers

**Files:**
- Modify: `src/app/familie/shop/page.tsx` (~line 122-133)
- Modify: `src/app/admin/events/[eventId]/settings/page.tsx` (~line 150)
- Modify: any other files that call `resolveShopProfile`

First, find all callers:

Run: `grep -rn "resolveShopProfile" src/ --include="*.ts" --include="*.tsx"`

**Step 1: Update each caller**

For every caller, remove the `deal` second argument and ensure `isScs` is passed in the flags object. The `isScs` value should come from the event's `scs_shirts_included` field (SCS events have shirts included — this is the marker for SCS).

Example — parent shop page would change from:

```typescript
const profile = resolveShopProfile(
  { isMinimusikertag, isPlus, isSchulsong },
  { enabled: dealBuilderEnabled, type: dealType, config: dealConfig }
);
```

To:

```typescript
const profile = resolveShopProfile({
  isMinimusikertag,
  isPlus,
  isSchulsong,
  isScs: scsShirtsIncluded,
});
```

**Note:** The `scs_shirts_included` field needs to be available at each call site. Check each caller to ensure the event data includes this field (it may need to be added to the API response — see Task 5).

**Step 2: Remove DealProfileOverride imports**

Remove any imports of `DealProfileOverride` from files that used it.

**Step 3: Verify build**

Run: `npx next build --no-lint 2>&1 | head -80`

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: update all resolveShopProfile callers to use isScs flag"
```

---

## Task 5: Update Airtable Service & API Routes

**Files:**
- Modify: `src/lib/services/airtableService.ts` (~lines 5712-5719 and ~6260)
- Modify: `src/app/api/admin/events/[eventId]/route.ts` (lines 210-256, 777-817)

**Step 1: Add new fields to airtableService read/write**

In `airtableService.ts`, find where event fields are read from Airtable records and add parsing for:
- `scs_shirts_included` (boolean checkbox)
- `minicard_order_enabled` (boolean checkbox)
- `minicard_order_quantity` (number)

In `updateEventFields()`, add support for writing these three fields.

**Step 2: Remove deal builder flag auto-sync from PATCH route**

In `src/app/api/admin/events/[eventId]/route.ts`, remove lines 791-798:

```typescript
      // DELETE THIS BLOCK:
      // When deal builder is enabled and a deal type is set, auto-sync boolean flags
      if (body.deal_builder_enabled && body.deal_type) {
        const flags = dealTypeToFlags(body.deal_type as DealType, (body.deal_config || {}) as DealConfig);
        dealFieldUpdates.is_plus = flags.is_plus;
        dealFieldUpdates.is_kita = flags.is_kita;
        dealFieldUpdates.is_schulsong = flags.is_schulsong;
        dealFieldUpdates.is_minimusikertag = flags.is_minimusikertag;
      }
```

Also remove the `dealTypeToFlags` import at the top of the file.

**Step 3: Add new fields to PATCH validation**

In the PATCH handler, add acceptance for the new fields. After `hasMerchCutoffUpdate` (line 228), add:

```typescript
    const hasBulkOrderUpdate =
      body.scs_shirts_included !== undefined ||
      body.minicard_order_enabled !== undefined ||
      body.minicard_order_quantity !== undefined;
```

Add `hasBulkOrderUpdate` to the "no valid fields" check on line 230.

Add a new handler block (after the deal builder section) that writes these fields:

```typescript
    if (hasBulkOrderUpdate) {
      const bulkOrderFields: Record<string, unknown> = {};
      if (body.scs_shirts_included !== undefined) {
        bulkOrderFields.scs_shirts_included = body.scs_shirts_included;
      }
      if (body.minicard_order_enabled !== undefined) {
        bulkOrderFields.minicard_order_enabled = body.minicard_order_enabled;
      }
      if (body.minicard_order_quantity !== undefined) {
        bulkOrderFields.minicard_order_quantity = body.minicard_order_quantity;
      }
      updatedEvent = await airtableService.updateEventFields(eventRecordId, bulkOrderFields);
    }
```

**Step 4: Update API response**

Ensure the GET endpoint for events returns `scs_shirts_included`, `minicard_order_enabled`, `minicard_order_quantity` in its response.

**Step 5: Fix checkout route**

In `src/app/api/shopify/create-checkout/route.ts`, replace lines 77-79:

```typescript
        // OLD:
        const isSchulsongOnly = event?.deal_builder_enabled
          ? (event.deal_type === 'schus' || event.deal_type === 'schus_xl')
          : (event?.is_schulsong === true && event?.is_minimusikertag !== true);

        // NEW:
        const isSchulsongOnly = event?.is_schulsong === true && event?.is_minimusikertag !== true;
```

**Step 6: Verify build**

Run: `npx next build --no-lint 2>&1 | head -80`

**Step 7: Commit**

```bash
git add src/lib/services/airtableService.ts src/app/api/admin/events/[eventId]/route.ts src/app/api/shopify/create-checkout/route.ts
git commit -m "feat: add bulk order fields to API, remove deal builder flag auto-sync"
```

---

## Task 6: Rebuild DealBuilder Component (Visual-Only)

**Files:**
- Modify: `src/components/admin/DealBuilder.tsx` (full rewrite)

**Step 1: Rewrite DealBuilder as visual-only cost tracker**

Replace the entire component. The new DealBuilder should:

1. **Accept simplified props:**
   - `dealConfig: DealConfig` — current saved config
   - `scsShirtsIncluded?: boolean` — from Event Settings (read-only display)
   - `minicardOrderEnabled?: boolean` — from Event Settings (read-only display)
   - `minicardOrderQuantity?: number` — from Event Settings (read-only display)
   - `onSave: (config: DealConfig) => void` — save callback
   - `isUpdating?: boolean`

2. **Remove:** `enabled` toggle, `dealType` selector, `onToggleEnabled` callback, `estimatedChildren` auto-calculations

3. **Render a flat list of preset cost rows:**
   Each row: compact toggle switch + label + editable amount input + reset-to-default button

   Default amounts:
   - Pauschale: €0
   - SCS Pauschale: €9,500
   - Distance surcharge: €500
   - Kleine Einrichtung: €-500
   - Grosse Einrichtung: €2,000
   - Schulsong discount: €-500
   - Shirts discount: €-3,000

4. **Gratis items section:** Toggle + quantity for T-shirts and Minicards

5. **Custom line items:** Add/remove rows with title + amount

6. **Bulk School Orders (read-only):** Display SCS shirts status and minicard order quantity if enabled, pulled from props

7. **Summary panel:** Auto-calculated total from all enabled presets + gratis + custom fees

8. **Save button:** Persists to `deal_config` via `onSave`

Use the existing sub-components (FeeInput, DealRow, etc.) as reference for styling, but simplify significantly.

**Step 2: Verify it renders**

Run: `npx next build --no-lint 2>&1 | head -80`

**Step 3: Commit**

```bash
git add src/components/admin/DealBuilder.tsx
git commit -m "feat: rebuild DealBuilder as visual-only cost tracker"
```

---

## Task 7: Update Event Detail Page

**Files:**
- Modify: `src/app/admin/events/[eventId]/page.tsx`

**Step 1: Remove deal builder lockout on type toggles**

Remove the conditional opacity/pointer-events on line 949:

```typescript
// OLD (line 949):
<div className={dealBuilderEnabled ? 'opacity-50 pointer-events-none' : ''}>

// NEW:
<div>
```

Remove the "controlled by Deal Builder" text on line 950:

```typescript
// OLD (line 950):
<h3 className="text-sm font-medium text-gray-700 mb-2">Event Type {dealBuilderEnabled && <span className="text-xs text-gray-400">(controlled by Deal Builder)</span>}</h3>

// NEW:
<h3 className="text-sm font-medium text-gray-700 mb-2">Event Type</h3>
```

**Step 2: Add Bulk School Orders section**

After the standard merch override section (around line 1134) and before the Deal Builder section, add a new "Bulk School Orders" UI section:

```tsx
{/* Bulk School Orders */}
<div className="mt-4 space-y-3">
  <h3 className="text-sm font-medium text-gray-700">Bulk School Orders</h3>

  {/* SCS Shirts Toggle */}
  <label className="flex items-center gap-3 cursor-pointer">
    <div className="relative">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={scsShirtsIncluded}
        onChange={(e) => handleBulkOrderToggle('scs_shirts_included', e.target.checked)}
      />
      <div className="w-9 h-5 bg-gray-200 rounded-full peer-checked:bg-blue-500 transition-colors" />
      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
    </div>
    <span className="text-sm text-gray-700">SCS Shirts Included</span>
  </label>

  {/* Minicard Order Toggle + Quantity */}
  <div className="space-y-2">
    <label className="flex items-center gap-3 cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={minicardOrderEnabled}
          onChange={(e) => handleBulkOrderToggle('minicard_order_enabled', e.target.checked)}
        />
        <div className="w-9 h-5 bg-gray-200 rounded-full peer-checked:bg-blue-500 transition-colors" />
        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
      </div>
      <span className="text-sm text-gray-700">Minicard Order</span>
    </label>
    {minicardOrderEnabled && (
      <div className="ml-12 flex items-center gap-2">
        <input
          type="number"
          min={0}
          value={minicardOrderQuantity ?? 0}
          onChange={(e) => handleMinicardQuantityChange(parseInt(e.target.value, 10) || 0)}
          className="w-24 px-2 py-1 text-sm border rounded"
        />
        <span className="text-xs text-gray-500">Minicards</span>
      </div>
    )}
  </div>
</div>
```

**Step 3: Update SchulClothingOrder condition**

Change lines 1150-1151 from:

```tsx
{dealType === 'mimu_scs' && dealConfig.scs_shirts_included !== false && (
```

To:

```tsx
{scsShirtsIncluded && (
```

**Step 4: Update DealBuilder props**

Change lines 1138-1147 from the old props to the new simplified props:

```tsx
<DealBuilder
  dealConfig={dealConfig}
  scsShirtsIncluded={scsShirtsIncluded}
  minicardOrderEnabled={minicardOrderEnabled}
  minicardOrderQuantity={minicardOrderQuantity}
  onSave={handleDealConfigSave}
  isUpdating={isUpdatingDeal}
/>
```

**Step 5: Add state and handlers for new fields**

In the component's state section, add:
- `scsShirtsIncluded` state (loaded from event data)
- `minicardOrderEnabled` state (loaded from event data)
- `minicardOrderQuantity` state (loaded from event data)
- `handleBulkOrderToggle` handler (PATCHes the event)
- `handleMinicardQuantityChange` handler (PATCHes the event)
- `handleDealConfigSave` handler (PATCHes `deal_config` only)

Remove `handleDealToggleEnabled` and `handleDealUpdate` handlers — they're replaced by the simpler `handleDealConfigSave`.

**Step 6: Verify build**

Run: `npx next build --no-lint 2>&1 | head -80`

**Step 7: Commit**

```bash
git add src/app/admin/events/[eventId]/page.tsx
git commit -m "feat: add Bulk School Orders section, decouple deal builder from type toggles"
```

---

## Task 8: Clean Up Unused Code

**Files:**
- Modify: `src/lib/utils/dealCalculator.ts` — remove `dealTypeToFlags()` function (lines 165-195)
- Modify: `src/app/api/admin/events/[eventId]/route.ts` — remove `dealTypeToFlags` import if not already done
- Check: `src/components/admin/bookings/BookingDetailsBreakdown.tsx` — update if it reads old deal_config structure
- Check: any teacher portal files that reference deal type

**Step 1: Remove `dealTypeToFlags` from dealCalculator.ts**

Delete lines 165-195 in `src/lib/utils/dealCalculator.ts`.

**Step 2: Search for remaining references**

Run: `grep -rn "dealTypeToFlags\|DealProfileOverride\|deal_builder_enabled\|deal\.enabled" src/ --include="*.ts" --include="*.tsx"`

Fix any remaining references:
- `deal_builder_enabled` reads in the UI can remain (they read the field but it no longer drives behavior)
- `DealProfileOverride` imports should be removed
- `dealTypeToFlags` calls should be removed

**Step 3: Check BookingDetailsBreakdown**

If `BookingDetailsBreakdown.tsx` reads `deal_config.fee_breakdown`, it should still work with the new structure since we keep the `fee_breakdown` field. Verify and adjust if needed.

**Step 4: Verify build passes clean**

Run: `npx next build --no-lint 2>&1 | tail -20`

Expected: Build succeeds with no type errors.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove dealTypeToFlags and unused deal builder references"
```

---

## Task 9: Update Parent/Teacher Portals

**Files:**
- Check: `src/app/familie/page.tsx`
- Check: `src/app/familie/shop/page.tsx`
- Check: `src/app/paedagogen/events/[eventId]/page.tsx`
- Check: `src/app/api/parent/schulsong-status/route.ts`
- Check: `src/lib/services/teacherService.ts`

**Step 1: Find all deal builder references in portals**

Run: `grep -rn "dealBuilder\|deal_builder\|dealType\|deal_type\|dealConfig\|deal_config" src/app/familie/ src/app/paedagogen/ src/lib/services/teacherService.ts --include="*.ts" --include="*.tsx"`

**Step 2: Update parent portal**

- Remove `dealBuilderEnabled`, `dealType`, `dealConfig` from API responses where they were used for shop profile resolution
- Parent shop should now get `scs_shirts_included` from the event and pass `isScs: scsShirtsIncluded` to `resolveShopProfile()`

**Step 3: Update teacher portal**

- SchulClothingOrder in teacher portal should check `scs_shirts_included` instead of `dealType === 'mimu_scs'`
- Update `teacherService.ts` to include `scs_shirts_included` in event data

**Step 4: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -20`

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: update parent and teacher portals to use Event Settings instead of deal builder"
```

---

## Task 10: Full Build & Manual Test

**Step 1: Full build**

Run: `npx next build`

Expected: Clean build, no errors.

**Step 2: Manual testing checklist**

Start dev server: `npm run dev`

Test in admin portal:
- [ ] Event type toggles (Off/Minimusikertag/PLUS, Kita, Schulsong) work freely — no "controlled by Deal Builder" lockout
- [ ] Bulk School Orders section visible with SCS Shirts toggle and Minicard Order toggle + quantity
- [ ] Toggling SCS Shirts shows/hides SchulClothingOrder below
- [ ] Deal builder shows flat preset list, all editable
- [ ] Saving deal config persists and reloads correctly
- [ ] Deal summary shows correct totals

Test in parent portal:
- [ ] Shop profile resolves correctly based on event type flags + isScs
- [ ] Products shown/hidden correctly

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```

---

## Execution Notes

- **Tasks 1-2** must be sequential (create Airtable fields, then add IDs to code)
- **Tasks 3-5** can be done somewhat in parallel but 4 depends on 3
- **Task 6** (DealBuilder rewrite) is the largest task — can be done in parallel with Tasks 3-5
- **Task 7** depends on Task 6 (new DealBuilder props)
- **Tasks 8-9** are cleanup that depends on all prior tasks
- **Task 10** is the final verification
