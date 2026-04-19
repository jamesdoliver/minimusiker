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

import ParentPortalDetailSheet from '@/components/parent-portal/ParentPortalDetailSheet';

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
    // price.toFixed(2) renders as "€39.00"
    expect(screen.getByText('€39.00')).toBeInTheDocument();
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
