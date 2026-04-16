'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Drawer } from 'vaul';
import DOMPurify from 'isomorphic-dompurify';
import { useTranslations } from 'next-intl';
import type { Product, ProductVariant } from '@/lib/types/airtable';
import { useCart } from '@/lib/contexts/CartContext';
import { formatPrice } from '@/lib/utils';

interface ProductDetailSheetProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProductDetailSheet({ product, open, onOpenChange }: ProductDetailSheetProps) {
  const t = useTranslations('shop.productSheet');
  const tCard = useTranslations('shop.productCard');
  const { addItem } = useCart();

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>(product.variants[0]);
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);

  const sizeOptions = product.variants
    .map((v) => v.selectedOptions.find((opt) => opt.name === 'Size')?.value)
    .filter((value, index, self) => value && self.indexOf(value) === index) as string[];

  const selectedSize = selectedVariant.selectedOptions.find((opt) => opt.name === 'Size')?.value;

  const price = parseFloat(selectedVariant.price.amount);
  const compareAtPrice = selectedVariant.compareAtPrice
    ? parseFloat(selectedVariant.compareAtPrice.amount)
    : null;
  const hasDiscount = compareAtPrice && compareAtPrice > price;

  const sanitizedHtml = product.descriptionHtml
    ? DOMPurify.sanitize(product.descriptionHtml, { USE_PROFILES: { html: true } })
    : '';
  const hasDescription = sanitizedHtml.trim().length > 0 || (product.description?.trim().length ?? 0) > 0;

  const handleSizeSelect = (size: string) => {
    const variant = product.variants.find(
      (v) => v.selectedOptions.find((opt) => opt.name === 'Size')?.value === size
    );
    if (variant) setSelectedVariant(variant);
  };

  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      addItem(product, selectedVariant, quantity);
      setQuantity(1);
    } finally {
      setTimeout(() => setIsAdding(false), 500);
    }
  };

  const images = product.images.length > 0 ? product.images : [];

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Drawer.Content
          aria-label={t('ariaLabel', { title: product.title })}
          className="bg-white flex flex-col rounded-t-2xl fixed bottom-0 left-0 right-0 z-50 outline-none md:left-1/2 md:-translate-x-1/2 md:max-w-[640px] md:rounded-2xl md:bottom-[7.5vh]"
          style={{ height: '90vh', maxHeight: '90vh' }}
        >
          {/* Drag handle */}
          <div className="mx-auto w-12 h-1.5 rounded-full bg-gray-300 mt-3 mb-1" />

          {/* Close button */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t('close')}
            className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 z-10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            {/* Image carousel */}
            {images.length > 0 && (
              <div className="relative w-full aspect-square bg-cream-100">
                <Image
                  src={images[activeImageIndex].url}
                  alt={images[activeImageIndex].altText || product.title}
                  fill
                  loading="lazy"
                  className="object-contain p-4"
                  sizes="(max-width: 768px) 100vw, 640px"
                />
                {images.length > 1 && (
                  <>
                    {/* Prev / next overlay tap zones */}
                    <button
                      type="button"
                      aria-label={t('previousImage')}
                      onClick={() => setActiveImageIndex((i) => (i - 1 + images.length) % images.length)}
                      className="absolute left-0 top-0 bottom-0 w-1/3"
                    />
                    <button
                      type="button"
                      aria-label={t('nextImage')}
                      onClick={() => setActiveImageIndex((i) => (i + 1) % images.length)}
                      className="absolute right-0 top-0 bottom-0 w-1/3"
                    />
                    {/* Pagination dots */}
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          aria-label={t('goToImage', { index: i + 1 })}
                          onClick={() => setActiveImageIndex(i)}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            i === activeImageIndex ? 'bg-sage-700' : 'bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Title + price */}
            <div className="px-6 pt-5 pb-3">
              <Drawer.Title asChild>
                <h2 className="font-heading text-2xl text-minimusik-heading mb-2">
                  {product.title}
                </h2>
              </Drawer.Title>
              <Drawer.Description className="sr-only">
                {t('ariaLabel', { title: product.title })}
              </Drawer.Description>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-sage-700">
                  {formatPrice(price * 100)}
                </span>
                {hasDiscount && (
                  <span className="text-base text-gray-400 line-through">
                    {formatPrice(compareAtPrice * 100)}
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="px-6 pb-6">
              {hasDescription ? (
                sanitizedHtml ? (
                  <div
                    className="prose prose-sm max-w-none prose-headings:text-minimusik-heading prose-a:text-sage-700"
                    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                  />
                ) : (
                  <p className="text-gray-700 whitespace-pre-line">{product.description}</p>
                )
              ) : (
                <p className="text-gray-500 italic">{t('descriptionFallback')}</p>
              )}
            </div>
          </div>

          {/* Sticky footer */}
          <div
            className="border-t border-gray-200 bg-white px-6 pt-4 pb-6"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
          >
            {sizeOptions.length > 1 && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {tCard('size')}
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
                        className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                          isSelected
                            ? 'bg-sage-500 text-white border-sage-500'
                            : isAvailable
                            ? 'bg-white text-gray-700 border-gray-300 hover:border-sage-500'
                            : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-9 h-9 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
                >
                  -
                </button>
                <span className="w-8 text-center font-medium">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-9 h-9 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-50"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!selectedVariant.availableForSale || isAdding}
                className={`flex-1 py-3 rounded-lg font-button font-bold uppercase tracking-wide transition-all duration-200 ${
                  selectedVariant.availableForSale
                    ? 'bg-gradient-to-r from-sage-500 to-sage-700 text-white hover:from-sage-600 hover:to-sage-800'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isAdding ? tCard('adding') : selectedVariant.availableForSale ? tCard('addToCart') : tCard('outOfStock')}
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
