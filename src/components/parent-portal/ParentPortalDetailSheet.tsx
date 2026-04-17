'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Drawer } from 'vaul';
import DOMPurify from 'isomorphic-dompurify';
import { useTranslations } from 'next-intl';

interface ParentPortalDetailSheetProps {
  title: string;
  descriptionHtml?: string;
  images: Array<{ url: string; altText?: string }>;
  price: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  footer: React.ReactNode;
}

export default function ParentPortalDetailSheet({
  title,
  descriptionHtml,
  images,
  price,
  open,
  onOpenChange,
  footer,
}: ParentPortalDetailSheetProps) {
  const t = useTranslations('shop.productSheet');
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const sanitizedHtml = descriptionHtml
    ? DOMPurify.sanitize(descriptionHtml, { USE_PROFILES: { html: true } })
    : '';
  const hasDescription = sanitizedHtml.trim().length > 0;

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Drawer.Content
          aria-label={t('ariaLabel', { title })}
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
                  src={images[activeImageIndex]?.url || ''}
                  alt={images[activeImageIndex]?.altText || title}
                  fill
                  className="object-contain p-4"
                  sizes="(max-width: 768px) 100vw, 640px"
                />
                {images.length > 1 && (
                  <>
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
                  {title}
                </h2>
              </Drawer.Title>
              <Drawer.Description className="sr-only">
                {t('ariaLabel', { title })}
              </Drawer.Description>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-sage-700">
                  €{price.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="px-6 pb-6">
              {hasDescription ? (
                <div
                  className="prose prose-sm max-w-none prose-headings:text-minimusik-heading prose-a:text-sage-700"
                  dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                />
              ) : (
                <p className="text-gray-500 italic">{t('descriptionFallback')}</p>
              )}
            </div>
          </div>

          {/* Sticky footer — render prop */}
          <div
            className="border-t border-gray-200 bg-white px-6 pt-4 pb-6"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
