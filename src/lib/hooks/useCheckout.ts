'use client';

/**
 * Custom hook for handling Shopify checkout
 */

import { useState, useCallback } from 'react';
import { useCart } from '../contexts/CartContext';
import { CheckoutLineItem, CheckoutCustomAttributes, ShopifyCheckout } from '../types/shop';

interface UseCheckoutResult {
  checkout: (customAttributes?: CheckoutCustomAttributes) => Promise<void>;
  isCheckingOut: boolean;
  error: string | null;
}

export function useCheckout(): UseCheckoutResult {
  const { cart, clearCart } = useCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkout = useCallback(
    async (customAttributes?: CheckoutCustomAttributes) => {
      if (cart.items.length === 0) {
        setError('Your cart is empty');
        return;
      }

      setIsCheckingOut(true);
      setError(null);

      try {
        // Prepare line items from cart
        const lineItems: CheckoutLineItem[] = cart.items.map((item) => ({
          variantId: item.variant.id,
          quantity: item.quantity,
        }));

        // Create checkout via API
        const response = await fetch('/api/shopify/create-checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lineItems,
            customAttributes,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create checkout');
        }

        const data: ShopifyCheckout = await response.json();

        // Clear cart after successful checkout creation
        clearCart();

        // Redirect to Shopify checkout
        window.location.href = data.checkoutUrl;
      } catch (err) {
        console.error('Checkout error:', err);
        setError(err instanceof Error ? err.message : 'Failed to process checkout');
        setIsCheckingOut(false);
      }
    },
    [cart.items, clearCart]
  );

  return {
    checkout,
    isCheckingOut,
    error,
  };
}

export default useCheckout;
