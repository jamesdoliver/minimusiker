'use client';

import { useState } from 'react';
import { StandardClothingBatch } from '@/lib/types/clothingOrders';
import { TSHIRT_SIZES, HOODIE_SIZES } from '@/lib/config/clothingVariants';

interface StandardClothingBatchCardProps {
  batch: StandardClothingBatch;
  onViewOrders: (batch: StandardClothingBatch) => void;
  onMarkComplete: (batch: StandardClothingBatch) => void;
}

export default function StandardClothingBatchCard({
  batch,
  onViewOrders,
  onMarkComplete,
}: StandardClothingBatchCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const totalTshirts = Object.values(batch.aggregated_items.tshirts).reduce((a, b) => a + b, 0);
  const totalHoodies = Object.values(batch.aggregated_items.hoodies).reduce((a, b) => a + b, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border-2 border-indigo-200 overflow-hidden">
      {/* Batch Header Badge */}
      <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-indigo-800">
            {batch.batch_id}
          </span>
          <span className="text-xs text-indigo-600">
            {formatDate(batch.week_start)} - {formatDate(batch.week_end)}
          </span>
        </div>
      </div>

      {/* Expandable Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">
              {batch.event_names.length > 0
                ? batch.event_names.length === 1
                  ? batch.event_names[0]
                  : `${batch.event_names.length} schools`
                : 'Standard Orders'}
            </h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {batch.total_orders} order{batch.total_orders !== 1 ? 's' : ''} - {formatCurrency(batch.total_revenue)} revenue
          </p>
          {batch.event_names.length > 1 && (
            <p className="text-xs text-gray-500 mt-1 truncate">
              {batch.event_names.join(', ')}
            </p>
          )}
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
                      {batch.aggregated_items.tshirts[size] || 0}
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
                      {batch.aggregated_items.hoodies[size] || 0}
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
                onViewOrders(batch);
              }}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              View Order List
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkComplete(batch);
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
