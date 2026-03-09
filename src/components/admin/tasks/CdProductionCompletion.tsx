'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface CdProductionCompletionProps {
  taskId: string;
  eventId: string;
  onComplete: () => void;
}

export default function CdProductionCompletion({
  taskId,
  eventId,
  onComplete,
}: CdProductionCompletionProps) {
  const [quantity, setQuantity] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch CD quantity on mount
  useEffect(() => {
    const fetchQuantity = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/admin/tasks/${taskId}/cd-quantity`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch CD quantity');
        }

        setQuantity(data.data.quantity);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load CD quantity');
      } finally {
        setLoading(false);
      }
    };

    fetchQuantity();
  }, [taskId]);

  const handleComplete = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completion_data: { quantity_confirmed: true },
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to complete task');
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete task');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">CD Production</h3>
      </div>

      {/* Body */}
      <div className="px-6 py-6">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#94B8B3]" />
            <span className="ml-3 text-gray-600">Loading CD quantity...</span>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Quantity Display */}
        {!loading && !error && quantity !== null && (
          <div className="text-center space-y-6">
            {quantity === 0 ? (
              <div className="py-4">
                <p className="text-gray-500 text-base">
                  No CDs ordered for this event
                </p>
              </div>
            ) : (
              <div className="py-4">
                <p className="text-sm text-gray-500 mb-1">CDs Ordered</p>
                <p className="text-5xl font-bold text-gray-900">{quantity}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && !error && quantity !== null && (
        <div className="px-6 py-4 border-t border-gray-200">
          <button
            onClick={handleComplete}
            disabled={isSubmitting}
            className={cn(
              'w-full px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors',
              'bg-[#94B8B3] hover:bg-[#7da39e]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center'
            )}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Completing...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Mark Complete
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
