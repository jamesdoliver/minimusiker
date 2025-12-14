'use client';

import { StockItem, StockOrder, StockTab, formatStockCurrency, hasSizes } from '@/lib/types/stock';

interface StockExportButtonsProps {
  activeTab: StockTab;
  inventoryData: StockItem[];
  ordersData: StockOrder[];
}

function generateInventoryCSV(data: StockItem[]): string {
  const headers = ['Item', 'Size', 'In Stock', 'Cost per Unit (€)', 'Base Cost (€)', 'Has Override', 'Last Updated'];

  const rows = data.map((item) => [
    item.item,
    hasSizes(item.item) && item.size ? `${item.size} cm` : '-',
    item.inStock,
    item.costPerUnit.toFixed(2),
    item.baseCost.toFixed(2),
    item.costOverride !== undefined && item.costOverride !== null ? 'Yes' : 'No',
    item.lastUpdated,
  ]);

  return formatCSV(headers, rows);
}

function generateOrdersCSV(data: StockOrder[]): string {
  const headers = [
    'Order ID',
    'Order Date',
    'Status',
    'Total Items',
    'Total Quantity',
    'Total Cost (€)',
    'Cost Change %',
  ];

  const rows = data.map((order) => [
    order.id,
    order.orderDate,
    order.status,
    order.totalItems,
    order.totalQuantity,
    order.totalCost.toFixed(2),
    `${order.costChangePercent >= 0 ? '+' : ''}${order.costChangePercent.toFixed(1)}%`,
  ]);

  return formatCSV(headers, rows);
}

function formatCSV(headers: string[], rows: (string | number)[][]): string {
  const csvContent = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        })
        .join(',')
    )
    .join('\n');

  return csvContent;
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function printPDF() {
  window.print();
}

export default function StockExportButtons({
  activeTab,
  inventoryData,
  ordersData,
}: StockExportButtonsProps) {
  const handleExportCSV = () => {
    const dateStr = new Date().toISOString().split('T')[0];

    if (activeTab === 'inventory') {
      const csv = generateInventoryCSV(inventoryData);
      downloadCSV(csv, `stock-inventory-${dateStr}.csv`);
    } else {
      const csv = generateOrdersCSV(ordersData);
      downloadCSV(csv, `stock-orders-${dateStr}.csv`);
    }
  };

  return (
    <div className="flex gap-3">
      <button
        onClick={handleExportCSV}
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#94B8B3] transition-colors"
        title="Export to CSV"
      >
        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        Export CSV
      </button>
      <button
        onClick={printPDF}
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#94B8B3] transition-colors"
        title="Print / Save as PDF"
      >
        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
          />
        </svg>
        Print PDF
      </button>
    </div>
  );
}
