'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Product, ProductVariant } from '@/lib/types/airtable';
import { useCart } from '@/lib/contexts/CartContext';
import { formatPrice } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const t = useTranslations('shop.productCard');
  const { addItem } = useCart();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>(product.variants[0]);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  // Get unique size options from variants
  const sizeOptions = product.variants
    .map((v) => v.selectedOptions.find((opt) => opt.name === 'Size')?.value)
    .filter((value, index, self) => value && self.indexOf(value) === index) as string[];

  // Get primary image
  const primaryImage = product.images[0];

  // Calculate display price
  const price = parseFloat(selectedVariant.price.amount);
  const compareAtPrice = selectedVariant.compareAtPrice
    ? parseFloat(selectedVariant.compareAtPrice.amount)
    : null;
  const hasDiscount = compareAtPrice && compareAtPrice > price;

  // Handle variant selection
  const handleSizeSelect = (size: string) => {
    const variant = product.variants.find(
      (v) => v.selectedOptions.find((opt) => opt.name === 'Size')?.value === size
    );
    if (variant) {
      setSelectedVariant(variant);
    }
  };

  // Handle add to cart
  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      addItem(product, selectedVariant, quantity);
      setQuantity(1); // Reset quantity after adding
    } finally {
      setTimeout(() => setIsAdding(false), 500);
    }
  };

  // Get selected size
  const selectedSize = selectedVariant.selectedOptions.find((opt) => opt.name === 'Size')?.value;

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden group flex flex-col h-full">
      {/* Product Image */}
      <div className="relative aspect-square overflow-hidden bg-cream-100 p-4">
        {primaryImage ? (
          <Image
            src={primaryImage.url}
            alt={primaryImage.altText || product.title}
            fill
            className="object-contain group-hover:scale-110 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <svg
              className="w-16 h-16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Discount Badge */}
        {hasDiscount && (
          <div className="absolute top-3 left-3 bg-minimusik-accent text-white text-xs font-bold px-2 py-1 rounded">
            {t('sale')}
          </div>
        )}

        {/* Out of Stock Badge */}
        {!selectedVariant.availableForSale && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-white text-gray-800 font-bold px-4 py-2 rounded">
              {t('outOfStock')}
            </span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-6 flex flex-col flex-grow">
        {/* Title */}
        <h3 className="font-heading text-xl text-minimusik-heading mb-2 line-clamp-2">
          {product.title}
        </h3>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-xl font-bold text-sage-700">
            {formatPrice(price * 100)}
          </span>
          {hasDiscount && (
            <span className="text-sm text-gray-400 line-through">
              {formatPrice(compareAtPrice * 100)}
            </span>
          )}
        </div>

        {/* Size Selector */}
        {sizeOptions.length > 1 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('size')}
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
                    className={`
                      px-3 py-1.5 text-sm rounded border transition-colors
                      ${
                        isSelected
                          ? 'bg-sage-500 text-white border-sage-500'
                          : isAvailable
                          ? 'bg-white text-gray-700 border-gray-300 hover:border-sage-500'
                          : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      }
                    `}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quantity Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('quantity')}
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
            >
              -
            </button>
            <span className="w-8 text-center font-medium">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
            >
              +
            </button>
          </div>
        </div>

        {/* Add to Cart Button */}
        <button
          onClick={handleAddToCart}
          disabled={!selectedVariant.availableForSale || isAdding}
          className={`
            w-full py-3 rounded-lg font-button font-bold uppercase tracking-wide
            transition-all duration-200 mt-auto
            ${
              selectedVariant.availableForSale
                ? 'bg-gradient-to-r from-sage-500 to-sage-700 text-white hover:from-sage-600 hover:to-sage-800 hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {isAdding ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {t('adding')}
            </span>
          ) : selectedVariant.availableForSale ? (
            t('addToCart')
          ) : (
            t('outOfStock')
          )}
        </button>
      </div>
    </div>
  );
}
