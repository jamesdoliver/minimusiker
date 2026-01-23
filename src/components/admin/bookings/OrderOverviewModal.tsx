'use client';

import { useEffect, useRef, useState } from 'react';

interface ItemBreakdown {
  name: string;
  quantity: number;
  revenue: number;
}

interface OrderSummaryData {
  totalOrders: number;
  totalRevenue: number;
  totalItems: number;
  itemsBreakdown: ItemBreakdown[];
}

interface OrderOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  schoolName: string;
  eventDate: string;
}

export default function OrderOverviewModal({
  isOpen,
  onClose,
  eventId,
  schoolName,
  eventDate,
}: OrderOverviewModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OrderSummaryData | null>(null);

  // Fetch order data when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          eventId,
          schoolName,
          eventDate,
        });

        const response = await fetch(`/api/admin/orders/event-summary?${params}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch order data');
        }

        const result = await response.json();

        if (result.success) {
          setData(result.data);
        } else {
          throw new Error(result.error || 'Failed to fetch order data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, eventId, schoolName, eventDate]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-overview-modal-title"
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 id="order-overview-modal-title" className="text-lg font-semibold text-gray-900">
            Order Overview - {schoolName}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="w-8 h-8 text-purple-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-red-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          ) : data && data.totalOrders === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <p className="text-gray-600 font-medium">No orders yet for this event</p>
              <p className="text-gray-500 text-sm mt-1">Orders will appear here once parents start purchasing</p>
            </div>
          ) : data ? (
            <>
              {/* Summary Row */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-purple-600 font-medium">Total Orders</p>
                  <p className="text-2xl font-bold text-purple-700">{data.totalOrders}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-green-600 font-medium">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-700">{formatCurrency(data.totalRevenue)}</p>
                </div>
              </div>

              {/* Items Table */}
              {data.itemsBreakdown.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Items Breakdown</h3>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Qty
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Item
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Revenue
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {data.itemsBreakdown.map((item, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {item.quantity}x
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {item.name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 text-right">
                              {formatCurrency(item.revenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 bg-gray-50">
          {data && data.totalItems > 0 ? (
            <p className="text-sm text-gray-600">
              <span className="font-medium">{data.totalItems}</span> total items sold
            </p>
          ) : (
            <div />
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
