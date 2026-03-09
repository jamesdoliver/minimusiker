'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface OrderLineItem {
  variantId: string;
  productTitle: string;
  variantTitle?: string;
  quantity: number;
  price: number;
  total: number;
  waveCategory: 'clothing' | 'audio' | 'standard' | 'unknown';
}

export interface WaveOrder {
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

interface OrderCardProps {
  order: WaveOrder;
  onWaveOverride?: (orderId: string, wave: string) => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

function FulfillmentBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  const config: Record<string, { bg: string; text: string; label: string }> = {
    fulfilled: { bg: 'bg-green-100', text: 'text-green-800', label: 'Fulfilled' },
    partial: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Partial' },
    unfulfilled: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Unfulfilled' },
  };

  const c = config[normalized] ?? config.unfulfilled;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        c.bg,
        c.text,
      )}
    >
      {c.label}
    </span>
  );
}

export default function OrderCard({ order, onWaveOverride }: OrderCardProps) {
  const [expanded, setExpanded] = useState(false);

  const itemCount = order.lineItems.reduce((sum, li) => sum + li.quantity, 0);

  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden transition-shadow hover:shadow-md',
      )}
    >
      {/* Compact header -- always visible */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              #{order.orderNumber}
            </p>
            <p className="text-xs text-gray-500 truncate">{order.customerName}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Items count + total */}
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">
              {formatCurrency(order.totalAmount)}
            </p>
            <p className="text-xs text-gray-500">
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </p>
          </div>

          <FulfillmentBadge status={order.fulfillmentStatus} />

          {/* Chevron */}
          <svg
            className={cn(
              'w-4 h-4 text-gray-400 transition-transform',
              expanded && 'rotate-180',
            )}
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
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {/* Line items table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase">
                <th className="text-left py-1 font-medium">Item</th>
                <th className="text-right py-1 font-medium w-12">Qty</th>
                <th className="text-right py-1 font-medium w-20">Price</th>
                <th className="text-right py-1 font-medium w-20">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {order.lineItems.map((li, idx) => (
                <tr key={`${li.variantId}-${idx}`}>
                  <td className="py-1.5 text-gray-900">
                    <span>{li.productTitle}</span>
                    {li.variantTitle && (
                      <span className="ml-1 text-gray-500">({li.variantTitle})</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right text-gray-700">{li.quantity}</td>
                  <td className="py-1.5 text-right text-gray-700">
                    {formatCurrency(li.price)}
                  </td>
                  <td className="py-1.5 text-right font-medium text-gray-900">
                    {formatCurrency(li.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer row: total + wave info */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              Wave: <span className="font-medium text-gray-700">{order.shipmentWave}</span>
            </span>
            <span className="text-sm font-semibold text-gray-900">
              Total: {formatCurrency(order.totalAmount)}
            </span>
          </div>

          {/* Wave override hook (placeholder for Task 5.3) */}
          {onWaveOverride && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => onWaveOverride(order.recordId, order.shipmentWave)}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Override wave
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
