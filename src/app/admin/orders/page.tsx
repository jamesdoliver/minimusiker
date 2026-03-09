'use client';

import OrdersEventList from '@/components/admin/orders/OrdersEventList';

export default function AdminOrders() {
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600 mt-1">
            Event-based order management and fulfillment
          </p>
        </div>
      </div>

      {/* Event List */}
      <OrdersEventList />
    </div>
  );
}
