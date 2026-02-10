// src/components/admin/tasks/MinicardOrdersView.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { MinicardOrderEvent } from '@/lib/types/minicardOrders';
import { TaskWithEventDetails } from '@/lib/types/tasks';
import MinicardOrderCard from './MinicardOrderCard';

interface MinicardOrdersViewProps {
  isActive: boolean;
  onCompleteTask: (task: TaskWithEventDetails) => void;
}

export default function MinicardOrdersView({ isActive, onCompleteTask }: MinicardOrdersViewProps) {
  const [events, setEvents] = useState<MinicardOrderEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMinicardOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/tasks/minicard-orders');
      const data = await response.json();
      if (data.success) {
        setEvents(data.data.events);
      } else {
        throw new Error(data.error || 'Failed to fetch minicard orders');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load minicard orders');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      fetchMinicardOrders();
    }
  }, [isActive, fetchMinicardOrders]);

  const handleMarkComplete = (event: MinicardOrderEvent) => {
    // Build a synthetic TaskWithEventDetails for the completion modal
    const syntheticTask: TaskWithEventDetails = {
      id: event.task_record_id,
      task_id: '',
      template_id: 'minicard',
      event_id: event.event_record_id,
      task_type: 'paper_order',
      task_name: 'Order Minicards',
      description: `Minicard order for ${event.school_name}`,
      completion_type: 'monetary',
      timeline_offset: 1,
      deadline: event.deadline,
      status: 'pending',
      created_at: '',
      school_name: event.school_name,
      event_date: event.event_date,
      urgency_score: event.is_overdue ? -1 : event.days_until_due,
      days_until_due: event.days_until_due,
      is_overdue: event.is_overdue,
    };
    onCompleteTask(syntheticTask);
  };

  // Group events by urgency
  const overdueEvents = events.filter((e) => e.days_until_due < 0);
  const approachingEvents = events.filter((e) => e.days_until_due >= 0 && e.days_until_due <= 3);
  const upcomingEvents = events.filter((e) => e.days_until_due > 3);

  if (isLoading) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Minicard Orders</h2>
        <p className="text-sm text-gray-500 mb-4">Aggregated minicard orders by event</p>
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
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Minicard Orders</h2>
        <p className="text-sm text-gray-500 mb-4">Aggregated minicard orders by event</p>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">Error: {error}</p>
          <button
            onClick={fetchMinicardOrders}
            className="mt-2 text-sm text-red-700 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Minicard Orders</h2>
        <p className="text-sm text-gray-500 mb-4">Aggregated minicard orders by event</p>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">🃏</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Pending Minicard Orders
          </h3>
          <p className="text-gray-600">
            Minicard orders will appear here when there are pending minicard tasks.
          </p>
        </div>
      </div>
    );
  }

  const renderSection = (
    title: string,
    sectionEvents: MinicardOrderEvent[],
    headerColor: string
  ) => {
    if (sectionEvents.length === 0) return null;
    return (
      <div className="mb-6">
        <h3 className={`text-sm font-semibold uppercase tracking-wide mb-3 ${headerColor}`}>
          {title}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sectionEvents.map((event) => (
            <MinicardOrderCard
              key={event.event_record_id}
              event={event}
              onMarkComplete={handleMarkComplete}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Minicard Orders</h2>
      <p className="text-sm text-gray-500 mb-4">Aggregated minicard orders by event</p>
      {renderSection('Overdue', overdueEvents, 'text-red-600')}
      {renderSection('Approaching', approachingEvents, 'text-orange-600')}
      {renderSection('Upcoming', upcomingEvents, 'text-gray-600')}
    </div>
  );
}
