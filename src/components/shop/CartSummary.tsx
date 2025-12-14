'use client';

import { useCart } from '@/lib/contexts/CartContext';
import { formatPrice } from '@/lib/utils';

export default function CartSummary() {
  const { cart, setIsCartOpen } = useCart();

  if (cart.itemCount === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-40">
      <button
        onClick={() => setIsCartOpen(true)}
        className="flex items-center gap-3 bg-gradient-to-r from-sage-500 to-sage-700 text-white px-4 py-3 rounded-full shadow-lg hover:from-sage-600 hover:to-sage-800 hover:shadow-xl transition-all transform hover:scale-105"
      >
        {/* Cart Icon */}
        <div className="relative">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
            />
          </svg>

          {/* Item Count Badge */}
          <span className="absolute -top-2 -right-2 bg-minimusik-accent text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
            {cart.itemCount > 9 ? '9+' : cart.itemCount}
          </span>
        </div>

        {/* Subtotal */}
        <span className="font-bold">
          {formatPrice(cart.subtotal * 100)}
        </span>
      </button>
    </div>
  );
}
