// src/components/admin/tasks/ClothingOrderCard.tsx

'use client';

import { useState } from 'react';
import { ClothingOrderEvent } from '@/lib/types/clothingOrders';
import { TSHIRT_SIZES, HOODIE_SIZES } from '@/lib/config/clothingVariants';

interface ClothingOrderCardProps {
  event: ClothingOrderEvent;
  onViewOrders: (event: ClothingOrderEvent) => void;
  onMarkComplete: (event: ClothingOrderEvent) => void;
}

export default function ClothingOrderCard({
  event,
  onViewOrders,
  onMarkComplete,
}: ClothingOrderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate urgency styling
  const getUrgencyBadge = () => {
    if (event.is_overdue) {
      const daysOverdue = Math.abs(event.days_until_order_day);
      return {
        text: `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`,
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        borderColor: 'border-red-300',
      };
    }
    if (event.days_until_order_day === 0) {
      return {
        text: 'Order Day',
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-800',
        borderColor: 'border-orange-300',
      };
    }
    return {
      text: `${event.days_until_order_day} day${event.days_until_order_day !== 1 ? 's' : ''}`,
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-700',
      borderColor: 'border-gray-200',
    };
  };

  const urgency = getUrgencyBadge();
  const cardBorderColor = event.is_overdue ? 'border-red-400' : 'border-gray-200';

  // Calculate totals
  const totalTshirts = Object.values(event.aggregated_items.tshirts).reduce((a, b) => a + b, 0);
  const totalHoodies = Object.values(event.aggregated_items.hoodies).reduce((a, b) => a + b, 0);

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

  return (
    <div className={`bg-white rounded-lg shadow-sm border-2 ${cardBorderColor} overflow-hidden`}>
      {/* Urgency Badge */}
      <div className={`px-4 py-2 ${urgency.bgColor} ${urgency.borderColor} border-b`}>
        <span className={`text-sm font-medium ${urgency.textColor}`}>
          {urgency.text}
        </span>
      </div>

      {/* Header Row (Always Visible) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">
              {event.school_name}
            </h3>
            <span className="text-sm text-gray-500">
              Event: {formatDate(event.event_date)}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {event.total_orders} order{event.total_orders !== 1 ? 's' : ''} - {formatCurrency(event.total_revenue)} revenue
          </p>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 ml-4 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Expanded Content */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? 'max-h-[500px]' : 'max-h-0'
        }`}
      >
        <div className="px-4 pb-4 border-t border-gray-100">
          {/* Item Breakdown */}
          <div className="grid grid-cols-2 gap-6 mt-4">
            {/* T-Shirts Column */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">
                T-Shirts
              </h4>
              <div className="space-y-1">
                {TSHIRT_SIZES.map((size) => (
                  <div key={size} className="flex justify-between text-sm">
                    <span className="text-gray-600">{size}:</span>
                    <span className="font-medium text-gray-900">
                      {event.aggregated_items.tshirts[size] || 0}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold pt-2 border-t mt-2">
                  <span className="text-gray-700">Total:</span>
                  <span className="text-gray-900">{totalTshirts}</span>
                </div>
              </div>
            </div>

            {/* Hoodies Column */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">
                Hoodies
              </h4>
              <div className="space-y-1">
                {HOODIE_SIZES.map((size) => (
                  <div key={size} className="flex justify-between text-sm">
                    <span className="text-gray-600">{size}:</span>
                    <span className="font-medium text-gray-900">
                      {event.aggregated_items.hoodies[size] || 0}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold pt-2 border-t mt-2">
                  <span className="text-gray-700">Total:</span>
                  <span className="text-gray-900">{totalHoodies}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewOrders(event);
              }}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              View Order List
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkComplete(event);
              }}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#94B8B3] rounded-lg hover:bg-[#7da39e] transition-colors"
            >
              Mark Complete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
