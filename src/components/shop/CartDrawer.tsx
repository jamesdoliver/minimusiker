'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useCart } from '@/lib/contexts/CartContext';
import { useCheckout } from '@/lib/hooks/useCheckout';
import { formatPrice } from '@/lib/utils';

interface CartDrawerProps {
  parentId?: string;
  parentEmail?: string;
  eventId?: string;
  classId?: string;
}

export default function CartDrawer({ parentId, parentEmail, eventId, classId }: CartDrawerProps) {
  const t = useTranslations('shop.cart');
  const { cart, removeItem, updateQuantity, isCartOpen, setIsCartOpen } = useCart();
  const { checkout, isCheckingOut, error: checkoutError } = useCheckout();

  // Log props for debugging attribute flow
  console.log('[CartDrawer] Props:', { parentId, parentEmail, eventId, classId });

  // Close drawer on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCartOpen(false);
      }
    };

    if (isCartOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isCartOpen, setIsCartOpen]);

  // Handle checkout
  const handleCheckout = () => {
    checkout({
      parentId: parentId || '',
      parentEmail: parentEmail || '',
      eventId: eventId || '',
      classId: classId || '',
    });
  };

  if (!isCartOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-heading text-xl text-minimusik-heading">
            {t('title', { count: cart.itemCount })}
          </h2>
          <button
            onClick={() => setIsCartOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <svg
                className="w-16 h-16 text-gray-300 mb-4"
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
              <p className="text-gray-500 mb-4">{t('empty')}</p>
              <button
                onClick={() => setIsCartOpen(false)}
                className="text-sage-600 hover:text-sage-700 font-medium"
              >
                {t('continueShopping')}
              </button>
            </div>
          ) : (
            <ul className="space-y-4">
              {cart.items.map((item) => {
                const image = item.variant.image || item.product.images[0];
                const price = parseFloat(item.variant.price.amount);

                return (
                  <li
                    key={item.variant.id}
                    className="flex gap-4 p-3 bg-cream-50 rounded-lg"
                  >
                    {/* Product Image */}
                    <div className="relative w-20 h-20 flex-shrink-0 bg-white rounded overflow-hidden">
                      {image ? (
                        <Image
                          src={image.url}
                          alt={image.altText || item.product.title}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <svg
                            className="w-8 h-8"
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
                    </div>

                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-gray-900 truncate">
                        {item.product.title}
                      </h3>
                      {item.variant.title !== 'Default Title' && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {item.variant.title}
                        </p>
                      )}
                      <p className="font-bold text-sage-700 mt-1">
                        {formatPrice(price * 100)}
                      </p>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() =>
                            updateQuantity(item.variant.id, item.quantity - 1)
                          }
                          className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded text-sm hover:bg-gray-50"
                        >
                          -
                        </button>
                        <span className="text-sm font-medium w-4 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.variant.id, item.quantity + 1)
                          }
                          className="w-6 h-6 flex items-center justify-center border border-gray-300 rounded text-sm hover:bg-gray-50"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeItem(item.variant.id)}
                          className="ml-auto text-red-500 hover:text-red-600 text-sm"
                        >
                          {t('remove')}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        {cart.items.length > 0 && (
          <div className="border-t p-4 space-y-4">
            {/* Subtotal */}
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-700">{t('subtotal')}</span>
              <span className="font-bold text-xl text-minimusik-heading">
                {formatPrice(cart.subtotal * 100)}
              </span>
            </div>

            <p className="text-xs text-gray-500">
              {t('shippingInfo')}
            </p>

            {/* Checkout Error */}
            {checkoutError && (
              <div className="bg-red-50 text-red-600 text-sm p-2 rounded">
                {checkoutError}
              </div>
            )}

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={isCheckingOut}
              className="w-full py-3 bg-gradient-to-r from-sage-500 to-sage-700 text-white rounded-lg font-button font-bold uppercase tracking-wide hover:from-sage-600 hover:to-sage-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCheckingOut ? (
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
                  {t('processing')}
                </span>
              ) : (
                t('checkout')
              )}
            </button>

            {/* Continue Shopping */}
            <button
              onClick={() => setIsCartOpen(false)}
              className="w-full py-2 text-sage-600 hover:text-sage-700 font-medium text-sm"
            >
              {t('continueShopping')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
