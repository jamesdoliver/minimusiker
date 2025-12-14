'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Product } from '@/lib/types/airtable';
import { useCart } from '@/lib/contexts/CartContext';
import { formatPrice } from '@/lib/utils';

interface FeaturedProductsProps {
  products: Product[];
  maxItems?: number;
}

export default function FeaturedProducts({ products, maxItems = 3 }: FeaturedProductsProps) {
  const { addItem } = useCart();

  // Take only the first maxItems products
  const featuredProducts = products.slice(0, maxItems);

  if (featuredProducts.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-2xl text-minimusik-heading">
          Shop Our Merchandise
        </h2>
        <Link
          href="/parent-portal/shop"
          className="text-sage-600 hover:text-sage-700 font-medium text-sm flex items-center gap-1"
        >
          View All
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
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {featuredProducts.map((product) => {
          const primaryImage = product.images[0];
          const variant = product.variants[0];
          const price = parseFloat(variant.price.amount);
          const compareAtPrice = variant.compareAtPrice
            ? parseFloat(variant.compareAtPrice.amount)
            : null;
          const hasDiscount = compareAtPrice && compareAtPrice > price;

          return (
            <div
              key={product.id}
              className="bg-cream-50 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Product Image */}
              <div className="relative aspect-square overflow-hidden">
                {primaryImage ? (
                  <Image
                    src={primaryImage.url}
                    alt={primaryImage.altText || product.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400">
                    <svg
                      className="w-12 h-12"
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
                  <div className="absolute top-2 left-2 bg-minimusik-accent text-white text-xs font-bold px-2 py-0.5 rounded">
                    SALE
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-4">
                <h3 className="font-medium text-sm text-gray-900 truncate">
                  {product.title}
                </h3>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-bold text-sage-700">
                    {formatPrice(price * 100)}
                  </span>
                  {hasDiscount && (
                    <span className="text-xs text-gray-400 line-through">
                      {formatPrice(compareAtPrice * 100)}
                    </span>
                  )}
                </div>

                {/* Quick Add Button */}
                {product.variants.length === 1 && variant.availableForSale ? (
                  <button
                    onClick={() => addItem(product, variant, 1)}
                    className="mt-3 w-full py-2 bg-sage-500 text-white text-sm font-medium rounded hover:bg-sage-600 transition-colors"
                  >
                    Add to Cart
                  </button>
                ) : (
                  <Link
                    href="/parent-portal/shop"
                    className="mt-3 block w-full py-2 border border-sage-500 text-sage-600 text-sm font-medium rounded text-center hover:bg-sage-50 transition-colors"
                  >
                    View Options
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
