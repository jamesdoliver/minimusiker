'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface PendingBooking {
  id: string;
  simplybookId: string;
  schoolName: string;
  contactEmail: string;
  eventDate: string;
  estimatedChildren?: number;
  needsSetup: boolean;
}

export function PendingBookingsBadge() {
  const router = useRouter();
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPendingBookings();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const fetchPendingBookings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/teacher/bookings');

      if (response.ok) {
        const data = await response.json();
        setPendingBookings(data.pendingSetup || []);
      }
    } catch (err) {
      console.error('Error fetching pending bookings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return 'Datum unbekannt';
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const handleSetupClick = (bookingId: string) => {
    setIsDropdownOpen(false);
    router.push(`/paedagogen/setup-booking/${bookingId}`);
  };

  // Don't render anything if no pending bookings
  if (isLoading || pendingBookings.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Badge Button */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label={`${pendingBookings.length} ausstehende Buchungen`}
      >
        {/* Bell Icon */}
        <svg
          className="w-6 h-6 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Red Badge with Count */}
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
          {pendingBookings.length}
        </span>
      </button>

      {/* Dropdown */}
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Dropdown Header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              Ausstehende Buchungen ({pendingBookings.length})
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Diese Events müssen eingerichtet werden
            </p>
          </div>

          {/* Dropdown Body */}
          <div className="max-h-96 overflow-y-auto">
            {pendingBookings.map((booking) => (
              <div
                key={booking.id}
                className="px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {booking.schoolName}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <svg
                        className="w-4 h-4 text-gray-400 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span className="text-xs text-gray-500">
                        {formatDate(booking.eventDate)}
                      </span>
                    </div>
                    {booking.estimatedChildren && (
                      <div className="flex items-center gap-2 mt-1">
                        <svg
                          className="w-4 h-4 text-gray-400 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m9 5.197v1"
                          />
                        </svg>
                        <span className="text-xs text-gray-500">
                          ~{booking.estimatedChildren} Kinder
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Setup Button */}
                  <button
                    onClick={() => handleSetupClick(booking.id)}
                    className="px-3 py-1.5 bg-pink-600 text-white text-xs font-medium rounded-lg hover:bg-pink-700 transition-colors flex-shrink-0"
                  >
                    Einrichten
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Dropdown Footer */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
            <button
              onClick={() => setIsDropdownOpen(false)}
              className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PendingBookingsBadge;
