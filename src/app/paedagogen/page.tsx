'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { TeacherEventView, Teacher } from '@/lib/types/teacher';
import type { MinimusikanRepresentative } from '@/lib/types/airtable';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { EditSchoolInfoModal } from '@/components/teacher/EditSchoolInfoModal';
import { RepresentativeContactModal } from '@/components/teacher/RepresentativeContactModal';
import PendingBookingsModal from '@/components/teacher/PendingBookingsModal';

// V2 Components
import {
  TopNav,
  HeroSection,
  SchoolInfoCard,
  ProjectSection,
  MusicianIntroSection,
  ContactSection,
  ResourcesSection,
  ShopAccessSection,
  TipsSection,
} from '@/components/teacher-v2';

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

  // Representative state
  const [representative, setRepresentative] = useState<MinimusikanRepresentative | null>(null);
  const [isRepLoading, setIsRepLoading] = useState(true);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  // Edit school info modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // School logo state
  const [schoolLogoUrl, setSchoolLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndFetchData();
    fetchRepresentative();
    fetchSchoolLogo();
  }, []);

  const checkAuthAndFetchData = async () => {
    try {
      const [eventsResponse, teacherResponse, bookingsResponse] = await Promise.all([
        fetch('/api/teacher/events'),
        fetch('/api/teacher/profile'),
        fetch('/api/teacher/bookings'),
      ]);

      if (eventsResponse.status === 401 || teacherResponse.status === 401) {
        router.push('/paedagogen-login');
        return;
      }

      if (!eventsResponse.ok) {
        throw new Error('Failed to fetch events');
      }

      const eventsData = await eventsResponse.json();
      setEvents(eventsData.events || []);

      if (teacherResponse.ok) {
        const teacherData = await teacherResponse.json();
        setTeacherInfo(teacherData.teacher || eventsData.teacher || null);
      } else {
        setTeacherInfo(eventsData.teacher || null);
      }

      if (bookingsResponse.ok) {
        const bookingsData = await bookingsResponse.json();
        const pendingSetup = bookingsData.pendingSetup || [];
        setPendingBookings(pendingSetup);
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

  const fetchRepresentative = async () => {
    try {
      const response = await fetch('/api/teacher/representative');
      const data = await response.json();
      if (response.ok) {
        setRepresentative(data.representative);
      }
    } catch (err) {
      console.error('Error fetching representative:', err);
    } finally {
      setIsRepLoading(false);
    }
  };

  const fetchSchoolLogo = async () => {
    try {
      const response = await fetch('/api/teacher/school/logo');
      const data = await response.json();
      if (response.ok && data.logoUrl) {
        setSchoolLogoUrl(data.logoUrl);
      }
    } catch (err) {
      console.error('Error fetching school logo:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/teacher-logout', { method: 'POST' });
      router.push('/paedagogen-login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleInfoUpdate = () => {
    setIsEditModalOpen(false);
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

  // Get discount code from first upcoming event's simplybook hash
  const discountCode = useMemo(() => {
    const upcomingEvent = events.find((e) => e.status === 'upcoming' || e.status === 'in-progress');
    return upcomingEvent?.simplybookHash;
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
      <div className="flex justify-center items-center h-screen bg-mm-bg-light">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-mm-bg-light p-6">
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
    <div className="min-h-screen bg-mm-bg-light">
      {/* Header */}
      <TopNav
        teacherName={teacherInfo?.name || ''}
        schoolName={teacherInfo?.schoolName || ''}
        onLogout={handleLogout}
      />

      {/* Main content */}
      <main>
        {/* Hero Section */}
        <HeroSection firstName={firstName} />

        {/* School Info Card Section */}
        <section className="bg-mm-bg-light py-8">
          <div className="max-w-[1100px] mx-auto px-6">
            <SchoolInfoCard
              schoolName={teacherInfo?.schoolName || ''}
              address={teacherInfo?.schoolAddress}
              email={teacherInfo?.email || ''}
              phone={teacherInfo?.schoolPhone}
              logoUrl={schoolLogoUrl || undefined}
              onEdit={() => setIsEditModalOpen(true)}
              onLogoUpload={(url) => setSchoolLogoUrl(url)}
            />
          </div>
        </section>

        {/* Project Section */}
        <ProjectSection
          events={events}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          currentEventIndex={currentEventIndex}
          onPrevEvent={handlePrevEvent}
          onNextEvent={handleNextEvent}
        />

        {/* Musician Intro Section */}
        <MusicianIntroSection
          representative={representative}
          isLoading={isRepLoading}
          onContactClick={() => setIsContactModalOpen(true)}
        />

        {/* Contact Section */}
        <ContactSection />

        {/* Resources Section */}
        <ResourcesSection
          eventDate={filteredEvents[currentEventIndex]?.eventDate}
          eventId={filteredEvents[currentEventIndex]?.eventId}
        />

        {/* Shop Access Section */}
        <ShopAccessSection discountCode={discountCode} />

        {/* Tips Section */}
        <TipsSection />
      </main>

      {/* Edit School Info Modal */}
      <EditSchoolInfoModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        currentAddress={teacherInfo?.schoolAddress}
        currentPhone={teacherInfo?.schoolPhone}
        onSuccess={handleInfoUpdate}
      />

      {/* Representative Contact Modal */}
      {representative && (
        <RepresentativeContactModal
          isOpen={isContactModalOpen}
          onClose={() => setIsContactModalOpen(false)}
          name={representative.name}
          email={representative.email}
          phone={representative.phone}
        />
      )}

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
