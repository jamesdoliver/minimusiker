'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useCart } from '@/lib/contexts/CartContext';
import { useProducts } from '@/lib/hooks/useProducts';
import { ProductVariant } from '@/lib/types/airtable';

interface PersonalizedTshirtPromoProps {
  schoolName: string;
  eventDate: string; // ISO date string
  productHandle?: string; // Shopify product handle, defaults to searching for t-shirt
}

// Calculate deadline: 14 days before event
function getDeadline(eventDate: string): Date {
  const event = new Date(eventDate);
  event.setDate(event.getDate() - 14);
  return event;
}

// Calculate time remaining until deadline
function getTimeRemaining(deadline: Date): { days: number; hours: number } | null {
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();

  if (diff <= 0) return null; // Deadline passed

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  return { days, hours };
}

// Get font size class based on school name length
function getTextSizeClass(name: string): string {
  if (name.length < 15) return 'text-lg md:text-xl';
  if (name.length < 25) return 'text-base md:text-lg';
  return 'text-sm md:text-base';
}

export default function PersonalizedTshirtPromo({
  schoolName,
  eventDate,
  productHandle = 'personalized-tshirt',
}: PersonalizedTshirtPromoProps) {
  const { addItem, setIsCartOpen } = useCart();
  const { products, isLoading } = useProducts({ tagFilter: 'minimusiker-shop' });

  const [timeRemaining, setTimeRemaining] = useState<{ days: number; hours: number } | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);

  // Find the t-shirt product
  const tshirtProduct = useMemo(() => {
    if (!products.length) return null;
    // Try to find by handle first, then by type or tag
    return (
      products.find((p) => p.handle === productHandle) ||
      products.find((p) => p.productType?.toLowerCase().includes('shirt')) ||
      products.find((p) => p.tags?.some((tag) => tag.toLowerCase().includes('shirt'))) ||
      null
    );
  }, [products, productHandle]);

  // Get available sizes from variants
  const availableSizes = useMemo(() => {
    if (!tshirtProduct) return [];
    const sizes = new Set<string>();
    tshirtProduct.variants.forEach((variant) => {
      const sizeOption = variant.selectedOptions.find(
        (opt) => opt.name.toLowerCase() === 'size' || opt.name.toLowerCase() === 'größe'
      );
      if (sizeOption && variant.availableForSale) {
        sizes.add(sizeOption.value);
      }
    });
    return Array.from(sizes);
  }, [tshirtProduct]);

  // Set default size when product loads
  useEffect(() => {
    if (availableSizes.length > 0 && !selectedSize) {
      setSelectedSize(availableSizes[0]);
    }
  }, [availableSizes, selectedSize]);

  // Calculate deadline
  const deadline = useMemo(() => getDeadline(eventDate), [eventDate]);

  // Update countdown timer
  useEffect(() => {
    const updateTimer = () => {
      setTimeRemaining(getTimeRemaining(deadline));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [deadline]);

  // Handle add to cart
  const handleAddToCart = async () => {
    if (!tshirtProduct || !selectedSize) return;

    // Find the variant matching selected size
    const variant = tshirtProduct.variants.find((v) =>
      v.selectedOptions.some(
        (opt) =>
          (opt.name.toLowerCase() === 'size' || opt.name.toLowerCase() === 'größe') &&
          opt.value === selectedSize
      )
    );

    if (!variant) return;

    setIsAdding(true);
    try {
      addItem(tshirtProduct, variant, 1);
      setIsCartOpen(true);
    } finally {
      setIsAdding(false);
    }
  };

  // Don't render if deadline has passed or no event date
  if (!eventDate || !timeRemaining) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
        <div className="h-48 bg-gray-200 rounded-lg mb-4" />
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
    );
  }

  // Don't render if no t-shirt product found
  if (!tshirtProduct) {
    return null;
  }

  const textSizeClass = getTextSizeClass(schoolName);
  const price = tshirtProduct.priceRange.minVariantPrice.amount;
  const currency = tshirtProduct.priceRange.minVariantPrice.currencyCode;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
      {/* Header */}
      <div className="text-center mb-4">
        <h3 className="text-lg font-bold text-gray-900">Personalisiertes T-Shirt</h3>
        <p className="text-sm text-gray-600">Mit dem Namen deiner Schule!</p>
      </div>

      {/* Mockup with school name overlay */}
      <div className="relative mx-auto mb-4" style={{ maxWidth: '280px' }}>
        <div className="relative aspect-[4/5] bg-gray-100 rounded-lg overflow-hidden">
          {/* T-shirt mockup image */}
          <Image
            src="/images/tshirt-mockup.svg"
            alt={`T-Shirt mit ${schoolName}`}
            fill
            className="object-contain"
            priority
          />
          {/* School name overlay */}
          <div className="absolute inset-0 flex items-center justify-center" style={{ top: '35%' }}>
            <span
              className={`font-bold text-center px-4 ${textSizeClass}`}
              style={{
                color: '#1a365d', // Dark blue for visibility
                textShadow: '0 1px 2px rgba(255,255,255,0.8)',
                maxWidth: '80%',
                lineHeight: '1.2',
              }}
            >
              {schoolName}
            </span>
          </div>
        </div>
      </div>

      {/* Countdown Timer */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-center gap-2 text-orange-700">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="font-medium text-sm">
            Noch{' '}
            <span className="font-bold">
              {timeRemaining.days} {timeRemaining.days === 1 ? 'Tag' : 'Tage'}
            </span>
            {timeRemaining.hours > 0 && (
              <>
                {' '}und{' '}
                <span className="font-bold">
                  {timeRemaining.hours} {timeRemaining.hours === 1 ? 'Stunde' : 'Stunden'}
                </span>
              </>
            )}
          </span>
        </div>
        <p className="text-xs text-orange-600 text-center mt-1">
          für personalisierte Bestellung vor dem Event!
        </p>
      </div>

      {/* Size Selector */}
      {availableSizes.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Größe wählen:
          </label>
          <div className="flex flex-wrap gap-2">
            {availableSizes.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`px-3 py-1.5 text-sm rounded-md border transition-all ${
                  selectedSize === size
                    ? 'bg-sage-600 text-white border-sage-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-sage-400'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Price and Add to Cart */}
      <div className="flex items-center justify-between">
        <div className="text-lg font-bold text-gray-900">
          {parseFloat(price).toFixed(2)} {currency === 'EUR' ? '€' : currency}
        </div>
        <button
          onClick={handleAddToCart}
          disabled={isAdding || !selectedSize}
          className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
            isAdding || !selectedSize
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-sage-600 text-white hover:bg-sage-700'
          }`}
        >
          {isAdding ? (
            <>
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
              Wird hinzugefügt...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              In den Warenkorb
            </>
          )}
        </button>
      </div>

      {/* Info note */}
      <p className="text-xs text-gray-500 text-center mt-3">
        Der Schulname wird auf das T-Shirt gedruckt.
      </p>
    </div>
  );
}
