'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import BookingsTable from '@/components/admin/bookings/BookingsTable';
import { BookingWithDetails, StaffOption, RegionOption } from '@/app/api/admin/bookings/route';

// Tier 1: Computed status (mutually exclusive)
type ComputedStatus = 'confirmed' | 'completed' | 'onHold';

// Tier 2: Event types for toggle buttons
type EventType = 'minimusikertag' | 'plus' | 'schulsong' | 'kita';

interface BookingsStats {
  total: number;
  confirmed: number;
  completed: number;
  onHold: number;
}

/**
 * Compute the display status of a booking based on event date and eventStatus
 * - On Hold: eventStatus === 'On Hold' (overrides date logic)
 * - Confirmed: event_date is future OR ≤15 days past
 * - Completed: event_date is >15 days past
 */
function getComputedStatus(booking: BookingWithDetails): ComputedStatus {
  // On Hold status overrides date-based logic
  if (booking.eventStatus === 'On Hold') {
    return 'onHold';
  }

  const eventDate = new Date(booking.bookingDate);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 15);

  return eventDate >= cutoff ? 'confirmed' : 'completed';
}

export default function AdminBookings() {
  // Data state
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [regionList, setRegionList] = useState<RegionOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tier 1: Status tab (mutually exclusive)
  const [statusFilter, setStatusFilter] = useState<ComputedStatus>('confirmed');

  // Tier 2: Event type toggles (multi-select, OR logic)
  const [activeTypes, setActiveTypes] = useState<Set<EventType>>(new Set());

  // Tier 3: Search filters
  const [staffFilter, setStaffFilter] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [monthFilter, setMonthFilter] = useState<string>(''); // 'YYYY-MM'
  const [childrenFilter, setChildrenFilter] = useState<string>('');

  // Text search (existing functionality)
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/bookings', {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch bookings');
      }

      const data = await response.json();

      if (data.success) {
        setBookings(data.data.bookings || []);
        setStaffList(data.data.staffList || []);
        setRegionList(data.data.regionList || []);
      } else {
        throw new Error(data.error || 'Failed to load bookings');
      }
    } catch (err) {
      console.error('Error fetching bookings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEventDeleted = useCallback((bookingId: string) => {
    setBookings(prev => prev.filter(b => b.id !== bookingId));
  }, []);

  // Toggle an event type filter
  const toggleEventType = (type: EventType) => {
    setActiveTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setActiveTypes(new Set());
    setStaffFilter('');
    setRegionFilter('');
    setMonthFilter('');
    setChildrenFilter('');
    setSearchQuery('');
  };

  // Calculate stats based on computed status
  const stats = useMemo((): BookingsStats => {
    return {
      total: bookings.length,
      confirmed: bookings.filter(b => getComputedStatus(b) === 'confirmed').length,
      completed: bookings.filter(b => getComputedStatus(b) === 'completed').length,
      onHold: bookings.filter(b => getComputedStatus(b) === 'onHold').length,
    };
  }, [bookings]);

  // Apply all filter tiers
  const filteredBookings = useMemo(() => {
    let filtered = bookings;

    // TIER 1: Filter by computed status
    filtered = filtered.filter(b => getComputedStatus(b) === statusFilter);

    // TIER 2: Filter by event type (OR logic - show if matches ANY selected type)
    if (activeTypes.size > 0) {
      filtered = filtered.filter(b =>
        (activeTypes.has('minimusikertag') && b.isMinimusikertag) ||
        (activeTypes.has('plus') && b.isPlus) ||
        (activeTypes.has('schulsong') && b.isSchulsong) ||
        (activeTypes.has('kita') && b.isKita)
      );
    }

    // TIER 3: Search filters (AND logic between each filter)

    // Staff filter
    if (staffFilter) {
      filtered = filtered.filter(b =>
        b.assignedStaff?.includes(staffFilter)
      );
    }

    // Region filter
    if (regionFilter) {
      filtered = filtered.filter(b => b.regionId === regionFilter);
    }

    // Month filter
    if (monthFilter) {
      filtered = filtered.filter(b =>
        b.bookingDate.startsWith(monthFilter)
      );
    }

    // Children count filter (±50)
    const childrenCount = parseInt(childrenFilter, 10);
    if (!isNaN(childrenCount)) {
      filtered = filtered.filter(b =>
        Math.abs((b.numberOfChildren || 0) - childrenCount) <= 50
      );
    }

    // Text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.schoolName?.toLowerCase().includes(query) ||
          b.contactPerson?.toLowerCase().includes(query) ||
          b.contactEmail?.toLowerCase().includes(query) ||
          b.code?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [bookings, statusFilter, activeTypes, staffFilter, regionFilter, monthFilter, childrenFilter, searchQuery]);

  // Check if any filters are active (beyond status tab)
  const hasActiveFilters = activeTypes.size > 0 || staffFilter || regionFilter || monthFilter || childrenFilter || searchQuery;

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
        <button
          onClick={fetchBookings}
          className="mt-2 text-sm text-red-700 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Bookings Overview</h1>
        <button
          onClick={fetchBookings}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      {/* Filter Panel */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 space-y-4">

        {/* TIER 1: Status Tabs */}
        <div className="flex flex-wrap gap-2">
          {(['confirmed', 'completed', 'onHold'] as ComputedStatus[]).map((status) => {
            const labels: Record<ComputedStatus, string> = {
              confirmed: 'Confirmed',
              completed: 'Completed',
              onHold: 'On Hold',
            };
            const counts: Record<ComputedStatus, number> = {
              confirmed: stats.confirmed,
              completed: stats.completed,
              onHold: stats.onHold,
            };

            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {labels[status]}
                <span className="ml-1 text-xs opacity-75">
                  ({counts[status]})
                </span>
              </button>
            );
          })}
        </div>

        {/* TIER 2: Event Type Toggles */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-500 py-2 pr-2">Event Type:</span>
          <button
            onClick={() => toggleEventType('minimusikertag')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              activeTypes.has('minimusikertag')
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Minimusikertag
          </button>
          <button
            onClick={() => toggleEventType('plus')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              activeTypes.has('plus')
                ? 'bg-violet-500 text-white border-violet-500'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Plus
          </button>
          <button
            onClick={() => toggleEventType('schulsong')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              activeTypes.has('schulsong')
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Schulsong
          </button>
          <button
            onClick={() => toggleEventType('kita')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              activeTypes.has('kita')
                ? 'bg-violet-500 text-white border-violet-500'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            KiTa
          </button>
        </div>

        {/* TIER 3: Search Dropdowns */}
        <div className="flex flex-wrap gap-3">
          {/* Staff dropdown */}
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Staff</option>
            {staffList.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name}
              </option>
            ))}
          </select>

          {/* Region dropdown */}
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Regions</option>
            {regionList.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>

          {/* Month picker */}
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Month"
          />

          {/* Children count */}
          <div className="relative">
            <input
              type="number"
              value={childrenFilter}
              onChange={(e) => setChildrenFilter(e.target.value)}
              placeholder="Children (±50)"
              className="w-36 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Text search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <input
                type="text"
                placeholder="Search school, contact, code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Results Count */}
      {hasActiveFilters && (
        <p className="text-sm text-gray-600 mb-4">
          Showing {filteredBookings.length} of {stats[statusFilter]} {statusFilter} bookings
        </p>
      )}

      {/* Bookings Table */}
      <BookingsTable
        bookings={filteredBookings}
        onEventDeleted={handleEventDeleted}
        getComputedStatus={getComputedStatus}
      />
    </div>
  );
}
