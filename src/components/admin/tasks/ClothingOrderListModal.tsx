'use client';

import { useState, useEffect, useMemo } from 'react';
import { ClothingOrderEvent, ClothingOrderDetail } from '@/lib/types/clothingOrders';

interface ClothingOrderListModalProps {
  event: ClothingOrderEvent;
  isOpen: boolean;
  onClose: () => void;
}

export default function ClothingOrderListModal({
  event,
  isOpen,
  onClose,
}: ClothingOrderListModalProps) {
  const [orders, setOrders] = useState<ClothingOrderDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch orders when modal opens
  useEffect(() => {
    if (isOpen && event) {
      fetchOrders();
    }
  }, [isOpen, event]);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/tasks/clothing-orders/${event.event_record_id}/orders`
      );
      const data = await response.json();
      if (data.success) {
        setOrders(data.data.orders);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter orders based on search
  const filteredOrders = useMemo(() => {
    if (!searchQuery) return orders;
    const query = searchQuery.toLowerCase();
    return orders.filter(
      (order) =>
        order.order_number.toLowerCase().includes(query) ||
        order.parent_name.toLowerCase().includes(query) ||
        order.child_names.some((name) => name.toLowerCase().includes(query))
    );
  }, [orders, searchQuery]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Handle escape key
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Clothing Orders - {event.school_name}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Event: {formatDate(event.event_date)} - {event.total_orders} orders - {formatCurrency(event.total_revenue)} total
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

            {/* Search */}
            <div className="mt-4">
              <input
                type="text"
                placeholder="Search by name or order #..."
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
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <div
                    key={order.order_id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
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
                    <div className="text-sm text-gray-700 mt-2">
                      {order.parent_name} → {order.child_names.join(', ')}
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
