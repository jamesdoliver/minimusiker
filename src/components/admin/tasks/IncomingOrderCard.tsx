'use client';

import { useState } from 'react';
import { GuesstimateOrderWithEventDetails } from '@/lib/types/tasks';

interface IncomingOrderCardProps {
  order: GuesstimateOrderWithEventDetails;
  onMarkArrived: (goId: string) => Promise<void>;
}

export default function IncomingOrderCard({ order, onMarkArrived }: IncomingOrderCardProps) {
  const [isMarking, setIsMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const handleMarkArrived = async () => {
    setIsMarking(true);
    setError(null);
    try {
      await onMarkArrived(order.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as arrived');
    } finally {
      setIsMarking(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
          {order.go_id}
        </span>
        <span className="text-xs text-gray-500">
          Ordered {formatDate(order.order_date || order.created_at)}
        </span>
      </div>

      {/* School & Event Info */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
        <p className="text-sm font-medium text-gray-900">{order.school_name}</p>
        <p className="text-xs text-gray-500">Event: {formatDate(order.event_date)}</p>
      </div>

      {/* Items Table */}
      <div className="px-4 py-3">
        {order.parsed_contains.length > 0 ? (
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items</h4>
            <div className="space-y-1">
              {order.parsed_contains.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-700">{item.name}</span>
                  <span className="font-medium text-gray-900">x{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">No item details available</p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          {order.order_amount ? formatCurrency(order.order_amount) : ''}
        </span>
        <button
          onClick={handleMarkArrived}
          disabled={isMarking}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isMarking ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Marking...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Mark Stock Arrived
            </>
          )}
        </button>
      </div>
    </div>
  );
}
