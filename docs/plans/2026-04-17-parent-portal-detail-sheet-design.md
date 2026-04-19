# Parent Portal — Product Detail Sheet (Design)

**Date:** 2026-04-17
**Branch:** `parent_portal_rework`
**Status:** Design validated, ready for implementation plan

## Problem

The parent portal at `/familie` shows audio and clothing products as compact cards with minimal information (short name, emoji/image, price). Parents have no way to see extended product descriptions, multiple product photos, or detailed information before purchasing. Most traffic is mobile.

## Goal

Add a bottom-sheet detail modal to both `AudioProductCard` and `ClothingProductCard` on `/familie`, pulling rich content (title, description, image gallery) from Shopify. Simultaneously simplify the audio card interaction model and highlight the Kinderliederbox as a featured product.

## Scope

**In scope:**

- Bottom-sheet modal on both audio and clothing cards in `/familie`.
- Content sourced from Shopify (title, descriptionHtml, images) via existing `/api/shopify/products` route.
- Audio card interaction rework: tap card → opens modal; "Add to Cart" button on card adds 1; morphs to qty stepper after first add.
- Clothing card: tap card → opens modal; inline controls (size picker, qty, Add) preserved with stopPropagation.
- Remove inline description text from both card types.
- Card title and primary image sourced from Shopify (hardcoded name/image as fallback).
- Kinderliederbox (`bluetooth-box`) always rendered first in audio grid with a golden glow when available.
- Graceful fallback when Shopify fetch fails.

**Out of scope:**

- No changes to `/familie/shop` (existing work preserved as-is).
- No changes to pricing (hardcoded prices in shopProfiles remain source of truth).
- No changes to checkout/order flow downstream of ProductSelector.
- No changes to profile resolution, hidden-product filtering, or PLUS differentiation (all upstream, untouched).
- No URL deep-linking, no analytics events.

## Design

### Card interaction changes

**AudioProductCard (reworked):**

- Tap card → opens detail modal (replaces tap-to-toggle).
- Checkbox removed (no longer a toggle-select pattern).
- Inline description removed.
- Below price: "Add to Cart" button when item not yet in selection.
- After first add: button morphs into `− qty +` stepper. Decrement to 0 removes the item.
- "Add to Cart" and qty stepper call `e.stopPropagation()` so they don't trigger the modal.

**ClothingProductCard (enhanced):**

- Tap card → opens detail modal (new — no whole-card click existed before).
- Inline description removed.
- Card keeps existing inline controls: size picker + qty + "Add" button (with stopPropagation on all).
- Everything else stays as-is.

**Both cards:**

- Image, title sourced from Shopify (fetched once at ProductSelector level, matched via variant GID). Hardcoded `name`/`imageSrc`/`imageEmoji` become fallbacks if the Shopify lookup fails.
- Description prop removed from both card components (no longer rendered on cards).

### Data flow

**Shopify fetch:** `ProductSelector` calls `useProducts({ tagFilter: shopProfile.shopifyTagFilter })` on mount — reuses the existing hook and `/api/shopify/products` route. Returns `Product[]` with `title`, `descriptionHtml`, `images[]`. One request, ~10-20 products, no new API routes.

**Matching parent-portal products to Shopify products:**

1. Build a `Map<variantGID, Product>` from the fetched Shopify products.
2. For each parent-portal product (audio or clothing), look up `shopifyVariantMap[product.id]` → variant GID → resolve parent Shopify `Product`.
3. Pass to cards/modal: `shopifyProduct.title` (card + modal title), `shopifyProduct.images[0]?.url` (card image), `shopifyProduct.images` (modal gallery), `shopifyProduct.descriptionHtml` (modal body).

**Fallback:** If Shopify fetch fails or a product has no match, card renders hardcoded `name` and `imageSrc`/`imageEmoji`. Modal shows hardcoded name as title and fallback text "Weitere Details folgen in Kürze." as description.

**Upstream filters preserved (zero changes):**

- PLUS vs standard profile resolution: `resolveShopProfile()` in `/familie/page.tsx` selects the correct `audioProducts` array and `shopifyVariantMap` based on event flags. Untouched.
- Hidden products: `getEffectiveHiddenProducts()` in `/familie/page.tsx` filters out hidden products from the profile before passing to `ProductSelector`. Untouched.
- Both mechanisms run upstream; `ProductSelector` and cards only see the already-filtered profile.

### Modal component

**New component:** `ParentPortalDetailSheet.tsx` — same vaul bottom sheet, same visual pattern as the existing `ProductDetailSheet` (built for `/familie/shop`), but props designed for the parent-portal data shape.

**Props:**

```
title: string              // Shopify title (or fallback hardcoded name)
descriptionHtml?: string   // Shopify rich description
images: { url, altText }[] // Shopify image gallery
price: number              // From shop profile (hardcoded, source of truth)
footer: React.ReactNode    // Render prop — different for audio vs clothing
```

**Audio footer:** qty stepper + "Add to Cart" button. Calls `onAdd(qty)`.

**Clothing footer:** size picker (T-shirt and/or hoodie) + qty stepper + "Add" button. Calls `onAdd(tshirtSize, hoodieSize, qty)`.

**Sheet behavior (same as prior design):**

- ~90% viewport height on mobile. Centered dialog (max-width 640px, max-height 85vh) on desktop.
- Swipeable image carousel with pagination dots (multi-image) or static hero (single image).
- Sanitized `descriptionHtml` via `isomorphic-dompurify`.
- `Drawer.Title` / `Drawer.Description` for accessibility.
- Sticky footer with safe-area padding.
- Close via: swipe down, backdrop tap, X button, Escape key.

### Kinderliederbox highlight

- Move `bluetooth-box` to index 0 in all `*_AUDIO` arrays in `shopProfiles.ts`.
- Add `featured?: boolean` to the `AudioProduct` interface. Set `featured: true` on Kinderliederbox entries.
- When `featured` is true, `AudioProductCard` renders with golden glow:
  ```
  border-amber-400 bg-amber-50/30 shadow-[0_0_20px_rgba(245,158,11,0.25)]
  ```
  On hover: `shadow-[0_0_25px_rgba(245,158,11,0.35)]`.
- Consistent with existing amber usage (savings badge: `bg-amber-500`).
- When the Kinderliederbox is hidden via event settings or absent from the profile, it's filtered out upstream — no glow, no card, no special handling needed.

### Edge cases

| Case | Behaviour |
|------|-----------|
| Shopify fetch fails | Cards use hardcoded name/image; modal shows fallback description |
| Product has no Shopify match | Same fallback as fetch failure |
| Single Shopify image | Carousel renders static, dots hidden |
| No Shopify images | Card uses hardcoded `imageSrc`/`imageEmoji`; modal shows card image only |
| No `descriptionHtml` | Modal shows "Weitere Details folgen in Kürze." |
| Kinderliederbox hidden | Not in array; next product is first; no golden glow |
| Audio product qty decremented to 0 | Removed from selection; card reverts to "Add to Cart" button |

### Responsive behaviour

**Mobile (<768px):**

- Sheet opens to ~90% of viewport height.
- Image carousel ~40% of visible sheet area.
- Sticky footer with safe-area padding clears iOS home indicator.

**Desktop (≥768px):**

- Sheet renders as centered dialog: max-width ~640px, max-height ~85vh, rounded corners, backdrop.
- Image carousel ~50% of sheet width.
- Same sticky footer pattern.

## Dependencies

- `vaul` (already installed in this worktree).
- `isomorphic-dompurify` (already installed).
- Existing `/api/shopify/products` route (already returns `descriptionHtml` and 10 images per product from prior work).
- Existing `useProducts` hook.

## Rollout

Component changes + card refactors + shopProfile reordering. No migration, no feature flag, no data changes. Ship behind normal PR review.
