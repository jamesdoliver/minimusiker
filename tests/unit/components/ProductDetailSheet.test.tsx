import { render, screen } from '@testing-library/react';
import React from 'react';
import enMessages from '../../../messages/en.json';

// Mock next-intl: walk a dot-path through enMessages and apply {var} interpolation.
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

// Mock next/image to render a basic <img>, since jsdom doesn't run the next loader.
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...rest }: any) => {
    // Strip props that aren't valid on raw <img>
    const { fill, sizes, loading, ...imgProps } = rest;
    return <img src={typeof src === 'string' ? src : ''} alt={alt} {...imgProps} />;
  },
}));

import { NextIntlClientProvider } from 'next-intl';
import { CartProvider, useCart } from '@/lib/contexts/CartContext';
import ProductDetailSheet from '@/components/shop/ProductDetailSheet';
import type { Product } from '@/lib/types/airtable';

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

  it('adds item to cart when Add to Cart is clicked in the footer', async () => {
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
});
