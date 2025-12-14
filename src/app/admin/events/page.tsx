'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SchoolEventSummary } from '@/lib/types/airtable';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import SchoolEventCard from '@/components/admin/SchoolEventCard';
import EventStatusTabs, { EventStatus } from '@/components/admin/EventStatusTabs';
import EventSearchBar from '@/components/admin/EventSearchBar';
import EventDateFilter, { DateFilterOption } from '@/components/admin/EventDateFilter';

// Helper functions for date filtering
function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function isThisWeek(dateStr: string): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= -3 && diffDays <= 3;
}

function isInDateRange(dateStr: string, filter: DateFilterOption): boolean {
  if (!dateStr || filter === 'all') return true;

  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (filter) {
    case 'this-week': {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return date >= weekStart && date <= weekEnd;
    }
    case 'this-month': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return date >= monthStart && date <= monthEnd;
    }
    case 'next-30-days': {
      const thirtyDaysLater = new Date(today);
      thirtyDaysLater.setDate(today.getDate() + 30);
      return date >= today && date <= thirtyDaysLater;
    }
    default:
      return true;
  }
}

function getEventStatus(dateStr: string): 'upcoming' | 'in-progress' | 'completed' {
  if (!dateStr) return 'upcoming';

  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isThisWeek(dateStr)) return 'in-progress';
  if (date > today) return 'upcoming';
  return 'completed';
}

export default function AdminEvents() {
  const router = useRouter();
  const [events, setEvents] = useState<SchoolEventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [activeTab, setActiveTab] = useState<EventStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('all');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/airtable/get-events');
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      const data = await response.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique school names for auto-suggest
  const schoolNames = useMemo(() => {
    const names = new Set(events.map((e) => e.schoolName).filter(Boolean));
    return Array.from(names).sort();
  }, [events]);

  // Calculate counts for each status
  const statusCounts = useMemo(() => {
    const counts = { all: events.length, upcoming: 0, inProgress: 0, completed: 0 };
    events.forEach((event) => {
      const status = getEventStatus(event.eventDate);
      if (status === 'upcoming') counts.upcoming++;
      else if (status === 'in-progress') counts.inProgress++;
      else counts.completed++;
    });
    return counts;
  }, [events]);

  // Filter events based on all criteria
  const filteredEvents = useMemo(() => {
    let result = events;

    // Tab filter (status)
    if (activeTab !== 'all') {
      result = result.filter((event) => {
        const status = getEventStatus(event.eventDate);
        if (activeTab === 'upcoming') return status === 'upcoming';
        if (activeTab === 'in-progress') return status === 'in-progress';
        if (activeTab === 'completed') return status === 'completed';
        return true;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      result = result.filter((event) =>
        event.schoolName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Date filter
    if (dateFilter !== 'all') {
      result = result.filter((event) => isInDateRange(event.eventDate, dateFilter));
    }

    return result;
  }, [events, activeTab, searchQuery, dateFilter]);

  const handleCreateEvent = () => {
    router.push('/admin/events/create');
  };

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const isFiltered = activeTab !== 'all' || searchQuery.trim() || dateFilter !== 'all';

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Events Management</h1>
          <p className="text-gray-600 mt-1">
            {isFiltered
              ? `Showing ${filteredEvents.length} of ${events.length} events`
              : `${events.length} school ${events.length === 1 ? 'event' : 'events'}`}
          </p>
        </div>
        <button
          onClick={handleCreateEvent}
          className="px-4 py-2 bg-[#94B8B3] text-white rounded-md hover:bg-[#7da39e] transition-colors"
        >
          Create New Event
        </button>
      </div>

      {/* Status Tabs */}
      <div className="mb-4">
        <EventStatusTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          counts={statusCounts}
        />
      </div>

      {/* Search and Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <EventSearchBar
          value={searchQuery}
          onChange={handleSearchChange}
          schoolNames={schoolNames}
        />
        <EventDateFilter value={dateFilter} onChange={setDateFilter} />
      </div>

      {/* Empty state */}
      {filteredEvents.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="text-4xl mb-4">{isFiltered ? '🔍' : '📅'}</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {isFiltered ? 'No matching events' : 'No events yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {isFiltered
              ? 'Try adjusting your search or filters.'
              : 'Get started by creating your first school event.'}
          </p>
          {isFiltered ? (
            <button
              onClick={() => {
                setActiveTab('all');
                setSearchQuery('');
                setDateFilter('all');
              }}
              className="px-4 py-2 text-[#5a8a82] border border-[#94B8B3] rounded-md hover:bg-[#94B8B3]/10 transition-colors"
            >
              Clear filters
            </button>
          ) : (
            <button
              onClick={handleCreateEvent}
              className="px-4 py-2 bg-[#94B8B3] text-white rounded-md hover:bg-[#7da39e] transition-colors"
            >
              Create New Event
            </button>
          )}
        </div>
      ) : (
        /* Card Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <SchoolEventCard key={event.eventId} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
