'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { TeacherEventView, Teacher } from '@/lib/types/teacher';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import SchoolInfoCard from '@/components/teacher/SchoolInfoCard';
import ProjectDetailCard from '@/components/teacher/ProjectDetailCard';
import MinimusikanRepresentativeCard from '@/components/teacher/MinimusikanRepresentativeCard';
import SupportContactCard from '@/components/teacher/SupportContactCard';
import PreparationTipsSection from '@/components/teacher/PreparationTipsSection';
import PendingBookingsBadge from '@/components/teacher/PendingBookingsBadge';
import PendingBookingsModal from '@/components/teacher/PendingBookingsModal';

interface PendingBooking {
  id: string;
  simplybookId: string;
  schoolName: string;
  contactEmail: string;
  eventDate: string;
  estimatedChildren?: number;
  needsSetup: boolean;
}

export default function TeacherDashboard() {
  const router = useRouter();
  const [events, setEvents] = useState<TeacherEventView[]>([]);
  const [teacherInfo, setTeacherInfo] = useState<Teacher | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [showPendingModal, setShowPendingModal] = useState(false);

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  const checkAuthAndFetchData = async () => {
    try {
      // Fetch events, teacher info, and pending bookings
      const [eventsResponse, teacherResponse, bookingsResponse] = await Promise.all([
        fetch('/api/teacher/events'),
        fetch('/api/teacher/profile'),
        fetch('/api/teacher/bookings'),
      ]);

      if (eventsResponse.status === 401 || teacherResponse.status === 401) {
        router.push('/teacher-login');
        return;
      }

      if (!eventsResponse.ok) {
        throw new Error('Failed to fetch events');
      }

      const eventsData = await eventsResponse.json();
      setEvents(eventsData.events || []);

      // Get teacher info from profile endpoint if available, otherwise from events endpoint
      if (teacherResponse.ok) {
        const teacherData = await teacherResponse.json();
        setTeacherInfo(teacherData.teacher || eventsData.teacher || null);
      } else {
        setTeacherInfo(eventsData.teacher || null);
      }

      // Get pending bookings
      if (bookingsResponse.ok) {
        const bookingsData = await bookingsResponse.json();
        const pendingSetup = bookingsData.pendingSetup || [];
        setPendingBookings(pendingSetup);

        // Show modal if there are pending bookings on initial load
        if (pendingSetup.length > 0) {
          setShowPendingModal(true);
        }
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Daten');
    } finally {
      setIsLoading(false);
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

  const handleLogoChange = (url: string) => {
    // Logo changed, could refresh teacher info if needed
    console.log('Logo updated:', url);
  };

  const handleInfoUpdate = () => {
    // School info updated, refresh teacher data
    checkAuthAndFetchData();
  };

  // Filter events based on active filter
  const filteredEvents = useMemo(() => {
    if (activeFilter === 'all') return events;
    if (activeFilter === 'upcoming') {
      return events.filter((e) => e.status === 'upcoming' || e.status === 'in-progress');
    }
    return events.filter((e) => e.status === 'completed');
  }, [events, activeFilter]);

  // Get current event to display
  const currentEvent = filteredEvents[currentEventIndex];

  // Count stats for filter tabs
  const stats = useMemo(() => {
    const upcoming = events.filter(
      (e) => e.status === 'upcoming' || e.status === 'in-progress'
    ).length;
    const completed = events.filter((e) => e.status === 'completed').length;
    return { total: events.length, upcoming, completed };
  }, [events]);

  // Reset index when filter changes
  useEffect(() => {
    setCurrentEventIndex(0);
  }, [activeFilter]);

  // Navigation handlers
  const handlePrevEvent = () => {
    setCurrentEventIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextEvent = () => {
    setCurrentEventIndex((prev) => Math.min(filteredEvents.length - 1, prev + 1));
  };

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

  const firstName = teacherInfo?.name?.split(' ')[0] || 'Lehrer';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-start">
            {/* Logo/Brand - Left side */}
            <div>
              <h1 className="text-xl font-bold text-gray-900">MiniMusiker</h1>
              <p className="text-sm text-gray-500">Lehrer-Portal</p>
            </div>

            {/* Login Area - Right side */}
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">Login-Bereich</p>
              <div className="flex items-center gap-3">
                {/* Pending Bookings Badge */}
                <PendingBookingsBadge />

                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-pink-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-bold">
                    {firstName.charAt(0).toUpperCase()}
                  </span>
                </div>
                {/* Name */}
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">
                    {teacherInfo?.name} - {teacherInfo?.schoolName}
                  </p>
                  <button
                    onClick={handleLogout}
                    className="text-xs text-pink-600 hover:text-pink-700 transition-colors flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Abmelden
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Welcome Banner */}
        <div
          className="rounded-xl p-4 sm:p-6 mb-6 text-white"
          style={{
            background: 'linear-gradient(135deg, #E91E63 0%, #C2185B 100%)',
          }}
        >
          <h2 className="text-xl sm:text-2xl font-bold mb-2">Willkommen, {firstName}!</h2>
          <p className="text-white/90 text-xs sm:text-sm">
            Hier verwaltest du eure Projekte mit den Minimusikern. Bearbeite Termine und Daten oder
            übermittle Gruppen/Klassen und ihre Lieder an uns.
          </p>
        </div>

        {/* Single-column centered layout */}
        <div className="space-y-6">
          {/* School Info Card - Now at TOP */}
          {teacherInfo && (
            <SchoolInfoCard
              schoolName={teacherInfo.schoolName}
              address={teacherInfo.schoolAddress}
              email={teacherInfo.email}
              phone={teacherInfo.schoolPhone}
              logoUrl={null} // TODO: Get from teacher info
              onLogoChange={handleLogoChange}
              onInfoUpdate={handleInfoUpdate}
            />
          )}

          {/* Filter Tabs */}
          <div className="bg-gray-100 rounded-lg p-1 flex gap-1">
              <button
                onClick={() => setActiveFilter('all')}
                className={`flex-1 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  activeFilter === 'all'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="hidden sm:inline">Alle Projekte</span>
                <span className="sm:hidden">Alle</span> ({stats.total})
              </button>
              <button
                onClick={() => setActiveFilter('upcoming')}
                className={`flex-1 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  activeFilter === 'upcoming'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="hidden sm:inline">Bevorstehend</span>
                <span className="sm:hidden">Bald</span> ({stats.upcoming})
              </button>
              <button
                onClick={() => setActiveFilter('completed')}
                className={`flex-1 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  activeFilter === 'completed'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="hidden sm:inline">Abgeschlossen</span>
                <span className="sm:hidden">Fertig</span> ({stats.completed})
              </button>
          </div>

          {/* Project Navigation (if multiple projects) */}
          {filteredEvents.length > 1 && (
            <div className="flex items-center justify-between">
                <button
                  onClick={handlePrevEvent}
                  disabled={currentEventIndex === 0}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Vorheriges
                </button>
                <span className="text-sm text-gray-500">
                  {currentEventIndex + 1} von {filteredEvents.length}
                </span>
                <button
                  onClick={handleNextEvent}
                  disabled={currentEventIndex === filteredEvents.length - 1}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  Nächstes
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
              </button>
            </div>
          )}

          {/* Project Detail Card or Empty State */}
          {currentEvent ? (
            <ProjectDetailCard event={currentEvent} />
          ) : (
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
          )}

          {/* Minimusiker Representative Card */}
          <MinimusikanRepresentativeCard />

          {/* Support Contact Card */}
          <SupportContactCard />

          {/* Preparation Tips Section */}
          <PreparationTipsSection />
        </div>
      </main>

      {/* Pending Bookings Modal */}
      {showPendingModal && pendingBookings.length > 0 && (
        <PendingBookingsModal
          bookings={pendingBookings}
          onClose={() => setShowPendingModal(false)}
        />
      )}
    </div>
  );
}
