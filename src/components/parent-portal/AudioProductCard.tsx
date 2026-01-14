'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface AudioProductCardProps {
  productId: string;
  name: string;
  description: string;
  price: number;
  imageSrc?: string;
  imageEmoji?: string;
  isSelected: boolean;
  quantity: number;
  savings?: number;
  onToggle: (productId: string) => void;
  onQuantityChange: (productId: string, quantity: number) => void;
}

export default function AudioProductCard({
  productId,
  name,
  description,
  price,
  imageSrc,
  imageEmoji,
  isSelected,
  quantity,
  savings,
  onToggle,
  onQuantityChange
}: AudioProductCardProps) {
  return (
    <div
      onClick={() => onToggle(productId)}
      className={cn(
        'relative flex flex-col p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer',
        isSelected
          ? 'border-sage-600 bg-sage-50 shadow-md ring-2 ring-sage-200'
          : 'border-gray-200 bg-white hover:border-sage-300 hover:shadow-md'
      )}
    >
      {/* Savings Badge */}
      {savings && savings > 0 && (
        <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm z-10">
          Spare {savings.toFixed(0)}€
        </div>
      )}

      {/* Checkbox for multi-select */}
      <div className="absolute top-4 left-4 z-10">
        <div
          className={cn(
            'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
            isSelected
              ? 'border-sage-600 bg-sage-600'
              : 'border-gray-300 bg-white'
          )}
        >
          {isSelected && (
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Product Image or Emoji */}
      <div className="flex justify-center items-center h-24 mb-4 mt-2">
        {imageSrc ? (
          <div className="relative w-20 h-20">
            <Image
              src={imageSrc}
              alt={name}
              fill
              className="object-contain"
            />
          </div>
        ) : imageEmoji ? (
          <span className="text-5xl">{imageEmoji}</span>
        ) : (
          <div className="w-20 h-20 bg-sage-100 rounded-lg flex items-center justify-center">
            <svg className="w-10 h-10 text-sage-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}
      </div>

      {/* Product Info */}
      <h4 className="font-semibold text-gray-900 text-center text-sm leading-tight">
        {name}
      </h4>
      <p className="text-xs text-gray-500 text-center mt-1 leading-snug line-clamp-2">
        {description}
      </p>
      <p className="text-lg font-bold text-gray-900 text-center mt-3">
        €{price.toFixed(2)}
      </p>

      {/* Quantity Controls (visible when selected) */}
      {isSelected && (
        <div
          className="flex items-center justify-center gap-3 mt-4 pt-3 border-t border-sage-200"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onQuantityChange(productId, Math.max(1, quantity - 1))}
            className="w-8 h-8 rounded-full border border-gray-300 bg-white flex items-center justify-center hover:bg-gray-50 hover:border-sage-400 transition-colors"
            disabled={quantity <= 1}
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="font-medium w-8 text-center text-lg">{quantity}</span>
          <button
            onClick={() => onQuantityChange(productId, Math.min(10, quantity + 1))}
            className="w-8 h-8 rounded-full border border-gray-300 bg-white flex items-center justify-center hover:bg-gray-50 hover:border-sage-400 transition-colors"
            disabled={quantity >= 10}
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
