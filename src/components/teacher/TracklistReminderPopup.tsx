'use client';

import { useState, useEffect } from 'react';

interface TracklistReminderPopupProps {
  eventId: string;
  eventDate: string;
  tracklistFinalizedAt?: string;
  onOpenTracklistModal: () => void;
}

export default function TracklistReminderPopup({
  eventId,
  eventDate,
  tracklistFinalizedAt,
  onOpenTracklistModal,
}: TracklistReminderPopupProps) {
  const [dismissed, setDismissed] = useState(false);

  const sessionKey = `tracklist-reminder-dismissed-${eventId}`;

  // Check sessionStorage on mount
  useEffect(() => {
    const wasDismissed = sessionStorage.getItem(sessionKey);
    if (wasDismissed) {
      setDismissed(true);
    }
  }, [sessionKey]);

  const handleDismiss = () => {
    sessionStorage.setItem(sessionKey, 'true');
    setDismissed(true);
  };

  const handleOpenTracklist = () => {
    sessionStorage.setItem(sessionKey, 'true');
    setDismissed(true);
    onOpenTracklistModal();
  };

  // Show conditions:
  // 1. Event date is today or in the past (date-only comparison)
  // 2. tracklistFinalizedAt is null/undefined
  // 3. Not dismissed this session
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const event = new Date(eventDate);
  event.setHours(0, 0, 0, 0);
  const eventIsTodayOrPast = event <= today;

  const tracklistNotFinalized = !tracklistFinalizedAt;

  if (!eventIsTodayOrPast || !tracklistNotFinalized || dismissed) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex flex-col items-center text-center">
          {/* Warning icon */}
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>

          {/* Heading */}
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Lieder-Reihenfolge noch nicht bestätigt
          </h2>

          {/* Body text */}
          <p className="text-sm text-gray-600 mb-6">
            Dein Minimusikertag hat bereits stattgefunden, aber die
            Lieder-Reihenfolge wurde noch nicht finalisiert. Wir benötigen diese,
            um die CD-Booklets zu drucken. Bitte lege die Reihenfolge jetzt fest.
          </p>

          {/* Buttons */}
          <div className="flex gap-3 w-full">
            <button
              onClick={handleDismiss}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Später erinnern
            </button>
            <button
              onClick={handleOpenTracklist}
              className="flex-1 px-4 py-2.5 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition-colors"
            >
              Jetzt festlegen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
