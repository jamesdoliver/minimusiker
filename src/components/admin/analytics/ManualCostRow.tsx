'use client';

import { useState } from 'react';
import { ManualCost } from '@/lib/types/analytics';

interface ManualCostRowProps {
  cost: ManualCost;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

function formatCurrency(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

export default function ManualCostRow({
  cost,
  isEditing,
  onEdit,
  onSave,
  onDelete,
  onCancel,
}: ManualCostRowProps) {
  const [name, setName] = useState(cost.costName);
  const [amount, setAmount] = useState(cost.amount.toString());
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (!name.trim() || isNaN(parsedAmount) || parsedAmount < 0) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/analytics/manual-costs/${cost.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ costName: name.trim(), amount: parsedAmount }),
      });

      if (!response.ok) {
        throw new Error('Failed to update cost');
      }

      onSave();
    } catch (error) {
      console.error('Failed to update cost:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this cost?')) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/analytics/manual-costs/${cost.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete cost');
      }

      onDelete();
    } catch (error) {
      console.error('Failed to delete cost:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isEditing) {
    return (
      <tr>
        <td className="py-1" colSpan={2}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#94B8B3]"
            placeholder="Cost name"
            disabled={isLoading}
          />
        </td>
        <td className="py-1">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#94B8B3]"
            placeholder="0.00"
            step="0.01"
            min="0"
            disabled={isLoading}
          />
        </td>
        <td className="py-1">
          <div className="flex gap-1 justify-end">
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="text-green-600 hover:text-green-800 p-1"
              title="Save"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="text-gray-400 hover:text-gray-600 p-1"
              title="Cancel"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="group">
      <td className="py-1 text-gray-600 italic" colSpan={2}>{cost.costName}</td>
      <td className="py-1 text-right">{formatCurrency(cost.amount)}</td>
      <td className="py-1">
        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="text-gray-400 hover:text-gray-600 p-1"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="text-red-400 hover:text-red-600 p-1"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}
