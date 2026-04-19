# Parent Portal Detail Sheet Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add bottom-sheet product modals to AudioProductCard and ClothingProductCard on `/familie`, pulling rich content from Shopify. Rework audio card interaction to tap-opens-modal with add-to-cart button. Highlight Kinderliederbox first with golden glow.

**Architecture:** New `ParentPortalDetailSheet` component (vaul-based, render-prop footer). `ProductSelector` builds a Shopify product lookup (variant GID → Product) and passes title/images/descriptionHtml to cards. AudioProductCard gets new interaction model (tap→modal, add button morphs to qty stepper). ClothingProductCard gets card-click→modal + stopPropagation on inline controls.

**Tech Stack:** Next.js 14 · React 18 · TypeScript · Tailwind · `vaul` (installed) · `isomorphic-dompurify` (installed) · Jest + RTL · `next-intl`

**Reference design:** `docs/plans/2026-04-17-parent-portal-detail-sheet-design.md`

---

## Worktree

All work in: `.worktrees/parent_portal_rework/` on branch `parent_portal_rework`.

```bash
cd /Users/jamesoliver/WebstormProjects/MiniMusiker/.worktrees/parent_portal_rework
```

## Pre-existing test failures

5 tests in `src/lib/utils/eventTimeline.test.ts` fail on `main` (off-by-one date bugs). Ignore them.

---

## Task 1: Reorder Kinderliederbox + add featured flag

**Files:**
- Modify: `src/lib/config/shopProfiles.ts`

**Step 1: Add `featured` to the `AudioProduct` interface**

At `src/lib/config/shopProfiles.ts:16-23`, add `featured?: boolean` after `savings`:

```typescript
export interface AudioProduct {
  id: AudioProductId;
  name: string;
  description: string;
  price: number;
  imageEmoji: string;
  savings?: number;
  featured?: boolean;
}
```

**Step 2: Reorder bluetooth-box to index 0 in ALL four audio arrays**

In each of these arrays, CUT the `bluetooth-box` entry and PASTE it as the first element. Add `featured: true` to each:

1. `MINIMUSIKERTAG_AUDIO` (line ~124): move bluetooth-box from position 4 to position 1, add `featured: true`.
2. `PLUS_AUDIO` (line ~205): move bluetooth-box from its current position to position 1, add `featured: true`.
3. `SCS_AUDIO` (line ~273): move bluetooth-box to position 1, add `featured: true`.
4. `SCS_PLUS_AUDIO` (line ~290): move bluetooth-box to position 1, add `featured: true`.

Each bluetooth-box entry should look like:

```typescript
  {
    id: 'bluetooth-box',
    name: 'Kinderliederbox',
    description: 'BT-Lautsprecher inkl. aller Songs',
    price: 39.00, // or 34.00 for PLUS/SCS_PLUS
    imageEmoji: '🔊',
    featured: true,
  },
```

**Step 3: Type-check**

Run: `npm run type-check`
Expected: no new errors.

**Step 4: Commit**

```bash
git add src/lib/config/shopProfiles.ts
git commit -m "feat(shop): reorder Kinderliederbox first and add featured flag"
```

---

## Task 2: Add i18n keys for parent portal modals

**Files:**
- Modify: `messages/de.json`
- Modify: `messages/en.json`

**Step 1: Add `parentPortal.productCard` keys to both locale files**

Inside the top-level JSON object (find a suitable location near existing parent portal keys), add a new block. If a `"parentPortal"` key already exists, add as a nested block inside it. Otherwise create it.

`messages/de.json`:
```json
    "parentPortalCard": {
      "addToCart": "In den Warenkorb",
      "details": "Details",
      "added": "Hinzugefügt"
    },
```

`messages/en.json`:
```json
    "parentPortalCard": {
      "addToCart": "Add to Cart",
      "details": "Details",
      "added": "Added"
    },
```

The existing `shop.productSheet.*` keys (close, descriptionFallback, ariaLabel, previousImage, nextImage, goToImage) will be reused for the modal — no new keys needed there.

**Step 2: Validate JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('messages/de.json', 'utf8')); JSON.parse(require('fs').readFileSync('messages/en.json', 'utf8')); console.log('OK')"
```

**Step 3: Commit**

```bash
git add messages/de.json messages/en.json
git commit -m "i18n: add parent portal card keys (de + en)"
```

---

## Task 3: Create ParentPortalDetailSheet component

**Files:**
- Create: `src/components/parent-portal/ParentPortalDetailSheet.tsx`
- Create: `tests/unit/components/ParentPortalDetailSheet.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/components/ParentPortalDetailSheet.test.tsx`. This test file needs the same `next-intl` and `next/image` mocks as the existing `ProductDetailSheet.test.tsx` (copy the mock blocks from `tests/unit/components/ProductDetailSheet.test.tsx`).

```typescript
import { render, screen } from '@testing-library/react';
import ParentPortalDetailSheet from '@/components/parent-portal/ParentPortalDetailSheet';
import enMessages from '../../../messages/en.json';

// Copy the jest.mock('next-intl', ...) block from tests/unit/components/ProductDetailSheet.test.tsx
// Copy the jest.mock('next/image', ...) block from tests/unit/components/ProductDetailSheet.test.tsx

function renderSheet(props: Partial<React.ComponentProps<typeof ParentPortalDetailSheet>> = {}) {
  const defaults = {
    title: 'Kinderliederbox',
    descriptionHtml: '<p>A <strong>bluetooth</strong> speaker.</p>',
    images: [{ url: 'https://cdn.shopify.com/img1.jpg', altText: 'Front' }],
    price: 39.0,
    open: true,
    onOpenChange: () => {},
    footer: <button>Test Footer</button>,
  };
  return render(<ParentPortalDetailSheet {...defaults} {...props} />);
}

describe('ParentPortalDetailSheet', () => {
  it('renders the title when open', () => {
    renderSheet();
    expect(screen.getByRole('heading', { name: 'Kinderliederbox' })).toBeInTheDocument();
  });

  it('renders sanitized descriptionHtml', () => {
    renderSheet();
    const strong = document.querySelector('.prose strong');
    expect(strong?.textContent).toBe('bluetooth');
  });

  it('strips script tags from descriptionHtml', () => {
    renderSheet({ descriptionHtml: '<p>Hello</p><script>alert("xss")</script>' });
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });

  it('shows fallback when no description', () => {
    renderSheet({ descriptionHtml: undefined });
    expect(screen.getByText('More details coming soon.')).toBeInTheDocument();
  });

  it('renders the price', () => {
    renderSheet();
    expect(screen.getByText(/39/)).toBeInTheDocument();
  });

  it('renders the footer content', () => {
    renderSheet();
    expect(screen.getByRole('button', { name: 'Test Footer' })).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderSheet({ open: false });
    expect(screen.queryByRole('heading', { name: 'Kinderliederbox' })).not.toBeInTheDocument();
  });
});
```

**Step 2: Run test — confirm fails**

```bash
npx jest tests/unit/components/ParentPortalDetailSheet.test.tsx
```
Expected: FAIL — module not found.

**Step 3: Implement ParentPortalDetailSheet**

Create `src/components/parent-portal/ParentPortalDetailSheet.tsx`:

```typescript
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Drawer } from 'vaul';
import DOMPurify from 'isomorphic-dompurify';
import { useTranslations } from 'next-intl';

interface ParentPortalDetailSheetProps {
  title: string;
  descriptionHtml?: string;
  images: Array<{ url: string; altText?: string }>;
  price: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  footer: React.ReactNode;
}

export default function ParentPortalDetailSheet({
  title,
  descriptionHtml,
  images,
  price,
  open,
  onOpenChange,
  footer,
}: ParentPortalDetailSheetProps) {
  const t = useTranslations('shop.productSheet');
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const sanitizedHtml = descriptionHtml
    ? DOMPurify.sanitize(descriptionHtml, { USE_PROFILES: { html: true } })
    : '';
  const hasDescription = sanitizedHtml.trim().length > 0;

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Drawer.Content
          aria-label={t('ariaLabel', { title })}
          className="bg-white flex flex-col rounded-t-2xl fixed bottom-0 left-0 right-0 z-50 outline-none md:left-1/2 md:-translate-x-1/2 md:max-w-[640px] md:rounded-2xl md:bottom-[7.5vh]"
          style={{ height: '90vh', maxHeight: '90vh' }}
        >
          {/* Drag handle */}
          <div className="mx-auto w-12 h-1.5 rounded-full bg-gray-300 mt-3 mb-1" />

          {/* Close button */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t('close')}
            className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 z-10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            {/* Image carousel */}
            {images.length > 0 && (
              <div className="relative w-full aspect-square bg-cream-100">
                <Image
                  src={images[activeImageIndex]?.url || ''}
                  alt={images[activeImageIndex]?.altText || title}
                  fill
                  className="object-contain p-4"
                  sizes="(max-width: 768px) 100vw, 640px"
                />
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label={t('previousImage')}
                      onClick={() => setActiveImageIndex((i) => (i - 1 + images.length) % images.length)}
                      className="absolute left-0 top-0 bottom-0 w-1/3"
                    />
                    <button
                      type="button"
                      aria-label={t('nextImage')}
                      onClick={() => setActiveImageIndex((i) => (i + 1) % images.length)}
                      className="absolute right-0 top-0 bottom-0 w-1/3"
                    />
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          aria-label={t('goToImage', { index: i + 1 })}
                          onClick={() => setActiveImageIndex(i)}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            i === activeImageIndex ? 'bg-sage-700' : 'bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Title + price */}
            <div className="px-6 pt-5 pb-3">
              <Drawer.Title asChild>
                <h2 className="font-heading text-2xl text-minimusik-heading mb-2">
                  {title}
                </h2>
              </Drawer.Title>
              <Drawer.Description className="sr-only">
                {t('ariaLabel', { title })}
              </Drawer.Description>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-sage-700">
                  €{price.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="px-6 pb-6">
              {hasDescription ? (
                <div
                  className="prose prose-sm max-w-none prose-headings:text-minimusik-heading prose-a:text-sage-700"
                  dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
              ) : (
                <p className="text-gray-500 italic">{t('descriptionFallback')}</p>
              )}
            </div>
          </div>

          {/* Sticky footer — render prop */}
          <div
            className="border-t border-gray-200 bg-white px-6 pt-4 pb-6"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
```

**Step 4: Run tests**

```bash
npx jest tests/unit/components/ParentPortalDetailSheet.test.tsx
```
Expected: 7 tests pass.

If a test fails due to `getByText(/39/)`, adjust to match however `price.toFixed(2)` renders (e.g., `€39.00`).

**Step 5: Commit**

```bash
git add src/components/parent-portal/ParentPortalDetailSheet.tsx tests/unit/components/ParentPortalDetailSheet.test.tsx
git commit -m "feat(parent-portal): add ParentPortalDetailSheet bottom-sheet modal"
```

---

## Task 4: ProductSelector — Shopify product lookup

**Files:**
- Modify: `src/components/parent-portal/ProductSelector.tsx`

**Why:** The existing `audioImages` and `clothingImages` memos only return image URLs. We now need the full Shopify `Product` (title, images, descriptionHtml) for cards + modal. This task adds a new helper and a unified `shopifyLookup` memo, then removes the old `audioImages` memo (it will be superseded). Keep `clothingImages` for now — clothing card wiring happens in Task 6.

**Step 1: Add `findProductByVariantId` helper**

In `src/components/parent-portal/ProductSelector.tsx`, below the existing `findProductImageByVariantId` (line ~251), add:

```typescript
// Helper to find the full Shopify Product by variant ID
function findProductByVariantId(products: Product[], variantIdSubstring: string): Product | null {
  for (const product of products) {
    if (product.variants) {
      const hasVariant = product.variants.some(v => v.id.includes(variantIdSubstring));
      if (hasVariant) return product;
    }
  }
  return null;
}
```

**Step 2: Add `shopifyLookup` memo inside the component**

After the existing `clothingImages` memo (line ~372), add a new memo that maps parent-portal product IDs to their full Shopify Product:

```typescript
  // Build map: parent-portal product ID → full Shopify Product (for title, images, descriptionHtml)
  const shopifyLookup = useMemo(() => {
    const map: Record<string, Product | null> = {};
    if (!shopifyProducts?.length) return map;

    // Audio products: direct variant map key
    for (const product of shopProfile.audioProducts) {
      const variantGid = shopProfile.shopifyVariantMap[product.id];
      const numericId = variantGid ? extractVariantNumericId(variantGid) : null;
      map[product.id] = numericId ? findProductByVariantId(shopifyProducts, numericId) : null;
    }

    // Clothing products: find any variant key starting with the product id
    for (const product of activeClothingProducts) {
      const variantPrefix = showPersonalized ? 'personalized' : 'standard';
      const variantKey = Object.keys(shopProfile.shopifyVariantMap)
        .find(k => k.startsWith(`${product.id}-${variantPrefix}-`));
      if (variantKey) {
        const variantGid = shopProfile.shopifyVariantMap[variantKey];
        const numericId = variantGid ? extractVariantNumericId(variantGid) : null;
        map[product.id] = numericId ? findProductByVariantId(shopifyProducts, numericId) : null;
      } else {
        map[product.id] = null;
      }
    }

    return map;
  }, [shopifyProducts, shopProfile, activeClothingProducts, showPersonalized]);
```

**Step 3: Type-check**

```bash
npm run type-check
```
Expected: no new errors (the memo is just computed but not yet consumed).

**Step 4: Commit**

```bash
git add src/components/parent-portal/ProductSelector.tsx
git commit -m "feat(parent-portal): add shopify product lookup by variant ID"
```

---

## Task 5: AudioProductCard rework + wiring

**Files:**
- Modify: `src/components/parent-portal/AudioProductCard.tsx` (full rewrite of interaction model)
- Modify: `src/components/parent-portal/ProductSelector.tsx` (update audio card JSX + handlers)

This is the largest task. The AudioProductCard changes from "tap card to toggle selection" to "tap card opens modal; Add to Cart button on card; qty stepper after first add; golden glow for featured."

**Step 1: Rewrite AudioProductCard**

Read `src/components/parent-portal/AudioProductCard.tsx` first to confirm current shape, then replace the entire component with the new version.

New props interface:

```typescript
interface AudioProductCardProps {
  productId: string;
  name: string;                    // fallback name (used if shopifyTitle missing)
  price: number;
  imageSrc?: string;               // Shopify primary image URL (or fallback)
  imageEmoji?: string;             // fallback emoji (used if imageSrc missing)
  savings?: number;
  featured?: boolean;              // golden glow for Kinderliederbox
  isInCart: boolean;               // whether qty > 0
  quantity: number;
  onCardClick: () => void;         // opens modal
  onAdd: () => void;               // adds 1 to cart
  onQuantityChange: (productId: string, quantity: number) => void;
}
```

Key changes:
- Remove `description` prop (no longer rendered).
- Remove `isSelected` + `onToggle` — replaced by `isInCart` + `onCardClick` + `onAdd`.
- Add `featured` prop for golden glow.
- Card outer div click calls `onCardClick()` (opens modal).
- Remove the checkbox visual.
- Remove the inline `<p>` description.
- When `!isInCart`: show "Add to Cart" button with stopPropagation.
- When `isInCart`: show qty stepper (same +/- pattern but decrement to 0 removes).
- When `featured`: apply golden glow classes.

Complete implementation (overwrite the entire file):

```typescript
'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface AudioProductCardProps {
  productId: string;
  name: string;
  price: number;
  imageSrc?: string;
  imageEmoji?: string;
  savings?: number;
  featured?: boolean;
  isInCart: boolean;
  quantity: number;
  onCardClick: () => void;
  onAdd: () => void;
  onQuantityChange: (productId: string, quantity: number) => void;
}

export default function AudioProductCard({
  productId,
  name,
  price,
  imageSrc,
  imageEmoji,
  savings,
  featured = false,
  isInCart,
  quantity,
  onCardClick,
  onAdd,
  onQuantityChange,
}: AudioProductCardProps) {
  const t = useTranslations('parentPortalCard');

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCardClick();
        }
      }}
      className={cn(
        'relative flex flex-col p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-sage-500',
        featured
          ? 'border-amber-400 bg-amber-50/30 shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:shadow-[0_0_25px_rgba(245,158,11,0.35)]'
          : isInCart
          ? 'border-sage-600 bg-sage-50 shadow-md ring-2 ring-sage-200'
          : 'border-gray-200 bg-white hover:border-sage-300 hover:shadow-md'
      )}
    >
      {/* Savings Badge */}
      {savings && savings > 0 && (
        <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm z-10">
          Spare {savings.toFixed(0)}€
        </div>
      )}

      {/* Product Image or Emoji */}
      <div className="flex justify-center items-center h-24 mb-4 mt-2">
        {imageSrc ? (
          <div className="relative w-24 h-24">
            <Image
              src={imageSrc}
              alt={name}
              fill
              className="object-contain"
            />
          </div>
        ) : imageEmoji ? (
          <span className="text-5xl">{imageEmoji}</span>
        ) : (
          <div className="w-24 h-24 bg-sage-100 rounded-lg flex items-center justify-center">
            <svg className="w-10 h-10 text-sage-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}
      </div>

      {/* Product Info */}
      <h4 className="font-semibold text-gray-900 text-center text-sm leading-tight">
        {name}
      </h4>
      <p className="text-lg font-bold text-gray-900 text-center mt-3">
        €{price.toFixed(2)}
      </p>

      {/* Add to Cart / Qty Stepper */}
      <div className="mt-4 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
        {!isInCart ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className="w-full py-2 px-4 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 transition-colors"
          >
            {t('addToCart')}
          </button>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuantityChange(productId, quantity - 1);
              }}
              className="w-8 h-8 rounded-full border border-gray-300 bg-white flex items-center justify-center hover:bg-gray-50 hover:border-sage-400 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="font-medium w-8 text-center text-lg">{quantity}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuantityChange(productId, Math.min(10, quantity + 1));
              }}
              className="w-8 h-8 rounded-full border border-gray-300 bg-white flex items-center justify-center hover:bg-gray-50 hover:border-sage-400 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Update ProductSelector audio handlers**

In `src/components/parent-portal/ProductSelector.tsx`:

**a) Add audio add handler** (after the existing `handleAudioQuantityChange`, around line ~406):

```typescript
  const handleAudioAdd = (productId: string) => {
    setSelection((prev) => {
      const exists = prev.audioProducts.find(p => p.productId === productId);
      if (exists) {
        // Already in cart — increment by 1
        return {
          ...prev,
          audioProducts: prev.audioProducts.map(p =>
            p.productId === productId ? { ...p, quantity: p.quantity + 1 } : p
          ),
        };
      }
      return {
        ...prev,
        audioProducts: [...prev.audioProducts, { productId: productId as AudioProductId, quantity: 1 }],
      };
    });
  };
```

**b) Update `handleAudioQuantityChange`** to remove item when quantity reaches 0:

Replace the existing handler (lines ~399-406) with:

```typescript
  const handleAudioQuantityChange = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      // Remove from selection
      setSelection((prev) => ({
        ...prev,
        audioProducts: prev.audioProducts.filter(p => p.productId !== productId),
      }));
    } else {
      setSelection((prev) => ({
        ...prev,
        audioProducts: prev.audioProducts.map(p =>
          p.productId === productId ? { ...p, quantity } : p
        ),
      }));
    }
  };
```

**Step 3: Add modal state + update audio card JSX in ProductSelector**

**a) Add modal state** at the top of the component (after the existing `useState` calls):

```typescript
  const [activeDetailProduct, setActiveDetailProduct] = useState<{
    type: 'audio' | 'clothing';
    id: string;
  } | null>(null);
```

**b) Add import for the sheet** at the top of the file:

```typescript
import ParentPortalDetailSheet from './ParentPortalDetailSheet';
```

**c) Replace the AudioProductCard JSX** in the audio section (around lines 617-633).

Replace:
```tsx
            <AudioProductCard
              key={product.id}
              productId={product.id}
              name={product.name}
              description={product.description}
              price={product.price}
              imageSrc={audioImages[product.id] || undefined}
              imageEmoji={product.imageEmoji}
              isSelected={isAudioSelected(product.id)}
              quantity={getAudioQuantity(product.id)}
              savings={product.savings}
              onToggle={handleAudioToggle}
              onQuantityChange={handleAudioQuantityChange}
            />
```

With:
```tsx
            <React.Fragment key={product.id}>
              <AudioProductCard
                productId={product.id}
                name={shopifyLookup[product.id]?.title || product.name}
                price={product.price}
                imageSrc={shopifyLookup[product.id]?.images?.[0]?.url || audioImages[product.id] || undefined}
                imageEmoji={!shopifyLookup[product.id]?.images?.[0]?.url ? product.imageEmoji : undefined}
                savings={product.savings}
                featured={product.featured}
                isInCart={isAudioSelected(product.id)}
                quantity={getAudioQuantity(product.id)}
                onCardClick={() => setActiveDetailProduct({ type: 'audio', id: product.id })}
                onAdd={() => handleAudioAdd(product.id)}
                onQuantityChange={handleAudioQuantityChange}
              />
              {activeDetailProduct?.type === 'audio' && activeDetailProduct.id === product.id && (
                <ParentPortalDetailSheet
                  title={shopifyLookup[product.id]?.title || product.name}
                  descriptionHtml={shopifyLookup[product.id]?.descriptionHtml}
                  images={shopifyLookup[product.id]?.images || []}
                  price={product.price}
                  open={true}
                  onOpenChange={(open) => { if (!open) setActiveDetailProduct(null); }}
                  footer={
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const currentQty = getAudioQuantity(product.id);
                            handleAudioQuantityChange(product.id, currentQty - 1);
                          }}
                          className="w-9 h-9 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-medium">
                          {isAudioSelected(product.id) ? getAudioQuantity(product.id) : 0}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (!isAudioSelected(product.id)) {
                              handleAudioAdd(product.id);
                            } else {
                              handleAudioQuantityChange(product.id, getAudioQuantity(product.id) + 1);
                            }
                          }}
                          className="w-9 h-9 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isAudioSelected(product.id)) {
                            handleAudioAdd(product.id);
                          }
                          setActiveDetailProduct(null);
                        }}
                        className={`flex-1 py-3 rounded-lg font-bold uppercase tracking-wide transition-all duration-200 ${
                          isAudioSelected(product.id)
                            ? 'bg-sage-100 text-sage-700 border border-sage-300'
                            : 'bg-gradient-to-r from-sage-500 to-sage-700 text-white hover:from-sage-600 hover:to-sage-800'
                        }`}
                      >
                        {isAudioSelected(product.id) ? '✓ Hinzugefügt' : 'In den Warenkorb'}
                      </button>
                    </div>
                  }
                />
              )}
            </React.Fragment>
```

**d) Add React import** if not already present at the top of the file:

```typescript
import React from 'react';
```

**Step 4: Type-check**

```bash
npm run type-check
```

**Step 5: Commit**

```bash
git add src/components/parent-portal/AudioProductCard.tsx src/components/parent-portal/ProductSelector.tsx
git commit -m "feat(parent-portal): rework AudioProductCard with modal, add-to-cart, and golden glow"
```

---

## Task 6: ClothingProductCard rework + wiring

**Files:**
- Modify: `src/components/parent-portal/ClothingProductCard.tsx`
- Modify: `src/components/parent-portal/ProductSelector.tsx`

**Step 1: Modify ClothingProductCard**

Read the current file, then apply these changes:

**a) Add new props** to the interface (add these to `ClothingProductCardProps`):

```typescript
  onCardClick?: () => void;        // opens modal
```

**b) Remove description** from the props interface. Remove the `description` parameter from the destructured props. Remove the `<p>` element rendering `{description}` (line ~100-102).

**c) Make the card clickable.** Wrap the outer `<div>` with `role="button"`, `tabIndex={0}`, `onClick`, `onKeyDown`:

```tsx
    <div
      role="button"
      tabIndex={0}
      onClick={() => onCardClick?.()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCardClick?.();
        }
      }}
      className={cn(
        'relative flex flex-col p-6 rounded-xl border-2 transition-all duration-200 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-sage-500',
        isAdded
          ? 'border-sage-400 shadow-md'
          : 'border-gray-200 hover:border-sage-300 hover:shadow-md',
        className
      )}
    >
```

**d) Add stopPropagation** to ALL interactive children inside the card. Update these click handlers:

- Both `<select>` elements: wrap in a `<div onClick={(e) => e.stopPropagation()}>` container around the size selectors section (the `<div className="mt-4 space-y-3">` block).
- Quantity decrement button: `onClick={(e) => { e.stopPropagation(); setQuantity(Math.max(1, quantity - 1)); }}`
- Quantity increment button: `onClick={(e) => { e.stopPropagation(); setQuantity(Math.min(10, quantity + 1)); }}`
- Add/Hinzufügen button: `onClick={(e) => { e.stopPropagation(); handleAdd(); }}`

**e) Use `name` prop directly for the title** (no changes needed — already renders `{name}`).

**Step 2: Update ProductSelector clothing card JSX**

Replace the `<ClothingProductCard>` JSX (around lines 653-665) with:

```tsx
            <React.Fragment key={product.id}>
              <ClothingProductCard
                productId={product.id}
                name={shopifyLookup[product.id]?.title || product.name}
                price={product.price}
                imageSrc={shopifyLookup[product.id]?.images?.[0]?.url || clothingImages[product.id as keyof typeof clothingImages]}
                savings={product.savings}
                showTshirtSize={product.showTshirtSize}
                showHoodieSize={product.showHoodieSize}
                onAdd={handleAddClothing}
                onCardClick={() => setActiveDetailProduct({ type: 'clothing', id: product.id })}
                className={product.id === 'tshirt-hoodie' ? 'col-span-2 lg:col-span-1' : ''}
              />
              {activeDetailProduct?.type === 'clothing' && activeDetailProduct.id === product.id && (
                <ParentPortalDetailSheet
                  title={shopifyLookup[product.id]?.title || product.name}
                  descriptionHtml={shopifyLookup[product.id]?.descriptionHtml}
                  images={shopifyLookup[product.id]?.images || []}
                  price={product.price}
                  open={true}
                  onOpenChange={(open) => { if (!open) setActiveDetailProduct(null); }}
                  footer={
                    <ClothingSheetFooter
                      productId={product.id}
                      showTshirtSize={product.showTshirtSize}
                      showHoodieSize={product.showHoodieSize}
                      onAdd={handleAddClothing}
                      onClose={() => setActiveDetailProduct(null)}
                    />
                  }
                />
              )}
            </React.Fragment>
```

**Step 3: Add ClothingSheetFooter helper component**

Add this inside `ProductSelector.tsx` (above the main export, alongside OrderSummary):

```typescript
function ClothingSheetFooter({
  productId,
  showTshirtSize,
  showHoodieSize,
  onAdd,
  onClose,
}: {
  productId: string;
  showTshirtSize: boolean;
  showHoodieSize: boolean;
  onAdd: (productId: string, tshirtSize: TshirtSize | null, hoodieSize: HoodieSize | null, quantity: number) => void;
  onClose: () => void;
}) {
  const [tshirtSize, setTshirtSize] = useState<TshirtSize>(TSHIRT_SIZES[2]);
  const [hoodieSize, setHoodieSize] = useState<HoodieSize>(HOODIE_SIZES[1]);
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="space-y-3">
      {showTshirtSize && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">
            {showHoodieSize ? 'T-Shirt Größe' : 'Größe wählen'}
          </label>
          <select
            value={tshirtSize}
            onChange={(e) => setTshirtSize(e.target.value as TshirtSize)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-sage-500 focus:border-sage-500"
          >
            {TSHIRT_SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      )}
      {showHoodieSize && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">
            {showTshirtSize ? 'Hoodie Größe' : 'Größe wählen'}
          </label>
          <select
            value={hoodieSize}
            onChange={(e) => setHoodieSize(e.target.value as HoodieSize)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-sage-500 focus:border-sage-500"
          >
            {HOODIE_SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-9 h-9 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50">-</button>
          <span className="w-8 text-center font-medium">{quantity}</span>
          <button type="button" onClick={() => setQuantity(Math.min(10, quantity + 1))}
            className="w-9 h-9 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50">+</button>
        </div>
        <button
          type="button"
          onClick={() => {
            onAdd(productId, showTshirtSize ? tshirtSize : null, showHoodieSize ? hoodieSize : null, quantity);
            onClose();
          }}
          className="flex-1 py-3 rounded-lg font-bold uppercase tracking-wide bg-gradient-to-r from-sage-500 to-sage-700 text-white hover:from-sage-600 hover:to-sage-800 transition-all duration-200"
        >
          Hinzufügen
        </button>
      </div>
    </div>
  );
}
```

**Step 4: Type-check**

```bash
npm run type-check
```

**Step 5: Commit**

```bash
git add src/components/parent-portal/ClothingProductCard.tsx src/components/parent-portal/ProductSelector.tsx
git commit -m "feat(parent-portal): add modal to ClothingProductCard and remove inline description"
```

---

## Task 7: Clean up deprecated code

**Files:**
- Modify: `src/components/parent-portal/ProductSelector.tsx`

**Step 1: Remove `handleAudioToggle`**

The `handleAudioToggle` function (line ~380-397) is no longer called — audio cards use `handleAudioAdd` + `handleAudioQuantityChange` now. Delete it.

**Step 2: Remove `audioImages` memo if no longer referenced**

Check if `audioImages` is still used in the audio card JSX. If the audio card JSX now uses `shopifyLookup[product.id]?.images?.[0]?.url || audioImages[product.id]`, then `audioImages` is still a fallback. In that case, keep it. If it's fully replaced by `shopifyLookup`, remove the `audioImages` memo.

**Step 3: Type-check + lint**

```bash
npm run type-check
npx next lint --dir src/components/parent-portal
```

**Step 4: Commit**

```bash
git add src/components/parent-portal/ProductSelector.tsx
git commit -m "refactor(parent-portal): remove deprecated audio toggle handler"
```

---

## Task 8: Final verification

**Step 1: Run ALL tests**

```bash
npm test
```
Expected: same 5 pre-existing failures in eventTimeline. No new failures.

**Step 2: Run parent-portal-specific tests**

```bash
npx jest tests/unit/components/ParentPortalDetailSheet.test.tsx
```
Expected: 7/7 pass.

**Step 3: Type-check**

```bash
npm run type-check
```
Expected: no new errors in source files.

**Step 4: Lint**

```bash
npx next lint --dir src/components/parent-portal --dir src/components/shop --dir src/lib/config
```
Expected: no new errors.

**Step 5: Git status**

```bash
git status
git log --oneline f654e26..HEAD
```
Expected: clean tree, ~6-7 commits ahead.

---

## Out of scope (do not build)

- Changes to `/familie/shop` components (preserved from prior work).
- URL deep-linking.
- Analytics events.
- Pricing changes (hardcoded prices remain source of truth).
- Checkout flow changes.
- Refactoring shared logic between card types.

## When done

Use `superpowers:finishing-a-development-branch` to choose merge / PR / cleanup.
