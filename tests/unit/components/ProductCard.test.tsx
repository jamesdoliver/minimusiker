import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import enMessages from '../../../messages/en.json';

// Mock next-intl: walk a dot-path through enMessages and apply {var} interpolation.
// (Matches the file-local pattern used in ProductDetailSheet.test.tsx — the project's
// Jest config doesn't transpile next-intl ESM, so we avoid jest.requireActual('next-intl').)
jest.mock('next-intl', () => {
  const get = (obj: any, path: string) =>
    path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
  return {
    useTranslations: (namespace: string) => (key: string, vars?: Record<string, string | number>) => {
      const full = namespace ? `${namespace}.${key}` : key;
      const value = get(enMessages, full);
      if (typeof value !== 'string') return full;
      if (!vars) return value;
      return value.replace(/\{(\w+)\}/g, (_match, name) =>
        vars[name] !== undefined ? String(vars[name]) : `{${name}}`
      );
    },
    NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// Mock next/image — strips Next-only props
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...rest }: any) => {
    const { fill, sizes, loading, ...imgProps } = rest;
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return <img src={typeof src === 'string' ? src : ''} alt={alt} {...imgProps} />;
  },
}));

import { NextIntlClientProvider } from 'next-intl';
import { CartProvider, useCart } from '@/lib/contexts/CartContext';
import ProductCard from '@/components/shop/ProductCard';
import type { Product } from '@/lib/types/airtable';

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
    // The sheet's title is an h2; the card's title is an h3.
    // If a level-2 heading with the product title exists, the sheet is open.
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Test Hoodie' })
    ).not.toBeInTheDocument();
  });

  it('opens the sheet when the card body is clicked', () => {
    renderCard();
    // The card itself has aria-label "Product details for Test Hoodie"
    const card = screen.getByRole('button', { name: /product details for test hoodie/i });
    fireEvent.click(card);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Test Hoodie' })
    ).toBeInTheDocument();
  });

  it('opens the sheet when the Product Details button is clicked', () => {
    renderCard();
    // Match the visible "Product Details" button text exactly (not the card's aria-label)
    const detailsBtn = screen.getByRole('button', { name: /^product details$/i });
    fireEvent.click(detailsBtn);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Test Hoodie' })
    ).toBeInTheDocument();
  });

  it('does not open the sheet when a size button on the card is clicked', () => {
    renderCard();
    // Pick the L size (not the default M)
    const sizeButton = screen.getByRole('button', { name: 'L' });
    fireEvent.click(sizeButton);
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Test Hoodie' })
    ).not.toBeInTheDocument();
  });

  it('does not open the sheet when Add to Cart on the card is clicked', () => {
    let cartItems: any[] = [];
    function CartSpy() {
      const cart = useCart();
      cartItems = cart.cart.items;
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

    // First button matching add-to-cart will be the card's CTA (sheet is closed so its footer button isn't rendered).
    const cardCta = screen.getAllByRole('button', { name: /add to cart/i })[0];
    fireEvent.click(cardCta);

    expect(
      screen.queryByRole('heading', { level: 2, name: 'Test Hoodie' })
    ).not.toBeInTheDocument();
    expect(cartItems.length).toBe(1);
  });
});
