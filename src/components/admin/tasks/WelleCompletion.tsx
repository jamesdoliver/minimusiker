'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderLineItem {
  variantId: string;
  productTitle: string;
  variantTitle?: string;
  quantity: number;
  price: number;
  total: number;
  waveCategory: 'clothing' | 'audio' | 'standard' | 'unknown';
}

interface WaveOrder {
  recordId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  schoolName: string;
  shipmentWave: string;
  fulfillmentStatus: string;
  paymentStatus: string;
  totalAmount: number;
  orderDate: string;
  lineItems: OrderLineItem[];
}

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

interface WelleCompletionProps {
  taskId: string;
  eventId: string;
  welle: 'Welle 1' | 'Welle 2';
  onComplete: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WelleCompletion({
  taskId,
  eventId,
  welle,
  onComplete,
}: WelleCompletionProps) {
  const [orders, setOrders] = useState<WaveOrder[]>([]);
  const [fulfillmentResult, setFulfillmentResult] = useState<FulfillmentResult | null>(null);
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch orders for the event
  // -------------------------------------------------------------------------

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/orders/events/${eventId}`, {
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to fetch orders (${res.status})`);
      }

      // Pick the correct wave's orders
      const waveKey = welle === 'Welle 1' ? 'welle1' : 'welle2';
      const waveData = data.data[waveKey];
      setOrders(waveData?.orders ?? []);
    } catch (err) {
      console.error('Error fetching event orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  }, [eventId, welle]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // -------------------------------------------------------------------------
  // Fulfillment
  // -------------------------------------------------------------------------

  const handleFulfill = async () => {
    setShowConfirmDialog(false);
    setIsFulfilling(true);
    setError(null);

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

      const result: FulfillmentResult = data.data;
      setFulfillmentResult(result);

      // If all succeeded, auto-complete the task
      if (result.failed === 0) {
        try {
          await fetch(`/api/admin/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              completion_data: {
                confirmed: true,
                notes: `${welle} fulfillment completed: ${result.succeeded}/${result.total} orders fulfilled`,
              },
            }),
          });
          onComplete();
        } catch (completeErr) {
          console.error('Error completing task:', completeErr);
          // Fulfillment still succeeded, just task completion failed
          setError('Fulfillment succeeded but failed to mark task as complete. Please complete the task manually.');
        }
      }

      // Refresh order list to show updated statuses
      await fetchOrders();
    } catch (err) {
      console.error('Error fulfilling wave:', err);
      setError(err instanceof Error ? err.message : 'Fulfillment failed');
    } finally {
      setIsFulfilling(false);
    }
  };

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------

  const welleNumber = welle === 'Welle 1' ? '1' : '2';
  const unfulfilledOrders = orders.filter((o) => o.fulfillmentStatus !== 'fulfilled');
  const allFulfilled = orders.length > 0 && unfulfilledOrders.length === 0;
  const totalLineItems = orders.reduce((sum, o) => sum + o.lineItems.length, 0);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Shipment: {welle}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {isLoading
              ? 'Loading orders...'
              : `${orders.length} order${orders.length !== 1 ? 's' : ''} total, ${totalLineItems} line item${totalLineItems !== 1 ? 's' : ''}`}
          </p>
        </div>

        {allFulfilled && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Already fulfilled
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && orders.length === 0 && !error && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <p className="mt-3 text-sm text-gray-500">No orders found for {welle}</p>
        </div>
      )}

      {/* Order list */}
      {!isLoading && orders.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {/* Summary bar */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {unfulfilledOrders.length} order{unfulfilledOrders.length !== 1 ? 's' : ''} to fulfill
            </span>
            {orders.length > unfulfilledOrders.length && (
              <span className="text-xs text-gray-500">
                {orders.length - unfulfilledOrders.length} already fulfilled
              </span>
            )}
          </div>

          {/* Orders */}
          <ul className="divide-y divide-gray-100">
            {orders.map((order) => {
              const isFulfilled = order.fulfillmentStatus === 'fulfilled';
              // Check if this order failed in the latest fulfillment attempt
              const failedResult = fulfillmentResult?.results.find(
                (r) => r.orderId === order.orderId && !r.success,
              );

              return (
                <li
                  key={order.recordId}
                  className={cn(
                    'px-6 py-4',
                    isFulfilled && 'bg-green-50/50',
                    failedResult && 'bg-red-50/50',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Order number */}
                      <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                        #{order.orderNumber}
                      </span>

                      {/* Customer name */}
                      <span className="text-sm text-gray-600 truncate">
                        {order.customerName}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      {/* Line items count */}
                      <span className="text-xs text-gray-500">
                        {order.lineItems.length} item{order.lineItems.length !== 1 ? 's' : ''}
                      </span>

                      {/* Fulfillment status badge */}
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                          isFulfilled
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600',
                        )}
                      >
                        {isFulfilled ? 'Fulfilled' : 'Unfulfilled'}
                      </span>
                    </div>
                  </div>

                  {/* Show error from fulfillment attempt */}
                  {failedResult && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-1.5">
                      Failed: {failedResult.error || 'Unknown error'}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Fulfillment result summary */}
      {fulfillmentResult && (
        <div
          className={cn(
            'rounded-lg border p-4',
            fulfillmentResult.failed === 0
              ? 'bg-green-50 border-green-200'
              : 'bg-yellow-50 border-yellow-200',
          )}
        >
          <h3
            className={cn(
              'text-sm font-semibold mb-2',
              fulfillmentResult.failed === 0 ? 'text-green-800' : 'text-yellow-800',
            )}
          >
            Fulfillment {fulfillmentResult.failed === 0 ? 'Complete' : 'Partially Complete'}
          </h3>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-gray-600">Total: </span>
              <span className="font-medium">{fulfillmentResult.total}</span>
            </div>
            <div>
              <span className="text-green-700">Succeeded: </span>
              <span className="font-medium text-green-700">{fulfillmentResult.succeeded}</span>
            </div>
            {fulfillmentResult.failed > 0 && (
              <div>
                <span className="text-red-700">Failed: </span>
                <span className="font-medium text-red-700">{fulfillmentResult.failed}</span>
              </div>
            )}
          </div>

          {fulfillmentResult.failed > 0 && (
            <p className="mt-3 text-xs text-yellow-700">
              Some orders could not be fulfilled. Review the errors above and retry, or complete the task manually.
            </p>
          )}
        </div>
      )}

      {/* Fulfill button */}
      {!isLoading && orders.length > 0 && !allFulfilled && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowConfirmDialog(true)}
            disabled={isFulfilling || unfulfilledOrders.length === 0}
            className={cn(
              'flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white transition-colors',
              'bg-teal-600 hover:bg-teal-700',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isFulfilling ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Fulfilling...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Fulfill All Welle {welleNumber}
              </>
            )}
          </button>
        </div>
      )}

      {/* Confirmation dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowConfirmDialog(false)}
            aria-hidden="true"
          />

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  Confirm Fulfillment
                </h3>
              </div>

              {/* Body */}
              <div className="px-6 py-4">
                <p className="text-sm text-gray-600">
                  This will create fulfillments on Shopify for{' '}
                  <span className="font-semibold">{unfulfilledOrders.length}</span>{' '}
                  order{unfulfilledOrders.length !== 1 ? 's' : ''}. Continue?
                </p>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFulfill}
                  className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
                >
                  Fulfill Orders
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
