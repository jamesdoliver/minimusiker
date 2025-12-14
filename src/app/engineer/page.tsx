'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { EngineerEventSummary, EngineerMixingStatus } from '@/lib/types/engineer';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface EngineerInfo {
  email: string;
  name: string;
}

type StatusFilter = 'all' | 'pending' | 'in-progress' | 'completed';

function getMixingStatusBadge(status: EngineerMixingStatus) {
  switch (status) {
    case 'pending':
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
          Pending
        </span>
      );
    case 'in-progress':
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
          In Progress
        </span>
      );
    case 'completed':
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
          Completed
        </span>
      );
    default:
      return null;
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'No date';
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function EngineerPortal() {
  const router = useRouter();
  const [events, setEvents] = useState<EngineerEventSummary[]>([]);
  const [engineerInfo, setEngineerInfo] = useState<EngineerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  const checkAuthAndFetchData = async () => {
    try {
      const response = await fetch('/api/engineer/events');

      if (response.status === 401) {
        router.push('/engineer-login');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();
      setEvents(data.events || []);

      // Get engineer info from a separate endpoint or cookie
      // For now we'll just use placeholder
      setEngineerInfo({ email: '', name: 'Engineer' });
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/engineer-logout', { method: 'POST' });
      router.push('/engineer-login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Calculate status counts
  const statusCounts = useMemo(() => {
    const counts = { all: events.length, pending: 0, 'in-progress': 0, completed: 0 };
    events.forEach((event) => {
      counts[event.mixingStatus]++;
    });
    return counts;
  }, [events]);

  // Filter events
  const filteredEvents = useMemo(() => {
    let result = events;

    if (statusFilter !== 'all') {
      result = result.filter((event) => event.mixingStatus === statusFilter);
    }

    if (searchQuery.trim()) {
      result = result.filter((event) =>
        event.schoolName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return result;
  }, [events, statusFilter, searchQuery]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

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
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Engineer Portal</h1>
                <p className="text-sm text-gray-500">Audio Mixing Dashboard</p>
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
          <h2 className="text-2xl font-bold text-gray-900">Assigned Projects</h2>
          <p className="text-gray-600 mt-1">
            {filteredEvents.length === events.length
              ? `${events.length} ${events.length === 1 ? 'project' : 'projects'} to mix`
              : `Showing ${filteredEvents.length} of ${events.length} projects`}
          </p>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {(['all', 'pending', 'in-progress', 'completed'] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                statusFilter === status
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {status === 'all'
                ? 'All'
                : status === 'in-progress'
                ? 'In Progress'
                : status.charAt(0).toUpperCase() + status.slice(1)}
              <span className="ml-2 text-xs opacity-75">
                ({statusCounts[status]})
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search by school name..."
            className="w-full max-w-md px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
          />
        </div>

        {/* Event cards */}
        {filteredEvents.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="text-4xl mb-4">
              {statusFilter !== 'all' || searchQuery ? '🔍' : '🎵'}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {statusFilter !== 'all' || searchQuery
                ? 'No matching projects'
                : 'No projects assigned yet'}
            </h3>
            <p className="text-gray-600 mb-4">
              {statusFilter !== 'all' || searchQuery
                ? 'Try adjusting your search or filters.'
                : 'When you are assigned to mixing projects, they will appear here.'}
            </p>
            {(statusFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-purple-600 border border-purple-300 rounded-md hover:bg-purple-50 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => (
              <Link
                key={event.eventId}
                href={`/engineer/events/${encodeURIComponent(event.eventId)}`}
                className="block bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-purple-200 transition-all p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {event.schoolName}
                    </h3>
                    <p className="text-sm text-gray-500">{formatDate(event.eventDate)}</p>
                  </div>
                  {getMixingStatusBadge(event.mixingStatus)}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Event Type</span>
                    <span className="text-gray-900 capitalize">{event.eventType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Classes</span>
                    <span className="text-gray-900">{event.classCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Raw Files</span>
                    <span className="text-gray-900">{event.rawAudioCount}</span>
                  </div>
                </div>

                {/* Audio status indicators */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex gap-3">
                  <div
                    className={`flex items-center gap-1.5 text-xs ${
                      event.hasPreview ? 'text-green-600' : 'text-gray-400'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        event.hasPreview ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                    Preview
                  </div>
                  <div
                    className={`flex items-center gap-1.5 text-xs ${
                      event.hasFinal ? 'text-green-600' : 'text-gray-400'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        event.hasFinal ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    />
                    Final
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
