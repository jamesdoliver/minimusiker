'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { TSHIRT_SIZES, HOODIE_SIZES, TshirtSize, HoodieSize } from '@/lib/types/stock';

interface ClothingProductCardProps {
  productId: string;
  name: string;
  description: string;
  price: number;
  imageSrc?: string;
  imageEmoji?: string;
  savings?: number;
  showTshirtSize: boolean;
  showHoodieSize: boolean;
  onAdd: (
    productId: string,
    tshirtSize: TshirtSize | null,
    hoodieSize: HoodieSize | null,
    quantity: number
  ) => void;
  isAdded?: boolean;
  className?: string;
}

export default function ClothingProductCard({
  productId,
  name,
  description,
  price,
  imageSrc,
  imageEmoji,
  savings,
  showTshirtSize,
  showHoodieSize,
  onAdd,
  isAdded = false,
  className = ''
}: ClothingProductCardProps) {
  const [tshirtSize, setTshirtSize] = useState<TshirtSize>(TSHIRT_SIZES[2]);
  const [hoodieSize, setHoodieSize] = useState<HoodieSize>(HOODIE_SIZES[1]);
  const [quantity, setQuantity] = useState(1);

  const handleAdd = () => {
    onAdd(
      productId,
      showTshirtSize ? tshirtSize : null,
      showHoodieSize ? hoodieSize : null,
      quantity
    );
    // Reset quantity after adding
    setQuantity(1);
  };

  return (
    <div
      className={cn(
        'relative flex flex-col p-6 rounded-xl border-2 transition-all duration-200 bg-white',
        isAdded
          ? 'border-sage-400 shadow-md'
          : 'border-gray-200 hover:border-sage-300 hover:shadow-md',
        className
      )}
    >
      {/* Savings Badge */}
      {savings && savings > 0 && (
        <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm z-10">
          Spare {savings.toFixed(0)}€
        </div>
      )}

      {/* Product Image or Emoji */}
      <div className="flex justify-center items-center h-32 mb-4">
        {imageSrc ? (
          <div className="relative w-32 h-32">
            <Image
              src={imageSrc}
              alt={name}
              fill
              className="object-contain"
            />
          </div>
        ) : imageEmoji ? (
          <span className="text-6xl">{imageEmoji}</span>
        ) : (
          <div className="w-32 h-32 bg-sage-100 rounded-lg flex items-center justify-center">
            <svg className="w-14 h-14 text-sage-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        )}
      </div>

      {/* Product Info */}
      <h4 className="font-semibold text-gray-900 text-center text-base">
        {name}
      </h4>
      <p className="text-sm text-gray-500 text-center mt-1 leading-snug">
        {description}
      </p>
      <p className="text-xl font-bold text-gray-900 text-center mt-3">
        €{price.toFixed(2)}
      </p>

      {/* Size Selectors */}
      <div className="mt-4 space-y-3">
        {showTshirtSize && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">
              {showHoodieSize ? 'T-Shirt Größe' : 'Größe wählen'}
            </label>
            <select
              value={tshirtSize}
              onChange={(e) => setTshirtSize(e.target.value as TshirtSize)}
              className="w-full min-w-[180px] px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-sage-500 focus:border-sage-500"
            >
              {TSHIRT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
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
              className="w-full min-w-[180px] px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-sage-500 focus:border-sage-500"
            >
              {HOODIE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Quantity and Add Button */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between gap-4">
          {/* Quantity Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-8 rounded-full border border-gray-300 bg-white flex items-center justify-center hover:bg-gray-50 hover:border-sage-400 transition-colors"
              disabled={quantity <= 1}
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="font-medium w-6 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(Math.min(10, quantity + 1))}
              className="w-8 h-8 rounded-full border border-gray-300 bg-white flex items-center justify-center hover:bg-gray-50 hover:border-sage-400 transition-colors"
              disabled={quantity >= 10}
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={handleAdd}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-sage-600 text-white font-medium rounded-lg hover:bg-sage-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}
