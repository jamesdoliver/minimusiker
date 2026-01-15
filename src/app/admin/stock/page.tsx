'use client';

import { useState, useEffect, useMemo } from 'react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import StockTabs from '@/components/admin/stock/StockTabs';
import InventoryTable from '@/components/admin/stock/InventoryTable';
import OrdersTable from '@/components/admin/stock/OrdersTable';
import StockExportButtons from '@/components/admin/stock/StockExportButtons';
import {
  StockItem,
  StockOrder,
  StockTab,
  formatStockCurrency,
} from '@/lib/types/stock';

export default function AdminStock() {
  const [activeTab, setActiveTab] = useState<StockTab>('inventory');
  const [inventory, setInventory] = useState<StockItem[]>([]);
  const [orders, setOrders] = useState<StockOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Empty data - will be populated from Stock API when integrated
      const emptyInventory: StockItem[] = [];
      const emptyOrders: StockOrder[] = [];

      setInventory(emptyInventory);
      setOrders(emptyOrders);
    } catch (err) {
      console.error('Error fetching stock data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load stock data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateCost = async (id: string, newCost: number) => {
    // Update local state (API integration coming later)
    setInventory((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              costPerUnit: newCost,
              costOverride: newCost,
              lastUpdated: new Date().toISOString(),
            }
          : item
      )
    );
  };

  // Calculate summary statistics for inventory
  const inventorySummary = useMemo(() => {
    const totalItems = inventory.length;
    const totalStock = inventory.reduce((sum, item) => sum + item.inStock, 0);
    const totalValue = inventory.reduce((sum, item) => sum + item.inStock * item.costPerUnit, 0);
    const lowStockItems = inventory.filter((item) => item.inStock <= 5).length;

    return {
      totalItems,
      totalStock,
      totalValue,
      lowStockItems,
    };
  }, [inventory]);

  // Calculate summary statistics for orders
  const ordersSummary = useMemo(() => {
    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, order) => sum + order.totalCost, 0);
    const pendingOrders = orders.filter((o) => o.status === 'pending').length;
    const completedOrders = orders.filter((o) => o.status === 'completed').length;

    return {
      totalOrders,
      totalSpent,
      pendingOrders,
      completedOrders,
    };
  }, [orders]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="print:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Stock Management</h1>
          <p className="text-gray-600 mt-1">
            {activeTab === 'inventory'
              ? `${inventorySummary.totalItems} items in inventory`
              : `${ordersSummary.totalOrders} orders`}
          </p>
        </div>
        <div className="print:hidden">
          <StockExportButtons
            activeTab={activeTab}
            inventoryData={inventory}
            ordersData={orders}
          />
        </div>
      </div>

      {/* Summary Cards */}
      {activeTab === 'inventory' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-500">Total SKUs</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{inventorySummary.totalItems}</p>
            <p className="text-xs text-gray-400 mt-1">Unique items</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-500">Total Stock</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{inventorySummary.totalStock}</p>
            <p className="text-xs text-gray-400 mt-1">Units in inventory</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-500">Inventory Value</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatStockCurrency(inventorySummary.totalValue)}
            </p>
            <p className="text-xs text-gray-400 mt-1">At cost</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-500">Low Stock</p>
            <p
              className={`text-2xl font-bold mt-1 ${
                inventorySummary.lowStockItems > 0 ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {inventorySummary.lowStockItems}
            </p>
            <p className="text-xs text-gray-400 mt-1">Items with ≤5 units</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-500">Total Orders</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{ordersSummary.totalOrders}</p>
            <p className="text-xs text-gray-400 mt-1">All time</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-500">Total Spent</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatStockCurrency(ordersSummary.totalSpent)}
            </p>
            <p className="text-xs text-gray-400 mt-1">On stock orders</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-500">Pending</p>
            <p
              className={`text-2xl font-bold mt-1 ${
                ordersSummary.pendingOrders > 0 ? 'text-orange-600' : 'text-gray-900'
              }`}
            >
              {ordersSummary.pendingOrders}
            </p>
            <p className="text-xs text-gray-400 mt-1">Awaiting placement</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-500">Completed</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {ordersSummary.completedOrders}
            </p>
            <p className="text-xs text-gray-400 mt-1">Successfully fulfilled</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <StockTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Table Content */}
      {activeTab === 'inventory' ? (
        <InventoryTable data={inventory} onUpdateCost={handleUpdateCost} />
      ) : (
        <OrdersTable data={orders} />
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          nav,
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
