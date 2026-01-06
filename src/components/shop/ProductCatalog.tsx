'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Product } from '@/lib/types/airtable';
import ProductCard from './ProductCard';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface ProductCatalogProps {
  products: Product[];
  isLoading?: boolean;
  error?: string | null;
}

export default function ProductCatalog({ products, isLoading, error }: ProductCatalogProps) {
  const t = useTranslations('shop.catalog');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Define product categories with translations
  const CATEGORIES = [
    { id: 'all', label: t('categoryAll') },
    { id: 'apparel', label: t('categoryApparel'), types: ['T-Shirt', 'Hoodie'] },
    { id: 'accessories', label: t('categoryAccessories'), types: ['Baseball Cap', 'Tote Bag', 'Bluetooth Box'] },
    { id: 'digital', label: t('categoryDigital'), types: ['PDF', 'Digital'] },
  ];

  // Filter products by category
  const filteredProducts =
    selectedCategory === 'all'
      ? products
      : products.filter((product) => {
          const category = CATEGORIES.find((c) => c.id === selectedCategory);
          if (!category || !category.types) return true;
          return category.types.some(
            (type) =>
              product.productType.toLowerCase().includes(type.toLowerCase()) ||
              product.title.toLowerCase().includes(type.toLowerCase())
          );
        });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600 font-medium">{t('errorLoading')}</p>
        <p className="text-red-500 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="bg-cream-100 rounded-lg p-12 text-center">
        <svg
          className="mx-auto h-16 w-16 text-gray-400 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
        <h3 className="font-heading text-xl text-gray-600 mb-2">{t('noProducts')}</h3>
        <p className="text-gray-500">{t('noProductsSubtext')}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Category Tabs */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`
                px-4 py-2 rounded-full text-sm font-medium transition-colors
                ${
                  selectedCategory === category.id
                    ? 'bg-sage-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-sage-50 border border-gray-200'
                }
              `}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="bg-cream-100 rounded-lg p-8 text-center">
          <p className="text-gray-600">{t('noProductsInCategory')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Product Count */}
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          {t('showingCount', { count: filteredProducts.length, total: products.length })}
        </p>
      </div>
    </div>
  );
}
