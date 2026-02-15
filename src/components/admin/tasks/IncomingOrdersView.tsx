'use client';

import { useState, useEffect, useCallback } from 'react';
import { GuesstimateOrderWithEventDetails } from '@/lib/types/tasks';
import IncomingOrderCard from './IncomingOrderCard';

interface IncomingOrdersViewProps {
  onStockArrived?: () => void; // Callback to refresh parent data (e.g. shipping badges)
}

export default function IncomingOrdersView({ onStockArrived }: IncomingOrdersViewProps) {
  const [orders, setOrders] = useState<GuesstimateOrderWithEventDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIncomingOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/tasks/guesstimate-orders?status=pending');
      if (!response.ok) {
        throw new Error(`Server error (${response.status})`);
      }
      const data = await response.json();
      if (data.success) {
        setOrders(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch incoming orders');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load incoming orders');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncomingOrders();
  }, [fetchIncomingOrders]);

  const handleMarkArrived = async (goId: string) => {
    const response = await fetch(`/api/admin/tasks/guesstimate-orders/${goId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Server error (${response.status})`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to mark order as arrived');
    }

    // Refresh incoming orders
    await fetchIncomingOrders();
    // Notify parent to refresh pending tasks (for shipping badge updates)
    onStockArrived?.();
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow-sm border border-gray-200 h-48 animate-pulse"
          >
            <div className="h-10 bg-gray-100 border-b"></div>
            <div className="p-4 space-y-3">
              <div className="h-4 bg-gray-100 rounded w-3/4"></div>
              <div className="h-3 bg-gray-100 rounded w-full"></div>
              <div className="h-3 bg-gray-100 rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Error: {error}</p>
        <button
          onClick={fetchIncomingOrders}
          className="mt-2 text-sm text-red-700 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="text-5xl mb-4">📦</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No Incoming Orders
        </h3>
        <p className="text-gray-600">
          No incoming orders awaiting delivery.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {orders.map((order) => (
        <IncomingOrderCard
          key={order.id}
          order={order}
          onMarkArrived={handleMarkArrived}
        />
      ))}
    </div>
  );
}
