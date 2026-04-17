'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface AudioProductCardProps {
  productId: string;
  name: string;
  price: number;
  imageSrc?: string;
  imageEmoji?: string;
  savings?: number;
  featured?: boolean;
  isInCart: boolean;
  quantity: number;
  onCardClick: () => void;
  onAdd: () => void;
  onQuantityChange: (productId: string, quantity: number) => void;
}

export default function AudioProductCard({
  productId,
  name,
  price,
  imageSrc,
  imageEmoji,
  savings,
  featured = false,
  isInCart,
  quantity,
  onCardClick,
  onAdd,
  onQuantityChange,
}: AudioProductCardProps) {
  const t = useTranslations('parentPortalCard');

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCardClick();
        }
      }}
      className={cn(
        'relative flex flex-col p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-sage-500',
        featured
          ? 'border-amber-400 bg-amber-50/30 shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:shadow-[0_0_25px_rgba(245,158,11,0.35)]'
          : isInCart
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

      {/* Product Image or Emoji */}
      <div className="flex justify-center items-center h-24 mb-4 mt-2">
        {imageSrc ? (
          <div className="relative w-24 h-24">
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
          <div className="w-24 h-24 bg-sage-100 rounded-lg flex items-center justify-center">
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
      <p className="text-lg font-bold text-gray-900 text-center mt-3">
        €{price.toFixed(2)}
      </p>

      {/* Add to Cart / Qty Stepper */}
      <div className="mt-4 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
        {!isInCart ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className="w-full py-2 px-4 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 transition-colors"
          >
            {t('addToCart')}
          </button>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuantityChange(productId, quantity - 1);
              }}
              className="w-8 h-8 rounded-full border border-gray-300 bg-white flex items-center justify-center hover:bg-gray-50 hover:border-sage-400 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="font-medium w-8 text-center text-lg">{quantity}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuantityChange(productId, Math.min(10, quantity + 1));
              }}
              className="w-8 h-8 rounded-full border border-gray-300 bg-white flex items-center justify-center hover:bg-gray-50 hover:border-sage-400 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
