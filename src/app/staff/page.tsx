'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SchoolEventSummary } from '@/lib/types/airtable';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import SchoolEventCard from '@/components/admin/SchoolEventCard';
import EventStatusTabs, { EventStatus } from '@/components/admin/EventStatusTabs';
import EventSearchBar from '@/components/admin/EventSearchBar';
import EventDateFilter, { DateFilterOption } from '@/components/admin/EventDateFilter';

// Helper functions for date filtering (same as admin)
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

interface StaffInfo {
  email: string;
  name: string;
  personenId?: string;
}

export default function StaffPortal() {
  const router = useRouter();
  const [events, setEvents] = useState<SchoolEventSummary[]>([]);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [activeTab, setActiveTab] = useState<EventStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('all');

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  const checkAuthAndFetchData = async () => {
    try {
      // Check authentication and fetch events
      const response = await fetch('/api/staff/events');

      if (response.status === 401) {
        // Not authenticated, redirect to login
        router.push('/staff-login');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();
      setEvents(data.events || []);
      setStaffInfo(data.staff || null);
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/staff-logout', { method: 'POST' });
      router.push('/staff-login');
    } catch (err) {
      console.error('Logout error:', err);
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

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const isFiltered = activeTab !== 'all' || searchQuery.trim() || dateFilter !== 'all';

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">Error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#94B8B3]/10 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-[#5a8a82]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Staff Portal</h1>
                {staffInfo && (
                  <p className="text-sm text-gray-500">{staffInfo.name}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Your Events</h2>
          <p className="text-gray-600 mt-1">
            {isFiltered
              ? `Showing ${filteredEvents.length} of ${events.length} events`
              : `${events.length} assigned ${events.length === 1 ? 'event' : 'events'}`}
          </p>
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
              {isFiltered
                ? 'No matching events'
                : !staffInfo?.personenId
                ? 'Account not linked'
                : 'No events assigned to you yet'}
            </h3>
            <p className="text-gray-600 mb-4">
              {isFiltered
                ? 'Try adjusting your search or filters.'
                : !staffInfo?.personenId
                ? 'Your account is not linked to a staff record. Please contact an administrator to set this up.'
                : 'When you are assigned to events, they will appear here.'}
            </p>
            {isFiltered && (
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
            )}
          </div>
        ) : (
          /* Card Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => (
              <SchoolEventCard key={event.eventId} event={event} basePath="/staff/events" />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
