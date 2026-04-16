# Parent Portal — Product Detail Sheet (Design)

**Date:** 2026-04-16
**Branch:** `parent_portal_rework`
**Status:** Design validated, ready for implementation plan

## Problem

The parent shop at `/familie/shop` shows products as dense cards (image, title, price, size, quantity, add-to-cart all inline). Cards have no room for rich product information — marketing description, multiple photos — that would help parents make informed purchase decisions. Most traffic is mobile, so any solution must be mobile-first.

## Goal

Give parents access to in-depth product information (extended description + additional product photos) without leaving the catalog, via a bottom-sheet modal that works well on mobile.

## Scope

**In scope:**

- A bottom-sheet modal surfaced from each product card in `/familie/shop`.
- Content shown in the sheet: swipeable image carousel + product description.
- Dual entry: tapping the card or tapping a visible "Product Details" button.
- Cart controls (size, quantity, add-to-cart) duplicated inside the sheet's sticky footer.
- Card keeps its existing inline controls — fast buyers never need to open the sheet.

**Out of scope:**

- Reviews, ratings, related products, search, filtering.
- URL deep-linking (e.g., `?product=handle`).
- Analytics events on modal open/close.
- Hardcoded content (see Data Flow — Shopify already delivers everything needed).

## Design

### Component structure

| File | Change |
|------|--------|
| `src/components/shop/ProductDetailSheet.tsx` | New component. Takes `product` + open/close props. Renders carousel, description, sticky footer. |
| `src/components/shop/ProductCard.tsx` | Wrap card in click handler to open sheet. Add "Product Details" button. `stopPropagation` on size/qty/CTA so they don't also open the sheet. |
| `src/components/shop/ProductCatalog.tsx` | No changes. Sheet state lives inside each `ProductCard`. |

**Library:** `vaul` (React bottom-sheet library, ~6KB, used by shadcn/ui and Vercel). Handles swipe-to-dismiss, backdrop, focus trap, body scroll lock, and accessibility out of the box. Chosen over rolling our own with framer-motion because vaul has solved the iOS/keyboard/scroll edge cases already.

**HTML sanitization:** `isomorphic-dompurify` (new dependency) to sanitize Shopify's `descriptionHtml` before rendering via `dangerouslySetInnerHTML`. Prevents script injection by anyone with Shopify admin access.

### Data flow

Every piece of content comes from the existing `Product` object returned by `useProducts`. No new API routes, no new hooks, no extra fetches.

- `product.title` → sheet header
- `product.images[]` → carousel
- `product.descriptionHtml` → sanitized and rendered in the body
- `product.variants[]` → size picker + add-to-cart in sticky footer

**One lift:** verify the GraphQL query in `src/app/api/shopify/products/route.ts` includes `descriptionHtml` on the product selection set. Add it if missing — zero extra cost, same round-trip.

**Performance:**

- Catalog load: unchanged (same payload — `descriptionHtml` is small text; Shopify already serves it).
- Modal open: zero network cost; content is in memory.
- Secondary carousel images: `<Image loading="lazy">` so only the first image loads with the catalog; subsequent images fetch when the user opens the sheet and swipes.

Hardcoding descriptions/images in the repo was considered and rejected: the "faster load" intuition doesn't apply because the data is already on the client. Hardcoding would add a deploy every time someone fixes a typo and would fork content across two sources of truth.

### Interaction

**Opening:**

- Tap anywhere on the card → sheet opens.
- Tap "Product Details" button (sage text, small chevron, under price) → same handler.
- Clicks on size buttons, quantity stepper, and "Add to Cart" inside the card call `e.stopPropagation()` so they don't bubble.

**Sheet contents (top to bottom):**

1. Drag handle (vaul default).
2. Close "X" in top-right.
3. Image carousel — swipe left/right with pagination dots. Dots hidden when only one image.
4. Title (h2) + price (with strikethrough compare-at if on sale).
5. Sanitized `descriptionHtml` with Tailwind `prose` styling (sage-themed).
6. Sticky footer: size picker (if multi-size) + quantity stepper + full-width "Add to Cart". `position: sticky; bottom: 0`; white background, top border; safe-area padding on iOS.

**Closing:**

- Swipe sheet down past threshold.
- Tap backdrop.
- Tap X.
- Press Escape (desktop).

All handled by vaul natively.

**Post-add-to-cart:** sheet stays open, existing "Adding…" spinner shows, quantity resets. Parent closes manually or continues browsing inside the sheet.

**Accessibility:** `aria-label="Product details for {title}"` on the sheet. Focus trap, focus return on close, body scroll lock — all vaul defaults.

### Responsive behaviour

**Mobile (<768px):**

- Sheet opens to ~90% of viewport height.
- Image carousel ~40% of visible sheet area.
- Sticky footer ~80px tall (size row + qty/CTA row).
- Safe-area padding at bottom clears iOS home indicator.

**Desktop (≥768px):**

- Vaul renders as a centered dialog-style sheet: max-width ~640px, max-height ~85vh, rounded corners, backdrop.
- Image carousel ~50% of sheet width.
- Same sticky footer pattern.

### Edge cases

| Case | Behaviour |
|------|-----------|
| No `descriptionHtml` | Fallback copy: "More details coming soon." |
| Single image | Carousel renders static, dots hidden. |
| Out-of-stock variant | Size button disabled; CTA disabled when selected variant unavailable (matches card today). |
| `excludedVariantIds` filtering | Sheet receives already-filtered `product` from `ProductCatalog` — cutoff logic reused, not duplicated. |
| Discounted price | Same compare-at strikethrough as the card. |
| Long description | Sheet body scrolls; sticky header (title) and sticky footer (CTA) stay put. |

## Open questions

None — all resolved during brainstorm.

## Rollout

Single component + small card edit + optional GraphQL addition. No migration, no feature flag, no data changes. Ship behind normal PR review.
