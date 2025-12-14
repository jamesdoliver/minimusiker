'use client';

import { useState, Fragment } from 'react';
import { StockOrder, OrderStatus, formatStockCurrency, formatStockDate } from '@/lib/types/stock';
import OrderLineItemsBreakdown from './OrderLineItemsBreakdown';

interface OrdersTableProps {
  data: StockOrder[];
}

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  placed: {
    label: 'Placed',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  completed: {
    label: 'Completed',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function CostChangeIndicator({ percent }: { percent: number }) {
  if (percent === 0) {
    return <span className="text-gray-500 text-sm">0%</span>;
  }

  const isNegative = percent < 0;
  const arrow = isNegative ? '↓' : '↑';
  const colorClass = isNegative ? 'text-green-600' : 'text-red-600';
  const displayValue = Math.abs(percent).toFixed(1);

  return (
    <span className={`text-sm font-medium ${colorClass}`}>
      {arrow} {displayValue}%
    </span>
  );
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
        isOpen ? 'rotate-180' : ''
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function OrdersTable({ data }: OrdersTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (orderId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="text-4xl mb-4">📋</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No orders yet</h3>
        <p className="text-gray-600">Stock orders will appear here once placed.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-10 px-4 py-3"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order Date
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Items
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Qty
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Cost
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                % Change
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((order, index) => {
              const isExpanded = expandedRows.has(order.id);
              const isEven = index % 2 === 0;

              return (
                <Fragment key={order.id}>
                  <tr
                    className={`cursor-pointer hover:bg-gray-100 transition-colors ${
                      isEven ? 'bg-white' : 'bg-gray-50'
                    } ${isExpanded ? 'bg-blue-50 hover:bg-blue-50' : ''}`}
                    onClick={() => toggleRow(order.id)}
                  >
                    <td className="px-4 py-4">
                      <ChevronIcon isOpen={isExpanded} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {formatStockDate(order.orderDate)}
                      </div>
                      <div className="text-xs text-gray-500">Order {order.id}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">
                      {order.totalItems}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">
                      {order.totalQuantity}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                      {formatStockCurrency(order.totalCost)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <CostChangeIndicator percent={order.costChangePercent} />
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <div
                          className="overflow-hidden transition-all duration-300 ease-in-out"
                          style={{ maxHeight: isExpanded ? '800px' : '0' }}
                        >
                          <OrderLineItemsBreakdown lineItems={order.lineItems} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
