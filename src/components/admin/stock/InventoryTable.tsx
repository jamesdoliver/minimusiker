'use client';

import { useState } from 'react';
import { StockItem, formatStockCurrency, formatLastUpdated, hasSizes } from '@/lib/types/stock';

interface InventoryTableProps {
  data: StockItem[];
  onUpdateCost: (id: string, newCost: number) => Promise<void>;
}

interface EditingState {
  id: string | null;
  value: string;
}

export default function InventoryTable({ data, onUpdateCost }: InventoryTableProps) {
  const [editing, setEditing] = useState<EditingState>({ id: null, value: '' });
  const [saving, setSaving] = useState(false);

  const startEdit = (item: StockItem) => {
    setEditing({
      id: item.id,
      value: item.costPerUnit.toFixed(2),
    });
  };

  const cancelEdit = () => {
    setEditing({ id: null, value: '' });
  };

  const saveEdit = async (item: StockItem) => {
    const newCost = parseFloat(editing.value);
    if (isNaN(newCost) || newCost < 0) {
      cancelEdit();
      return;
    }

    setSaving(true);
    try {
      await onUpdateCost(item.id, newCost);
    } finally {
      setSaving(false);
      setEditing({ id: null, value: '' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, item: StockItem) => {
    if (e.key === 'Enter') {
      saveEdit(item);
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="text-4xl mb-4">📦</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No inventory items</h3>
        <p className="text-gray-600">Inventory items will appear here once synced.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Item
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Size
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                In Stock
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cost per Unit
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Updated
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item, index) => {
              const isEditing = editing.id === item.id;
              const isEven = index % 2 === 0;
              const hasOverride = item.costOverride !== undefined && item.costOverride !== null;

              return (
                <tr
                  key={item.id}
                  className={isEven ? 'bg-white' : 'bg-gray-50'}
                >
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{item.item}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {hasSizes(item.item) && item.size ? `${item.size} cm` : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`text-sm font-medium ${
                        item.inStock <= 5
                          ? 'text-red-600'
                          : item.inStock <= 10
                          ? 'text-yellow-600'
                          : 'text-gray-900'
                      }`}
                    >
                      {item.inStock}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isEditing ? (
                      <div className="flex items-center justify-end gap-2">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                            €
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editing.value}
                            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                            onKeyDown={(e) => handleKeyDown(e, item)}
                            className="w-20 pl-6 pr-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-2 focus:ring-[#94B8B3] focus:border-[#94B8B3] outline-none"
                            autoFocus
                            disabled={saving}
                          />
                        </div>
                        <button
                          onClick={() => saveEdit(item)}
                          disabled={saving}
                          className="px-2 py-1 text-xs font-medium text-white bg-[#94B8B3] rounded hover:bg-[#7fa39e] transition-colors disabled:opacity-50"
                        >
                          {saving ? '...' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={saving}
                          className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEdit(item)}
                          className="text-sm text-gray-900 hover:text-[#94B8B3] transition-colors cursor-pointer"
                          title="Click to edit"
                        >
                          {formatStockCurrency(item.costPerUnit)}
                        </button>
                        {hasOverride && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Override
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-500">
                    {formatLastUpdated(item.lastUpdated)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
