'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Product } from '@/types/airtable';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface CheckoutButtonProps {
  selectedProducts: Array<{
    productId: string;
    quantity: number;
    size?: string;
  }>;
  products: Product[];
  parentId: string;
  eventId: string;
}

export default function CheckoutButton({
  selectedProducts,
  products,
  parentId,
  eventId,
}: CheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleCheckout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Prepare line items for Shopify
      const lineItems = selectedProducts.map((selection) => {
        const product = products.find((p) => p.id === selection.productId);
        if (!product) throw new Error('Product not found');

        return {
          productId: product.id,
          variantId: selection.size
            ? product.variants?.find((v) => v.selectedOptions?.some(opt => opt.value === selection.size))?.id
            : product.variants?.[0]?.id,
          quantity: selection.quantity,
        };
      });

      // Create checkout session
      const response = await fetch('/api/shopify/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lineItems,
          customAttributes: {
            parentId,
            eventId,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout');
      }

      const { checkoutUrl } = await response.json();

      // Redirect to Shopify checkout
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create checkout');
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <button
        onClick={handleCheckout}
        disabled={isLoading || selectedProducts.length === 0}
        className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-button font-bold uppercase tracking-wide rounded-md shadow-sm text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            Processing...
          </>
        ) : (
          <>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Proceed to Checkout
          </>
        )}
      </button>
    </div>
  );
}