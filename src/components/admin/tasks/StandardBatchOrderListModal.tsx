'use client';

import { useState, useEffect, useMemo } from 'react';
import { StandardClothingBatch, StandardClothingOrderDetail } from '@/lib/types/clothingOrders';

interface StandardBatchOrderListModalProps {
  batch: StandardClothingBatch;
  isOpen: boolean;
  onClose: () => void;
}

export default function StandardBatchOrderListModal({
  batch,
  isOpen,
  onClose,
}: StandardBatchOrderListModalProps) {
  const [orders, setOrders] = useState<StandardClothingOrderDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen && batch) {
      fetchOrders();
    }
  }, [isOpen, batch]);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/tasks/standard-clothing-batches/${batch.task_id}/orders`
      );
      const data = await response.json();
      if (data.success) {
        setOrders(data.data.orders);
      }
    } catch (error) {
      console.error('Error fetching batch orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    if (!searchQuery) return orders;
    const query = searchQuery.toLowerCase();
    return orders.filter(
      (order) =>
        order.order_number.toLowerCase().includes(query) ||
        order.parent_name.toLowerCase().includes(query) ||
        order.school_name.toLowerCase().includes(query)
    );
  }, [orders, searchQuery]);

  // Group orders by school
  const ordersBySchool = useMemo(() => {
    const groups = new Map<string, StandardClothingOrderDetail[]>();
    for (const order of filteredOrders) {
      const school = order.school_name;
      if (!groups.has(school)) {
        groups.set(school, []);
      }
      groups.get(school)!.push(order);
    }
    return groups;
  }, [filteredOrders]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Standard Clothing Orders - {batch.batch_id}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {batch.week_start} to {batch.week_end} - {batch.total_orders} orders - {formatCurrency(batch.total_revenue)} total
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4">
              <input
                type="text"
                placeholder="Search by name, school, or order #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#94B8B3] focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#94B8B3]"></div>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? 'No orders match your search' : 'No orders found'}
              </div>
            ) : (
              <div className="space-y-6">
                {Array.from(ordersBySchool.entries()).map(([school, schoolOrders]) => (
                  <div key={school}>
                    <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 bg-indigo-400 rounded-full"></span>
                      {school}
                      <span className="text-xs font-normal text-gray-500">
                        ({schoolOrders.length} order{schoolOrders.length !== 1 ? 's' : ''})
                      </span>
                    </h3>
                    <div className="space-y-2 ml-4">
                      {schoolOrders.map((order) => (
                        <div
                          key={order.order_id}
                          className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-medium text-gray-900">
                                #{order.order_number}
                              </span>
                              <span className="text-gray-500 mx-2">-</span>
                              <span className="text-gray-600">
                                {formatDate(order.order_date)}
                              </span>
                            </div>
                            <span className="font-medium text-gray-900">
                              {formatCurrency(order.total_amount)}
                            </span>
                          </div>
                          <div className="text-sm text-gray-700 mt-1">
                            {order.parent_name}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {order.clothing_items.map((item, idx) => (
                              <span key={idx}>
                                {idx > 0 && ', '}
                                {item.type === 'tshirt' ? 'T-Shirt' : 'Hoodie'} ({item.size}) x{item.quantity}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
