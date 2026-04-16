# Parent Portal — Product Detail Sheet Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a bottom-sheet modal to `/familie/shop` product cards that surfaces extended product descriptions and a swipeable image gallery, sourced from the existing Shopify payload.

**Architecture:** A new `ProductDetailSheet` component built on `vaul`. State is owned per-card inside `ProductCard`. Content (`descriptionHtml`, `images[]`) comes from the existing `useProducts` payload — Shopify GraphQL query is extended to include `descriptionHtml` and bumped from `first: 5` to `first: 10` images. Description HTML is sanitized via `isomorphic-dompurify` before render.

**Tech Stack:** Next.js 14 (App Router) · React 18 · TypeScript · Tailwind · `vaul` (drawer) · `isomorphic-dompurify` (HTML sanitization) · Jest + React Testing Library · `next-intl`

**Reference design:** `docs/plans/2026-04-16-parent-portal-product-detail-sheet-design.md`

---

## Worktree

All work in: `.worktrees/parent_portal_rework/` on branch `parent_portal_rework`.

```bash
cd /Users/jamesoliver/WebstormProjects/MiniMusiker/.worktrees/parent_portal_rework
```

## Pre-existing test failures

5 tests in `src/lib/utils/eventTimeline.test.ts` fail on `main` due to date arithmetic (off-by-one, timezone-related). **Do not fix these** — they predate this work. When running tests, ignore these failures; focus only on the new tests in this plan.

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

**Step 1: Install vaul and isomorphic-dompurify**

Run:
```bash
npm install vaul isomorphic-dompurify
```

Expected: `package.json` gains both deps. No type packages needed — both ship their own types.

**Step 2: Verify install**

Run:
```bash
node -e "console.log(require('vaul/package.json').version, require('isomorphic-dompurify/package.json').version)"
```
Expected: prints two version strings, no errors.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add vaul and isomorphic-dompurify for product detail sheet"
```

---

## Task 2: Extend Shopify payload with descriptionHtml + more images

**Files:**
- Modify: `src/lib/types/airtable.ts:337-367` (Product interface)
- Modify: `src/lib/services/shopifyService.ts:71-157` (getProducts query + transform)

**Why:** The current GraphQL query selects `description` (plain text) and `images(first: 5)`. The sheet needs rich `descriptionHtml` and up to 10 images for the carousel.

**Step 1: Add `descriptionHtml` to the `Product` type**

Edit `src/lib/types/airtable.ts:340`. After `description: string;` add:

```typescript
  descriptionHtml?: string;
```

**Step 2: Add `descriptionHtml` and bump image count in `getProducts` query**

Edit `src/lib/services/shopifyService.ts:79`. Below the `description` line add:

```graphql
              descriptionHtml
```

Edit `src/lib/services/shopifyService.ts:84`. Change `images(first: 5)` to `images(first: 10)`.

**Step 3: Map `descriptionHtml` in `transformProduct`**

Edit `src/lib/services/shopifyService.ts:664` (the `transformProduct` method). After the `description: shopifyProduct.description,` line add:

```typescript
      descriptionHtml: shopifyProduct.descriptionHtml,
```

**Step 4: Type-check**

Run:
```bash
npm run type-check
```
Expected: passes with no new errors. (Pre-existing errors elsewhere are fine if unchanged.)

**Step 5: Commit**

```bash
git add src/lib/types/airtable.ts src/lib/services/shopifyService.ts
git commit -m "feat(shopify): include descriptionHtml and 10 images per product"
```

---

## Task 3: Add i18n keys for the sheet

**Files:**
- Modify: `messages/de.json`
- Modify: `messages/en.json`

**Step 1: Add `productSheet` block + `productCard.productDetails` to `messages/de.json`**

Inside the `"shop"` object, after the `"productCard"` block add a new sibling:

```json
    "productSheet": {
      "close": "Schließen",
      "descriptionFallback": "Weitere Details folgen in Kürze.",
      "ariaLabel": "Produktdetails für {title}"
    },
```

Inside the existing `"productCard"` block, add a new key (before the closing `}`):

```json
      "productDetails": "Produktdetails"
```

(Remember to add a comma to the previous line so the JSON stays valid.)

**Step 2: Add the same structure to `messages/en.json`**

```json
    "productSheet": {
      "close": "Close",
      "descriptionFallback": "More details coming soon.",
      "ariaLabel": "Product details for {title}"
    },
```

```json
      "productDetails": "Product Details"
```

**Step 3: Validate JSON**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('messages/de.json', 'utf8')); JSON.parse(require('fs').readFileSync('messages/en.json', 'utf8')); console.log('OK')"
```
Expected: prints `OK`.

**Step 4: Commit**

```bash
git add messages/de.json messages/en.json
git commit -m "i18n: add product detail sheet copy (de + en)"
```

---

## Task 4: Create ProductDetailSheet — render, title, description, fallback

**Files:**
- Create: `src/components/shop/ProductDetailSheet.tsx`
- Create: `tests/unit/components/ProductDetailSheet.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/components/ProductDetailSheet.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { CartProvider } from '@/lib/contexts/CartContext';
import ProductDetailSheet from '@/components/shop/ProductDetailSheet';
import type { Product } from '@/lib/types/airtable';
import enMessages from '../../../messages/en.json';

const baseProduct: Product = {
  id: 'gid://shopify/Product/1',
  title: 'MiniMusiker T-Shirt',
  description: 'A lovely shirt.',
  descriptionHtml: '<p>A <strong>lovely</strong> shirt.</p>',
  productType: 'T-Shirt',
  handle: 'minimusiker-tshirt',
  tags: ['minimusiker-shop'],
  availableForSale: true,
  images: [
    { id: 'img1', url: 'https://cdn.shopify.com/img1.jpg', altText: 'Front' },
  ],
  priceRange: {
    minVariantPrice: { amount: '20.00', currencyCode: 'EUR' },
    maxVariantPrice: { amount: '20.00', currencyCode: 'EUR' },
  },
  variants: [
    {
      id: 'gid://shopify/ProductVariant/1',
      title: 'Size M',
      availableForSale: true,
      price: { amount: '20.00', currencyCode: 'EUR' },
      compareAtPrice: null,
      image: null,
      selectedOptions: [{ name: 'Size', value: 'M' }],
    } as any,
  ],
};

function renderSheet(product: Product, open = true) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CartProvider>
        <ProductDetailSheet product={product} open={open} onOpenChange={() => {}} />
      </CartProvider>
    </NextIntlClientProvider>
  );
}

describe('ProductDetailSheet', () => {
  it('renders the product title when open', () => {
    renderSheet(baseProduct);
    expect(screen.getByRole('heading', { name: 'MiniMusiker T-Shirt' })).toBeInTheDocument();
  });

  it('renders sanitized descriptionHtml', () => {
    renderSheet(baseProduct);
    // <strong> survives sanitization
    expect(screen.getByText('lovely').tagName).toBe('STRONG');
  });

  it('strips script tags from descriptionHtml', () => {
    const malicious = {
      ...baseProduct,
      descriptionHtml: '<p>Hello</p><script>window.__pwned = true;</script>',
    };
    renderSheet(malicious);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });

  it('shows fallback text when descriptionHtml is missing and description is empty', () => {
    const noDesc = { ...baseProduct, description: '', descriptionHtml: undefined };
    renderSheet(noDesc);
    expect(screen.getByText('More details coming soon.')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    renderSheet(baseProduct, false);
    expect(screen.queryByRole('heading', { name: 'MiniMusiker T-Shirt' })).not.toBeInTheDocument();
  });
});
```

**Step 2: Run the test to confirm it fails**

Run:
```bash
npm test -- tests/unit/components/ProductDetailSheet.test.tsx
```
Expected: FAIL with "Cannot find module '@/components/shop/ProductDetailSheet'".

**Step 3: Implement `ProductDetailSheet.tsx`**

Create `src/components/shop/ProductDetailSheet.tsx`:

```typescript
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Drawer } from 'vaul';
import DOMPurify from 'isomorphic-dompurify';
import { useTranslations } from 'next-intl';
import type { Product, ProductVariant } from '@/lib/types/airtable';
import { useCart } from '@/lib/contexts/CartContext';
import { formatPrice } from '@/lib/utils';

interface ProductDetailSheetProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProductDetailSheet({ product, open, onOpenChange }: ProductDetailSheetProps) {
  const t = useTranslations('shop.productSheet');
  const tCard = useTranslations('shop.productCard');
  const { addItem } = useCart();

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>(product.variants[0]);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);

  const sizeOptions = product.variants
    .map((v) => v.selectedOptions.find((opt) => opt.name === 'Size')?.value)
    .filter((value, index, self) => value && self.indexOf(value) === index) as string[];

  const selectedSize = selectedVariant.selectedOptions.find((opt) => opt.name === 'Size')?.value;

  const price = parseFloat(selectedVariant.price.amount);
  const compareAtPrice = selectedVariant.compareAtPrice
    ? parseFloat(selectedVariant.compareAtPrice.amount)
    : null;
  const hasDiscount = compareAtPrice && compareAtPrice > price;

  const sanitizedHtml = product.descriptionHtml
    ? DOMPurify.sanitize(product.descriptionHtml, { USE_PROFILES: { html: true } })
    : '';
  const hasDescription = sanitizedHtml.trim().length > 0 || (product.description?.trim().length ?? 0) > 0;

  const handleSizeSelect = (size: string) => {
    const variant = product.variants.find(
      (v) => v.selectedOptions.find((opt) => opt.name === 'Size')?.value === size
    );
    if (variant) setSelectedVariant(variant);
  };

  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      addItem(product, selectedVariant, quantity);
      setQuantity(1);
    } finally {
      setTimeout(() => setIsAdding(false), 500);
    }
  };

  const images = product.images.length > 0 ? product.images : [];

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Drawer.Content
          aria-label={t('ariaLabel', { title: product.title })}
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
                  src={images[activeImageIndex].url}
                  alt={images[activeImageIndex].altText || product.title}
                  fill
                  loading="lazy"
                  className="object-contain p-4"
                  sizes="(max-width: 768px) 100vw, 640px"
                />
                {images.length > 1 && (
                  <>
                    {/* Prev / next overlay tap zones */}
                    <button
                      type="button"
                      aria-label="Previous image"
                      onClick={() => setActiveImageIndex((i) => (i - 1 + images.length) % images.length)}
                      className="absolute left-0 top-0 bottom-0 w-1/3"
                    />
                    <button
                      type="button"
                      aria-label="Next image"
                      onClick={() => setActiveImageIndex((i) => (i + 1) % images.length)}
                      className="absolute right-0 top-0 bottom-0 w-1/3"
                    />
                    {/* Pagination dots */}
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          aria-label={`Go to image ${i + 1}`}
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
              <h2 className="font-heading text-2xl text-minimusik-heading mb-2">
                {product.title}
              </h2>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-sage-700">
                  {formatPrice(price * 100)}
                </span>
                {hasDiscount && (
                  <span className="text-base text-gray-400 line-through">
                    {formatPrice(compareAtPrice * 100)}
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="px-6 pb-6">
              {hasDescription ? (
                sanitizedHtml ? (
                  <div
                    className="prose prose-sm max-w-none prose-headings:text-minimusik-heading prose-a:text-sage-700"
                    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                  />
                ) : (
                  <p className="text-gray-700 whitespace-pre-line">{product.description}</p>
                )
              ) : (
                <p className="text-gray-500 italic">{t('descriptionFallback')}</p>
              )}
            </div>
          </div>

          {/* Sticky footer */}
          <div
            className="border-t border-gray-200 bg-white px-6 pt-4 pb-6"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
          >
            {sizeOptions.length > 1 && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {tCard('size')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {sizeOptions.map((size) => {
                    const variant = product.variants.find(
                      (v) => v.selectedOptions.find((opt) => opt.name === 'Size')?.value === size
                    );
                    const isAvailable = variant?.availableForSale;
                    const isSelected = selectedSize === size;
                    return (
                      <button
                        key={size}
                        onClick={() => handleSizeSelect(size)}
                        disabled={!isAvailable}
                        className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                          isSelected
                            ? 'bg-sage-500 text-white border-sage-500'
                            : isAvailable
                            ? 'bg-white text-gray-700 border-gray-300 hover:border-sage-500'
                            : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-9 h-9 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
                >
                  -
                </button>
                <span className="w-8 text-center font-medium">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-9 h-9 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!selectedVariant.availableForSale || isAdding}
                className={`flex-1 py-3 rounded-lg font-button font-bold uppercase tracking-wide transition-all duration-200 ${
                  selectedVariant.availableForSale
                    ? 'bg-gradient-to-r from-sage-500 to-sage-700 text-white hover:from-sage-600 hover:to-sage-800'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isAdding ? tCard('adding') : selectedVariant.availableForSale ? tCard('addToCart') : tCard('outOfStock')}
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
```

**Step 4: Run the test to confirm it passes**

Run:
```bash
npm test -- tests/unit/components/ProductDetailSheet.test.tsx
```
Expected: 5 tests pass.

If a test about "STRONG" tag fails because DOMPurify produces `<p>A <strong>lovely</strong> shirt.</p>` and Testing Library's `getByText` matches only the full string, change the assertion to:

```typescript
const strong = document.querySelector('.prose strong');
expect(strong?.textContent).toBe('lovely');
```

**Step 5: Commit**

```bash
git add src/components/shop/ProductDetailSheet.tsx tests/unit/components/ProductDetailSheet.test.tsx
git commit -m "feat(shop): add ProductDetailSheet bottom-sheet modal"
```

---

## Task 5: Test multi-image carousel & single-image behaviour

**Files:**
- Modify: `tests/unit/components/ProductDetailSheet.test.tsx`

**Step 1: Add tests for carousel dots**

Append inside the `describe('ProductDetailSheet', ...)` block:

```typescript
it('renders pagination dots when product has multiple images', () => {
  const multiImage = {
    ...baseProduct,
    images: [
      { id: 'img1', url: 'https://cdn.shopify.com/img1.jpg', altText: 'Front' },
      { id: 'img2', url: 'https://cdn.shopify.com/img2.jpg', altText: 'Back' },
      { id: 'img3', url: 'https://cdn.shopify.com/img3.jpg', altText: 'Detail' },
    ],
  };
  renderSheet(multiImage);
  expect(screen.getByLabelText('Go to image 1')).toBeInTheDocument();
  expect(screen.getByLabelText('Go to image 2')).toBeInTheDocument();
  expect(screen.getByLabelText('Go to image 3')).toBeInTheDocument();
});

it('hides pagination dots when product has only one image', () => {
  renderSheet(baseProduct);
  expect(screen.queryByLabelText('Go to image 1')).not.toBeInTheDocument();
});
```

**Step 2: Run tests**

Run:
```bash
npm test -- tests/unit/components/ProductDetailSheet.test.tsx
```
Expected: all 7 tests pass (no implementation change needed — Task 4 already supports this).

**Step 3: Commit**

```bash
git add tests/unit/components/ProductDetailSheet.test.tsx
git commit -m "test(shop): cover carousel dots for single + multi-image products"
```

---

## Task 6: Test add-to-cart from inside the sheet

**Files:**
- Modify: `tests/unit/components/ProductDetailSheet.test.tsx`

**Step 1: Add test that clicking "Add to Cart" calls the cart**

Replace the existing `import { CartProvider }` line at the top with both the provider and the hook:

```typescript
import { CartProvider, useCart } from '@/lib/contexts/CartContext';
```

Append a test (still inside the describe block):

```typescript
it('adds item to cart when Add to Cart is clicked in the footer', async () => {
  let cartItems: any[] = [];
  function CartSpy() {
    const cart = useCart();
    cartItems = cart.items;
    return null;
  }

  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CartProvider>
        <CartSpy />
        <ProductDetailSheet product={baseProduct} open={true} onOpenChange={() => {}} />
      </CartProvider>
    </NextIntlClientProvider>
  );

  const addButton = screen.getByRole('button', { name: /add to cart/i });
  addButton.click();

  // Wait a tick for state to settle
  await new Promise((r) => setTimeout(r, 10));
  expect(cartItems.length).toBe(1);
  expect(cartItems[0].variant.id).toBe('gid://shopify/ProductVariant/1');
});
```

**Step 2: Run tests**

Run:
```bash
npm test -- tests/unit/components/ProductDetailSheet.test.tsx
```
Expected: 8 tests pass.

If `useCart` shape differs (e.g., property is `cart` not `items`), inspect `src/lib/contexts/CartContext.tsx` and adjust the assertion.

**Step 3: Commit**

```bash
git add tests/unit/components/ProductDetailSheet.test.tsx
git commit -m "test(shop): verify ProductDetailSheet adds to cart"
```

---

## Task 7: Wire ProductDetailSheet into ProductCard

**Files:**
- Modify: `src/components/shop/ProductCard.tsx`

**Step 1: Add open state, the sheet, and the Product Details button**

Edit `src/components/shop/ProductCard.tsx`. Apply the following changes:

At the top of the file, add the import:

```typescript
import ProductDetailSheet from './ProductDetailSheet';
```

After the existing `useState` declarations inside the component, add:

```typescript
const [isSheetOpen, setIsSheetOpen] = useState(false);
```

Wrap the outer `<div className="bg-white rounded-lg ...">` so the whole card opens the sheet on click. Convert the outer div to a `<div role="button" tabIndex={0} ... onClick={...} onKeyDown={...}>`. Replace the existing outer div on `ProductCard.tsx:61` with:

```tsx
    <>
    <div
      role="button"
      tabIndex={0}
      onClick={() => setIsSheetOpen(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsSheetOpen(true);
        }
      }}
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden group flex flex-col h-full text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-sage-500"
    >
```

Find the closing `</div>` that matches the outer card div (currently the last line of the JSX before the trailing `);`). Append the sheet and close the fragment:

```tsx
    </div>
    <ProductDetailSheet
      product={product}
      open={isSheetOpen}
      onOpenChange={setIsSheetOpen}
    />
    </>
```

**Step 2: Add a "Product Details" button under the price**

Inside the `Product Info` block, immediately after the price `<div className="flex items-baseline gap-2 mb-4">...</div>` (around line 124), insert:

```tsx
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsSheetOpen(true);
          }}
          className="self-start mb-4 text-sm font-medium text-sage-700 hover:text-sage-800 inline-flex items-center gap-1"
        >
          {t('productDetails')}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
```

**Step 3: Add stopPropagation to inline controls so they don't open the sheet**

Edit each of the following click handlers in `ProductCard.tsx` to call `e.stopPropagation()` first:

- Size buttons (`onClick={() => handleSizeSelect(size)}`) → change to `onClick={(e) => { e.stopPropagation(); handleSizeSelect(size); }}`
- Quantity decrement button → `onClick={(e) => { e.stopPropagation(); setQuantity(Math.max(1, quantity - 1)); }}`
- Quantity increment button → `onClick={(e) => { e.stopPropagation(); setQuantity(quantity + 1); }}`
- Add to Cart button → `onClick={(e) => { e.stopPropagation(); handleAddToCart(); }}`

**Step 4: Type-check**

Run:
```bash
npm run type-check
```
Expected: passes with no new errors.

**Step 5: Commit**

```bash
git add src/components/shop/ProductCard.tsx
git commit -m "feat(shop): open product detail sheet from card and Product Details button"
```

---

## Task 8: Test ProductCard sheet wiring

**Files:**
- Create: `tests/unit/components/ProductCard.test.tsx`

**Step 1: Write tests for card → sheet wiring**

Create `tests/unit/components/ProductCard.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { CartProvider, useCart } from '@/lib/contexts/CartContext';
import ProductCard from '@/components/shop/ProductCard';
import type { Product } from '@/lib/types/airtable';
import enMessages from '../../../messages/en.json';

const product: Product = {
  id: 'gid://shopify/Product/1',
  title: 'Test Hoodie',
  description: 'Cozy.',
  descriptionHtml: '<p>Cozy.</p>',
  productType: 'Hoodie',
  handle: 'test-hoodie',
  tags: ['minimusiker-shop'],
  availableForSale: true,
  images: [{ id: 'img1', url: 'https://cdn.shopify.com/img1.jpg', altText: 'Front' }],
  priceRange: {
    minVariantPrice: { amount: '40.00', currencyCode: 'EUR' },
    maxVariantPrice: { amount: '40.00', currencyCode: 'EUR' },
  },
  variants: [
    {
      id: 'gid://shopify/ProductVariant/1',
      title: 'Size M',
      availableForSale: true,
      price: { amount: '40.00', currencyCode: 'EUR' },
      compareAtPrice: null,
      image: null,
      selectedOptions: [{ name: 'Size', value: 'M' }],
    } as any,
    {
      id: 'gid://shopify/ProductVariant/2',
      title: 'Size L',
      availableForSale: true,
      price: { amount: '40.00', currencyCode: 'EUR' },
      compareAtPrice: null,
      image: null,
      selectedOptions: [{ name: 'Size', value: 'L' }],
    } as any,
  ],
};

function renderCard() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CartProvider>
        <ProductCard product={product} />
      </CartProvider>
    </NextIntlClientProvider>
  );
}

describe('ProductCard with detail sheet', () => {
  it('does not show the sheet by default', () => {
    renderCard();
    // Sheet's title is an h2; card's title is an h3 — checking for h2 is the cleanest signal
    expect(screen.queryByRole('heading', { level: 2, name: 'Test Hoodie' })).not.toBeInTheDocument();
  });

  it('opens the sheet when the card body is clicked', () => {
    renderCard();
    const card = screen.getByRole('button', { name: /test hoodie/i });
    fireEvent.click(card);
    expect(screen.getByRole('heading', { level: 2, name: 'Test Hoodie' })).toBeInTheDocument();
  });

  it('opens the sheet when the Product Details button is clicked', () => {
    renderCard();
    const detailsBtn = screen.getByRole('button', { name: /product details/i });
    fireEvent.click(detailsBtn);
    expect(screen.getByRole('heading', { level: 2, name: 'Test Hoodie' })).toBeInTheDocument();
  });

  it('does not open the sheet when a size button on the card is clicked', () => {
    renderCard();
    // Card has size buttons "M" and "L"; pick "L" (not the default)
    const sizeButton = screen.getByRole('button', { name: 'L' });
    fireEvent.click(sizeButton);
    expect(screen.queryByRole('heading', { level: 2, name: 'Test Hoodie' })).not.toBeInTheDocument();
  });

  it('does not open the sheet when Add to Cart on the card is clicked', () => {
    let cartItems: any[] = [];
    function CartSpy() {
      const cart = useCart();
      cartItems = cart.items;
      return null;
    }
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <CartProvider>
          <CartSpy />
          <ProductCard product={product} />
        </CartProvider>
      </NextIntlClientProvider>
    );
    const cardCta = screen.getAllByRole('button', { name: /add to cart/i })[0];
    fireEvent.click(cardCta);
    expect(screen.queryByRole('heading', { level: 2, name: 'Test Hoodie' })).not.toBeInTheDocument();
    expect(cartItems.length).toBe(1);
  });
});
```

**Step 2: Run tests**

Run:
```bash
npm test -- tests/unit/components/ProductCard.test.tsx
```
Expected: 5 tests pass.

If the cart context shape differs and the CartSpy assertion fails, inspect `src/lib/contexts/CartContext.tsx` and adjust the property name. The other 4 tests do not depend on cart shape.

**Step 3: Commit**

```bash
git add tests/unit/components/ProductCard.test.tsx
git commit -m "test(shop): cover ProductCard → ProductDetailSheet wiring"
```

---

## Task 9: Final verification

**Step 1: Run the full new-test set**

Run:
```bash
npm test -- tests/unit/components/ProductDetailSheet.test.tsx tests/unit/components/ProductCard.test.tsx
```
Expected: all 13 new tests pass.

**Step 2: Type-check the whole project**

Run:
```bash
npm run type-check
```
Expected: no new errors compared to `main`.

**Step 3: Lint the changed files**

Run:
```bash
npm run lint -- --file src/components/shop/ProductCard.tsx --file src/components/shop/ProductDetailSheet.tsx
```
If `--file` is not supported by the lint script, just run `npm run lint` and visually confirm no new errors in shop files.

**Step 4: Manual smoke check (optional but recommended)**

Run `npm run dev`, open `http://localhost:3000/familie/shop` after parent login, and verify on a mobile viewport (Chrome DevTools mobile emulation, iPhone 12):
- Tap a product card → sheet slides up to ~90% height.
- Tap "Product Details" → same behavior.
- Tap a size button on the card → does NOT open the sheet, just selects the size.
- Carousel dots appear only for products with multiple images.
- Description renders with formatting (bold, lists, etc.).
- Add to Cart from inside the sheet adds the product and resets quantity.
- Swipe sheet down → closes.
- Tap backdrop → closes.

**Step 5: Confirm clean status**

Run:
```bash
git status
git log --oneline main..HEAD
```
Expected: working tree clean, ~7 commits ahead of `main`.

---

## Out of scope (do not build)

- URL deep-linking (`?product=handle`)
- Analytics events
- Reviews / ratings / related products
- Search inside the sheet
- Hardcoded product content (all data flows through Shopify)
- Refactoring shared cart-control logic between card and sheet — duplication is small and intentional (YAGNI)

## When done

Use `superpowers:finishing-a-development-branch` to choose between merge / PR / cleanup.
