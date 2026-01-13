'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCart } from '@/lib/contexts/CartContext';
import LanguageSelector from '@/components/shared/LanguageSelector';

export default function ShopHeader() {
  const t = useTranslations('shop.header');
  const { cart, setIsCartOpen } = useCart();

  return (
    <div className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4 py-6">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link href="/familie" className="hover:text-sage-600">
            {t('breadcrumbPortal')}
          </Link>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <span className="text-gray-900">{t('breadcrumbShop')}</span>
        </nav>

        {/* Header Content */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-heading text-4xl md:text-5xl text-minimusik-heading mb-2">
              {t('title')}
            </h1>
            <p className="text-gray-600 text-lg">
              {t('subtitle')}
            </p>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            {/* Language Selector */}
            <LanguageSelector />

            {/* Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-3 bg-cream-100 rounded-lg hover:bg-cream-200 transition-colors"
            >
              <svg
                className="w-6 h-6 text-minimusik-heading"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              {cart.itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-minimusik-accent text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                  {cart.itemCount > 9 ? '9+' : cart.itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
