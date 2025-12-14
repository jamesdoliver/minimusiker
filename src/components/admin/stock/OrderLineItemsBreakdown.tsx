'use client';

import { OrderLineItem, formatStockCurrency, hasSizes, StockItemType } from '@/lib/types/stock';

interface OrderLineItemsBreakdownProps {
  lineItems: OrderLineItem[];
}

export default function OrderLineItemsBreakdown({ lineItems }: OrderLineItemsBreakdownProps) {
  // Group shopify orders and event codes
  const allShopifyOrders = [...new Set(lineItems.flatMap((li) => li.shopifyOrderIds))];
  const allEventCodes = [...new Set(lineItems.flatMap((li) => li.eventCodes))];

  return (
    <div className="bg-gray-50 px-8 py-6 border-t border-gray-200">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Items Table */}
        <div className="lg:col-span-2">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Order Items</h4>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Item
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Size
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Qty
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Unit Cost
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lineItems.map((lineItem) => (
                  <tr key={lineItem.id}>
                    <td className="px-4 py-2 text-sm text-gray-900">{lineItem.item}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {hasSizes(lineItem.item as StockItemType) && lineItem.size
                        ? `${lineItem.size} cm`
                        : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">
                      {lineItem.quantity}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 text-right">
                      {formatStockCurrency(lineItem.unitCost)}
                    </td>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                      {formatStockCurrency(lineItem.totalCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-sm font-semibold text-gray-700 text-right">
                    Order Total:
                  </td>
                  <td className="px-4 py-2 text-sm font-bold text-gray-900 text-right">
                    {formatStockCurrency(lineItems.reduce((sum, li) => sum + li.totalCost, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Linked Orders & Events */}
        <div className="space-y-4">
          {/* Shopify Orders */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Linked Shopify Orders</h4>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              {allShopifyOrders.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {allShopifyOrders.map((orderId) => (
                    <span
                      key={orderId}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                    >
                      {orderId}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No linked orders</p>
              )}
            </div>
          </div>

          {/* Event Codes */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Event Codes</h4>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              {allEventCodes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {allEventCodes.map((eventCode) => (
                    <span
                      key={eventCode}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {eventCode}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No linked events</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
