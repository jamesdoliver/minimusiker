'use client';

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import EventWaveCard from './EventWaveCard';
import type { EventWaveSummary } from '@/lib/services/orderWaveService';

export default function OrdersEventList() {
  const [events, setEvents] = useState<EventWaveSummary[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/admin/orders/events', {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch events');
      }

      const data = await response.json();

      if (data.success) {
        setEvents(data.data.events || []);
      } else {
        throw new Error(data.error || 'Failed to load events');
      }
    } catch (err) {
      console.error('Error fetching order events:', err);
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter events by search query (school name or event ID)
  const filteredEvents = useMemo(() => {
    if (!search.trim()) return events;

    const query = search.toLowerCase();
    return events.filter(
      (e) =>
        e.schoolName?.toLowerCase().includes(query) ||
        e.eventId?.toLowerCase().includes(query)
    );
  }, [events, search]);

  // Loading state: skeleton cards
  if (isLoading) {
    return (
      <div>
        <SearchBar value={search} onChange={setSearch} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Error: {error}</p>
        <button
          onClick={fetchEvents}
          className="mt-2 text-sm text-red-700 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      <SearchBar value={search} onChange={setSearch} />

      {filteredEvents.length === 0 ? (
        <div className="text-center py-16">
          <svg
            className="mx-auto h-12 w-12 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <p className="mt-4 text-gray-500 text-sm">
            {search.trim()
              ? 'No events match your search'
              : 'No events with orders found'}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">
            {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} with orders
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map((event) => (
              <EventWaveCard key={event.eventRecordId} event={event} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="relative mb-6 max-w-md">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        placeholder="Search by school name or event ID..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm',
          'focus:ring-2 focus:ring-[#94B8B3] focus:border-[#94B8B3]',
          'placeholder:text-gray-400'
        )}
      />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse">
      <div className="px-5 pt-5 pb-3">
        <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
        <div className="h-4 bg-gray-100 rounded w-1/3" />
      </div>
      <div className="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100">
        <div className="px-4 py-3 space-y-2">
          <div className="h-3 bg-gray-100 rounded w-1/2" />
          <div className="h-3 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
        <div className="px-4 py-3 space-y-2">
          <div className="h-3 bg-gray-100 rounded w-1/2" />
          <div className="h-3 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    </div>
  );
}
