'use client';

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

export interface PendingBookingsModalProps {
  bookings: PendingBooking[];
  onClose: () => void;
}

export function PendingBookingsModal({ bookings, onClose }: PendingBookingsModalProps) {
  const router = useRouter();

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return 'Datum unbekannt';
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const handleSetupNow = () => {
    if (bookings.length > 0) {
      const firstBookingId = bookings[0].id;
      router.push(`/paedagogen/setup-booking/${firstBookingId}`);
    }
  };

  if (bookings.length === 0) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
          {/* Modal Header */}
          <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-pink-50 to-pink-100">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-pink-600 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-white"
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
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">
                  Buchungen einrichten
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Sie haben{' '}
                  <strong>
                    {bookings.length} {bookings.length === 1 ? 'Buchung' : 'Buchungen'}
                  </strong>
                  , die eingerichtet werden {bookings.length === 1 ? 'muss' : 'müssen'}
                </p>
              </div>
            </div>
          </div>

          {/* Modal Body */}
          <div className="px-6 py-4 max-h-[50vh] overflow-y-auto">
            <p className="text-sm text-gray-700 mb-4">
              Richten Sie Ihre Events ein, damit Eltern sich registrieren können.
              Fügen Sie Klassen hinzu und wählen Sie Lieder aus.
            </p>

            {/* Bookings List */}
            <div className="space-y-3">
              {bookings.map((booking, index) => (
                <div
                  key={booking.id}
                  className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-yellow-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
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
                        <span className="text-xs text-gray-600">
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
                          <span className="text-xs text-gray-600">
                            ~{booking.estimatedChildren} Kinder
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Später
            </button>
            <button
              onClick={handleSetupNow}
              className="flex-1 px-4 py-2.5 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition-colors flex items-center justify-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <span>Jetzt einrichten</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default PendingBookingsModal;
