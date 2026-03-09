'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FulfillmentResultItem {
  orderId: string;
  orderNumber: string;
  success: boolean;
  error?: string;
  fulfillmentId?: string;
}

interface FulfillmentResult {
  total: number;
  succeeded: number;
  failed: number;
  results: FulfillmentResultItem[];
}

interface FulfillmentButtonProps {
  eventId: string;
  welle: 'Welle 1' | 'Welle 2';
  orderCount: number;
  onComplete: (result: FulfillmentResult) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FulfillmentButton({
  eventId,
  welle,
  orderCount,
  onComplete,
}: FulfillmentButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [result, setResult] = useState<FulfillmentResult | null>(null);

  const welleNumber = welle === 'Welle 1' ? '1' : '2';

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleClick = () => {
    if (result) {
      // Reset result state to allow retry
      setResult(null);
    }
    setIsConfirming(true);
  };

  const handleCancel = () => {
    setIsConfirming(false);
  };

  const handleConfirm = async () => {
    setIsConfirming(false);
    setIsFulfilling(true);
    setResult(null);

    try {
      const res = await fetch(`/api/admin/orders/events/${eventId}/fulfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ welle }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Fulfillment failed (${res.status})`);
      }

      const fulfillmentResult: FulfillmentResult = data.data;
      setResult(fulfillmentResult);
      onComplete(fulfillmentResult);
    } catch (err) {
      console.error('Error fulfilling wave:', err);
      const message = err instanceof Error ? err.message : 'Fulfillment failed';
      // Create a synthetic all-failed result so the error UI shows
      setResult({
        total: orderCount,
        succeeded: 0,
        failed: orderCount,
        results: [
          {
            orderId: '',
            orderNumber: '',
            success: false,
            error: message,
          },
        ],
      });
    } finally {
      setIsFulfilling(false);
    }
  };

  const handleRetry = () => {
    setResult(null);
    setIsConfirming(true);
  };

  // -------------------------------------------------------------------------
  // Result display
  // -------------------------------------------------------------------------

  if (result) {
    const allSucceeded = result.failed === 0;
    const allFailed = result.succeeded === 0;
    const failedOrders = result.results.filter((r) => !r.success);

    return (
      <div className="space-y-2">
        {/* Result summary */}
        <div
          className={cn(
            'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
            allSucceeded && 'border-green-200 bg-green-50 text-green-800',
            !allSucceeded && !allFailed && 'border-amber-200 bg-amber-50 text-amber-800',
            allFailed && 'border-red-200 bg-red-50 text-red-800',
          )}
        >
          {/* Icon */}
          {allSucceeded ? (
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          )}

          <div className="min-w-0 flex-1">
            {allSucceeded && (
              <p className="font-medium">
                All {result.succeeded} order{result.succeeded !== 1 ? 's' : ''} fulfilled successfully.
              </p>
            )}

            {!allSucceeded && !allFailed && (
              <>
                <p className="font-medium">
                  {result.succeeded}/{result.total} fulfilled. {result.failed} failed.
                </p>
                {failedOrders.length > 0 && (
                  <p className="mt-1 text-xs">
                    Failed: {failedOrders.map((r) => r.orderNumber ? `#${r.orderNumber}` : r.orderId).join(', ')}
                  </p>
                )}
              </>
            )}

            {allFailed && (
              <p className="font-medium">
                {failedOrders[0]?.error || `All ${result.total} orders failed to fulfill.`}
              </p>
            )}
          </div>
        </div>

        {/* Retry button for partial or full failures */}
        {result.failed > 0 && (
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry
          </button>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Fulfilling state
  // -------------------------------------------------------------------------

  if (isFulfilling) {
    return (
      <div className="flex items-center gap-2 text-sm text-teal-700">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-200 border-t-teal-600" />
        <span className="font-medium">Fulfilling orders...</span>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Confirmation state
  // -------------------------------------------------------------------------

  if (isConfirming) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          This will create fulfillments on Shopify for{' '}
          <span className="font-semibold">{orderCount}</span> order{orderCount !== 1 ? 's' : ''}. Continue?
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
          >
            Confirm
          </button>
          <button
            onClick={handleCancel}
            className="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Default button
  // -------------------------------------------------------------------------

  return (
    <button
      onClick={handleClick}
      disabled={orderCount === 0}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors',
        'bg-teal-600 hover:bg-teal-700',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
      Fulfill All Welle {welleNumber}
      {orderCount > 0 && (
        <span className="inline-flex items-center justify-center rounded-full bg-teal-500 px-2 py-0.5 text-xs font-medium text-white">
          {orderCount}
        </span>
      )}
    </button>
  );
}
