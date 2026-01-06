'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface BookingSetupData {
  id: string;
  simplybookId: string;
  schoolName: string;
  contactEmail: string;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  estimatedChildren?: number;
  portalStatus: string;
  isSetup: boolean;
}

interface ClassData {
  classId: string;
  className: string;
  teacherName: string;
  registeredCount: number;
}

export default function SetupBookingPage({ params }: { params: { bookingId: string } }) {
  const router = useRouter();
  const [booking, setBooking] = useState<BookingSetupData | null>(null);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);

  // Form state for adding classes
  const [className, setClassName] = useState('');
  const [numChildren, setNumChildren] = useState('');
  const [isAddingClass, setIsAddingClass] = useState(false);

  useEffect(() => {
    fetchBookingData();
  }, [params.bookingId]);

  const fetchBookingData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/teacher/bookings/${params.bookingId}/setup`);

      if (response.status === 401) {
        router.push('/teacher-login');
        return;
      }

      if (!response.ok) {
        throw new Error('Buchung konnte nicht geladen werden');
      }

      const data = await response.json();
      setBooking(data.booking);
      setClasses(data.classes || []);

      // If already setup, we have the eventId (simplybookId)
      if (data.booking.isSetup) {
        setEventId(data.booking.simplybookId);
      }
    } catch (err) {
      console.error('Error fetching booking:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Buchung');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitializeEvent = async () => {
    if (!booking) return;

    try {
      setIsInitializing(true);
      setError(null);

      const response = await fetch(`/api/teacher/bookings/${params.bookingId}/setup`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Event konnte nicht initialisiert werden');
      }

      const data = await response.json();
      setEventId(data.eventId);

      // Refresh booking data to show updated status
      await fetchBookingData();
    } catch (err) {
      console.error('Error initializing event:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Initialisieren des Events');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!className.trim() || !eventId) return;

    try {
      setIsAddingClass(true);
      setError(null);

      const response = await fetch(`/api/teacher/events/${eventId}/classes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          className: className.trim(),
          numChildren: numChildren ? parseInt(numChildren, 10) : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Klasse konnte nicht hinzugefügt werden');
      }

      // Clear form
      setClassName('');
      setNumChildren('');

      // Refresh booking data to show new class
      await fetchBookingData();
    } catch (err) {
      console.error('Error adding class:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Hinzufügen der Klasse');
    } finally {
      setIsAddingClass(false);
    }
  };

  const handleFinish = () => {
    if (eventId) {
      router.push(`/teacher/events/${eventId}`);
    }
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return 'Datum unbekannt';
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">Fehler: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-700">Buchung nicht gefunden</p>
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
            <div>
              <h1 className="text-xl font-bold text-gray-900">Event einrichten</h1>
              <p className="text-sm text-gray-500">Buchung konfigurieren</p>
            </div>
            <button
              onClick={() => router.push('/teacher')}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Zurück zum Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Booking Details Card */}
        <div className="bg-white rounded-xl border-2 border-dashed border-yellow-300 shadow-sm overflow-hidden mb-6">
          {/* Card Header */}
          <div className="p-6 border-b border-gray-100 bg-yellow-50">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-semibold text-gray-900">{booking.schoolName}</h2>
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                {booking.isSetup ? 'In Bearbeitung' : 'Einrichtung erforderlich'}
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
          <div className="p-6">
            {/* Booking Info */}
            <div className="space-y-3 text-sm text-gray-600">
              {booking.estimatedChildren && (
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m9 5.197v1" />
                  </svg>
                  <span>~{booking.estimatedChildren} Kinder erwartet</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>{booking.contactEmail}</span>
              </div>
            </div>

            {/* Instructions */}
            {!booking.isSetup && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">Nächster Schritt:</h3>
                <p className="text-sm text-blue-700">
                  Klicken Sie auf "Event initialisieren", um mit der Einrichtung zu beginnen.
                  Danach können Sie Klassen hinzufügen, damit Eltern sich registrieren können.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Initialize Event Button */}
        {!booking.isSetup && (
          <div className="mb-6">
            <button
              onClick={handleInitializeEvent}
              disabled={isInitializing}
              className="w-full px-6 py-3 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isInitializing ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Wird initialisiert...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Event initialisieren</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Add Classes Section (only shown after initialization) */}
        {booking.isSetup && eventId && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">Klassen hinzufügen</h3>
              <p className="text-sm text-gray-600 mt-1">
                Fügen Sie die Klassen/Gruppen hinzu, die am Event teilnehmen werden.
              </p>
            </div>

            <div className="p-6">
              {/* Add Class Form */}
              <form onSubmit={handleAddClass} className="space-y-4">
                <div>
                  <label htmlFor="className" className="block text-sm font-medium text-gray-700 mb-1">
                    Klassenname <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="className"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="z.B. Klasse 1a, Vorschule, etc."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="numChildren" className="block text-sm font-medium text-gray-700 mb-1">
                    Anzahl Kinder (optional)
                  </label>
                  <input
                    type="number"
                    id="numChildren"
                    value={numChildren}
                    onChange={(e) => setNumChildren(e.target.value)}
                    placeholder="z.B. 25"
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAddingClass || !className.trim()}
                  className="w-full px-6 py-3 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isAddingClass ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Wird hinzugefügt...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span>Klasse hinzufügen</span>
                    </>
                  )}
                </button>
              </form>

              {/* Classes List */}
              {classes.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">
                    Hinzugefügte Klassen ({classes.length})
                  </h4>
                  <div className="space-y-2">
                    {classes.map((cls) => (
                      <div
                        key={cls.classId}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{cls.className}</p>
                            {cls.registeredCount > 0 && (
                              <p className="text-xs text-gray-500">
                                {cls.registeredCount} Kinder registriert
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Finish Button */}
              {classes.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={handleFinish}
                    className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span>Fertig - Zur Liederliste</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
