'use client';

import { useState, useEffect, useCallback } from 'react';
import { StandardClothingBatch } from '@/lib/types/clothingOrders';
import StandardClothingBatchCard from './StandardClothingBatchCard';
import StandardBatchOrderListModal from './StandardBatchOrderListModal';
import StandardBatchCompletionModal from './StandardBatchCompletionModal';

interface StandardClothingBatchViewProps {
  isActive: boolean;
}

export default function StandardClothingBatchView({ isActive }: StandardClothingBatchViewProps) {
  const [batches, setBatches] = useState<StandardClothingBatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<StandardClothingBatch | null>(null);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);

  const fetchBatches = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/tasks/standard-clothing-batches');
      if (!response.ok) {
        throw new Error(`Server error (${response.status})`);
      }
      const data = await response.json();
      if (data.success) {
        setBatches(data.data.batches);
      } else {
        throw new Error(data.error || 'Failed to fetch standard clothing batches');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load standard clothing batches');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      fetchBatches();
    }
  }, [isActive, fetchBatches]);

  const handleViewOrders = (batch: StandardClothingBatch) => {
    setSelectedBatch(batch);
    setIsListModalOpen(true);
  };

  const handleMarkComplete = (batch: StandardClothingBatch) => {
    setSelectedBatch(batch);
    setIsCompletionModalOpen(true);
  };

  const handleCompletionSuccess = () => {
    fetchBatches();
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow-sm border border-gray-200 h-48 animate-pulse"
          >
            <div className="h-10 bg-gray-100 border-b"></div>
            <div className="p-4 space-y-3">
              <div className="h-4 bg-gray-100 rounded w-3/4"></div>
              <div className="h-3 bg-gray-100 rounded w-full"></div>
              <div className="h-3 bg-gray-100 rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Error: {error}</p>
        <button
          onClick={fetchBatches}
          className="mt-2 text-sm text-red-700 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="text-5xl mb-4">🏷️</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No Pending Standard Clothing Batches
        </h3>
        <p className="text-gray-600">
          Standard clothing batches are created automatically every Monday morning from the previous week&apos;s orders.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {batches.map((batch) => (
          <StandardClothingBatchCard
            key={batch.task_id}
            batch={batch}
            onViewOrders={handleViewOrders}
            onMarkComplete={handleMarkComplete}
          />
        ))}
      </div>

      {selectedBatch && (
        <StandardBatchOrderListModal
          batch={selectedBatch}
          isOpen={isListModalOpen}
          onClose={() => {
            setIsListModalOpen(false);
            setSelectedBatch(null);
          }}
        />
      )}

      {selectedBatch && (
        <StandardBatchCompletionModal
          batch={selectedBatch}
          isOpen={isCompletionModalOpen}
          onClose={() => {
            setIsCompletionModalOpen(false);
            setSelectedBatch(null);
          }}
          onComplete={handleCompletionSuccess}
        />
      )}
    </>
  );
}
