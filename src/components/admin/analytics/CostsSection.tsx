'use client';

import { useState } from 'react';
import { EventCosts } from '@/lib/types/analytics';
import ManualCostRow from './ManualCostRow';
import AddManualCostForm from './AddManualCostForm';

interface CostsSectionProps {
  eventId: string;
  costs: EventCosts;
  onManualCostChange: () => void;
}

function formatCurrency(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

export default function CostsSection({ eventId, costs, onManualCostChange }: CostsSectionProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCostId, setEditingCostId] = useState<string | null>(null);

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-3">All Costs</h4>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="pb-2 font-medium" colSpan={2}>Item</th>
            <th className="pb-2 font-medium text-right">Total</th>
            <th className="pb-2 w-16"></th>
          </tr>
        </thead>
        <tbody className="text-gray-700">
          {/* Fixed Costs */}
          <tr>
            <td className="py-1" colSpan={2}>Team Member</td>
            <td className="py-1 text-right">{formatCurrency(costs.fixed.teamMember)}</td>
            <td></td>
          </tr>
          <tr>
            <td className="py-1" colSpan={2}>Mixing</td>
            <td className="py-1 text-right">{formatCurrency(costs.fixed.mixing)}</td>
            <td></td>
          </tr>
          <tr>
            <td className="py-1" colSpan={2}>Stickers & Certificate</td>
            <td className="py-1 text-right">{formatCurrency(costs.fixed.stickers)}</td>
            <td></td>
          </tr>
          <tr>
            <td className="py-1" colSpan={2}>Initial Poster</td>
            <td className="py-1 text-right">{formatCurrency(costs.fixed.poster)}</td>
            <td></td>
          </tr>

          {/* Variable Costs */}
          {costs.variable.map((item) => (
            <tr key={item.item}>
              <td className="py-1" colSpan={2}>
                {item.item} <span className="text-gray-400">({item.quantity})</span>
              </td>
              <td className="py-1 text-right">{formatCurrency(item.total)}</td>
              <td></td>
            </tr>
          ))}

          {/* Manual Costs */}
          {costs.manual.map((cost) => (
            <ManualCostRow
              key={cost.id}
              cost={cost}
              isEditing={editingCostId === cost.id}
              onEdit={() => setEditingCostId(cost.id)}
              onSave={() => {
                setEditingCostId(null);
                onManualCostChange();
              }}
              onDelete={onManualCostChange}
              onCancel={() => setEditingCostId(null)}
            />
          ))}
        </tbody>
      </table>

      {/* Total */}
      <div className="border-t border-gray-300 pt-2 mt-2 flex justify-between font-semibold text-sm">
        <span>Total Costs</span>
        <span>{formatCurrency(costs.totalCost)}</span>
      </div>

      {/* Add Cost Form/Button */}
      {showAddForm ? (
        <AddManualCostForm
          eventId={eventId}
          onSave={() => {
            setShowAddForm(false);
            onManualCostChange();
          }}
          onCancel={() => setShowAddForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="mt-3 text-sm text-[#94B8B3] hover:text-[#7a9e99] flex items-center gap-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add manual cost
        </button>
      )}
    </div>
  );
}
