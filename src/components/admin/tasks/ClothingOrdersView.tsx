'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClothingOrderEvent } from '@/lib/types/clothingOrders';
import ClothingOrderCard from './ClothingOrderCard';
import ClothingOrderListModal from './ClothingOrderListModal';
import ClothingOrderCompletionModal from './ClothingOrderCompletionModal';
import PrintablesDownloadModal from './PrintablesDownloadModal';

interface ClothingOrdersViewProps {
  isActive: boolean;  // Only fetch when this tab is active
}

export default function ClothingOrdersView({ isActive }: ClothingOrdersViewProps) {
  const [events, setEvents] = useState<ClothingOrderEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<ClothingOrderEvent | null>(null);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [downloadPrintablesEvent, setDownloadPrintablesEvent] = useState<ClothingOrderEvent | null>(null);

  const fetchClothingOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/tasks/clothing-orders');
      const data = await response.json();
      if (data.success) {
        setEvents(data.data.events);
      } else {
        throw new Error(data.error || 'Failed to fetch clothing orders');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clothing orders');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch when tab becomes active
  useEffect(() => {
    if (isActive) {
      fetchClothingOrders();
    }
  }, [isActive, fetchClothingOrders]);

  const handleViewOrders = (event: ClothingOrderEvent) => {
    setSelectedEvent(event);
    setIsListModalOpen(true);
  };

  const handleMarkComplete = (event: ClothingOrderEvent) => {
    setSelectedEvent(event);
    setIsCompletionModalOpen(true);
  };

  const handleDownloadPrintables = (event: ClothingOrderEvent) => {
    setDownloadPrintablesEvent(event);
  };

  const handleCompletionSuccess = () => {
    fetchClothingOrders();
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
          onClick={fetchClothingOrders}
          className="mt-2 text-sm text-red-700 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="text-5xl mb-4">👕</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No Pending Clothing Orders
        </h3>
        <p className="text-gray-600">
          Clothing orders will appear here 3 days before their Order Day (18 days before event).
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((event) => (
          <ClothingOrderCard
            key={event.event_record_id}
            event={event}
            onViewOrders={handleViewOrders}
            onDownloadPrintables={handleDownloadPrintables}
            onMarkComplete={handleMarkComplete}
          />
        ))}
      </div>

      {/* Order List Modal */}
      {selectedEvent && (
        <ClothingOrderListModal
          event={selectedEvent}
          isOpen={isListModalOpen}
          onClose={() => {
            setIsListModalOpen(false);
            setSelectedEvent(null);
          }}
        />
      )}

      {/* Completion Modal */}
      {selectedEvent && (
        <ClothingOrderCompletionModal
          event={selectedEvent}
          isOpen={isCompletionModalOpen}
          onClose={() => {
            setIsCompletionModalOpen(false);
            setSelectedEvent(null);
          }}
          onComplete={handleCompletionSuccess}
        />
      )}

      {/* Printables Download Modal */}
      {downloadPrintablesEvent && (
        <PrintablesDownloadModal
          event={downloadPrintablesEvent}
          onClose={() => setDownloadPrintablesEvent(null)}
        />
      )}
    </>
  );
}
