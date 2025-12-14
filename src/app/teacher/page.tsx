'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TeacherEventView } from '@/lib/types/teacher';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import SchoolLogoUploader from '@/components/teacher/SchoolLogoUploader';

interface TeacherInfo {
  email: string;
  name: string;
  schoolName: string;
}

// Pending booking from SchoolBookings table
interface PendingBooking {
  id: string;
  simplybookId: string;
  schoolName: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  postalCode?: string;
  estimatedChildren?: number;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  portalStatus: 'pending_setup' | 'classes_added' | 'ready' | null;
  needsSetup: boolean;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'Datum unbekannt';
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getStatusBadge(status: 'upcoming' | 'in-progress' | 'completed') {
  switch (status) {
    case 'upcoming':
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
          Bevorstehend
        </span>
      );
    case 'in-progress':
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
          Diese Woche
        </span>
      );
    case 'completed':
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
          Abgeschlossen
        </span>
      );
  }
}

function PendingBookingCard({
  booking,
  onSetup
}: {
  booking: PendingBooking;
  onSetup: (bookingId: string) => void;
}) {
  const [isSettingUp, setIsSettingUp] = useState(false);

  const handleSetup = async () => {
    setIsSettingUp(true);
    await onSetup(booking.id);
    setIsSettingUp(false);
  };

  return (
    <div className="bg-white rounded-xl border-2 border-dashed border-yellow-300 shadow-sm overflow-hidden">
      {/* Card Header with warning indicator */}
      <div className="p-5 border-b border-gray-100 bg-yellow-50">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-gray-900 text-lg">{booking.schoolName}</h3>
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
            Einrichtung erforderlich
          </span>
        </div>
        <p className="text-sm text-gray-600">{formatDate(booking.eventDate)}</p>
        {booking.startTime && (
          <p className="text-sm text-gray-500 mt-1">
            {booking.startTime.slice(0, 5)} - {booking.endTime?.slice(0, 5) || ''}
          </p>
        )}
      </div>

      {/* Card Body */}
      <div className="p-5">
        {/* Booking Info */}
        <div className="space-y-2 text-sm text-gray-600">
          {booking.estimatedChildren && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m9 5.197v1" />
              </svg>
              <span>~{booking.estimatedChildren} Kinder erwartet</span>
            </div>
          )}
          {booking.address && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">{booking.address}</span>
            </div>
          )}
        </div>

        {/* Setup Instructions */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Nächster Schritt:</strong> Klassen hinzufügen, damit Eltern sich registrieren können.
          </p>
        </div>
      </div>

      {/* Card Footer */}
      <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
        <button
          onClick={handleSetup}
          disabled={isSettingUp}
          className="w-full px-4 py-2 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSettingUp ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Wird eingerichtet...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Event einrichten</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function TeacherEventCard({ event }: { event: TeacherEventView }) {
  const totalSongs = event.classes.reduce((sum, cls) => sum + cls.songs.length, 0);
  const hasAudio = event.classes.some(
    (cls) => cls.audioStatus.hasPreview || cls.audioStatus.hasFinal
  );

  return (
    <Link
      href={`/teacher/events/${event.eventId}`}
      className="block bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-pink-200 transition-all duration-200 overflow-hidden"
    >
      {/* Card Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-gray-900 text-lg">{event.schoolName}</h3>
          {getStatusBadge(event.status)}
        </div>
        <p className="text-sm text-gray-600">{formatDate(event.eventDate)}</p>
        {event.eventType && (
          <p className="text-sm text-gray-500 mt-1">{event.eventType}</p>
        )}
      </div>

      {/* Card Body */}
      <div className="p-5">
        {/* Classes Summary */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <span className="text-gray-600">
              {event.classes.length} {event.classes.length === 1 ? 'Klasse' : 'Klassen'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-gray-400"
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
            <span className="text-gray-600">
              {totalSongs} {totalSongs === 1 ? 'Lied' : 'Lieder'}
            </span>
          </div>
        </div>

        {/* Audio Status */}
        {hasAudio && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 0112.728 0"
              />
            </svg>
            <span>Audio verfügbar</span>
          </div>
        )}

        {/* Classes List Preview */}
        {event.classes.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Klassen:</p>
            <div className="flex flex-wrap gap-2">
              {event.classes.slice(0, 3).map((cls) => (
                <span
                  key={cls.classId}
                  className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                >
                  {cls.className}
                </span>
              ))}
              {event.classes.length > 3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs">
                  +{event.classes.length - 3} weitere
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
        <span className="text-sm text-pink-600 font-medium flex items-center gap-1">
          Details anzeigen
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </span>
      </div>
    </Link>
  );
}

export default function TeacherDashboard() {
  const router = useRouter();
  const [events, setEvents] = useState<TeacherEventView[]>([]);
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  const checkAuthAndFetchData = async () => {
    try {
      // Fetch events, bookings, and logo in parallel
      const [eventsResponse, bookingsResponse, logoResponse] = await Promise.all([
        fetch('/api/teacher/events'),
        fetch('/api/teacher/bookings'),
        fetch('/api/teacher/school/logo'),
      ]);

      if (eventsResponse.status === 401 || bookingsResponse.status === 401) {
        router.push('/teacher-login');
        return;
      }

      if (!eventsResponse.ok) {
        throw new Error('Failed to fetch events');
      }

      const eventsData = await eventsResponse.json();
      setEvents(eventsData.events || []);
      setTeacherInfo(eventsData.teacher || null);

      // Process bookings data
      if (bookingsResponse.ok) {
        const bookingsData = await bookingsResponse.json();
        // Only show bookings that need setup (not already in events)
        const pending = (bookingsData.pendingSetup || []) as PendingBooking[];
        setPendingBookings(pending);
      }

      // Process logo data
      if (logoResponse.ok) {
        const logoData = await logoResponse.json();
        setSchoolLogo(logoData.logoUrl || null);
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Daten');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupBooking = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/teacher/bookings/${bookingId}/setup`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to setup booking');
      }

      const data = await response.json();

      // Navigate to the event detail page to add classes
      router.push(`/teacher/events/${data.eventId}`);
    } catch (err) {
      console.error('Setup error:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Einrichten des Events');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/teacher-logout', { method: 'POST' });
      router.push('/teacher-login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Filter events
  const filteredEvents = useMemo(() => {
    if (activeFilter === 'all') return events;
    if (activeFilter === 'upcoming') {
      return events.filter((e) => e.status === 'upcoming' || e.status === 'in-progress');
    }
    return events.filter((e) => e.status === 'completed');
  }, [events, activeFilter]);

  // Count stats
  const stats = useMemo(() => {
    const upcoming = events.filter(
      (e) => e.status === 'upcoming' || e.status === 'in-progress'
    ).length;
    const completed = events.filter((e) => e.status === 'completed').length;
    return { total: events.length, upcoming, completed };
  }, [events]);

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
            <p className="text-red-600">Fehler: {error}</p>
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
              <SchoolLogoUploader
                currentLogoUrl={schoolLogo}
                schoolName={teacherInfo?.schoolName || 'Schule'}
                onUploadSuccess={(logoUrl) => setSchoolLogo(logoUrl || null)}
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Lehrer-Portal</h1>
                {teacherInfo && (
                  <p className="text-sm text-gray-500">
                    {teacherInfo.name} - {teacherInfo.schoolName}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-pink-500 to-pink-600 rounded-xl p-6 mb-6 text-white">
          <h2 className="text-2xl font-bold mb-2">
            Willkommen, {teacherInfo?.name?.split(' ')[0] || 'Lehrer'}!
          </h2>
          <p className="text-pink-100">
            Verwalten Sie hier Ihre MiniMusiker Events, Klassen und Lieder.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-blue-600"
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
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-sm text-gray-500">Gesamt Events</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.upcoming}</p>
                <p className="text-sm text-gray-500">Bevorstehend</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
                <p className="text-sm text-gray-500">Abgeschlossen</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Bookings Section */}
        {pendingBookings.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              <h2 className="text-lg font-semibold text-gray-900">
                Neue Buchungen einrichten ({pendingBookings.length})
              </h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Diese Events wurden über SimplyBook gebucht und müssen noch eingerichtet werden.
              Fügen Sie Klassen hinzu, damit Eltern sich registrieren können.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingBookings.map((booking) => (
                <PendingBookingCard
                  key={booking.id}
                  booking={booking}
                  onSetup={handleSetupBooking}
                />
              ))}
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeFilter === 'all'
                ? 'bg-pink-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Alle ({stats.total})
          </button>
          <button
            onClick={() => setActiveFilter('upcoming')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeFilter === 'upcoming'
                ? 'bg-pink-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Bevorstehend ({stats.upcoming})
          </button>
          <button
            onClick={() => setActiveFilter('completed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeFilter === 'completed'
                ? 'bg-pink-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Abgeschlossen ({stats.completed})
          </button>
        </div>

        {/* Events List */}
        {filteredEvents.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="text-4xl mb-4">📅</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {activeFilter === 'all'
                ? 'Noch keine Events'
                : activeFilter === 'upcoming'
                ? 'Keine bevorstehenden Events'
                : 'Keine abgeschlossenen Events'}
            </h3>
            <p className="text-gray-600 mb-4">
              {activeFilter === 'all'
                ? 'Sobald Sie ein Event über SimplyBook buchen, erscheint es hier.'
                : 'Wechseln Sie den Filter, um andere Events zu sehen.'}
            </p>
            {activeFilter !== 'all' && (
              <button
                onClick={() => setActiveFilter('all')}
                className="px-4 py-2 text-pink-600 border border-pink-200 rounded-lg hover:bg-pink-50 transition-colors"
              >
                Alle Events anzeigen
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => (
              <TeacherEventCard key={event.eventId} event={event} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
