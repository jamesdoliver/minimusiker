'use client';

import { useState } from 'react';

interface AddManualCostFormProps {
  eventId: string;
  onSave: () => void;
  onCancel: () => void;
}

export default function AddManualCostForm({ eventId, onSave, onCancel }: AddManualCostFormProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !amount) {
      setError('Please fill in both fields');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setError('Amount must be a valid positive number');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/analytics/manual-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          eventId,
          costName: name.trim(),
          amount: parsedAmount,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add cost');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add cost. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 p-3 bg-white border border-gray-200 rounded-lg">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#94B8B3] focus:border-transparent"
            placeholder="e.g., Extra materials"
            disabled={isLoading}
          />
        </div>
        <div className="w-28">
          <label className="block text-xs text-gray-500 mb-1">Amount (€)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#94B8B3] focus:border-transparent"
            placeholder="0.00"
            step="0.01"
            min="0"
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-[#94B8B3] text-white rounded-md text-sm hover:bg-[#7a9e99] disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Adding...' : 'Add'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </form>
  );
}
