'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';

interface EventSelectionStepProps {
  schoolName: string;
  onEventSelect: (bookingId: string, eventDate: string, eventType: string) => void;
  onBack: () => void;
}

interface EventOption {
  bookingId: string;
  eventType: string;
  eventDate: string;
  classCount: number;
}

export default function EventSelectionStep({
  schoolName,
  onEventSelect,
  onBack,
}: EventSelectionStepProps) {
  const t = useTranslations('registration.eventSelection');
  const locale = useLocale();
  const [events, setEvents] = useState<EventOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch(
          `/api/airtable/school-events?school=${encodeURIComponent(schoolName)}`
        );
        const data = await response.json();

        if (data.success) {
          setEvents(data.data.events);
        } else {
          setError(data.error || 'Failed to fetch events');
        }
      } catch (err) {
        console.error('Error fetching events:', err);
        setError('Failed to load events. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvents();
  }, [schoolName]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const dateLocale = locale === 'de' ? 'de-DE' : 'en-GB';
    return date.toLocaleDateString(dateLocale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-md mx-auto text-center py-8">
        <div className="w-8 h-8 border-2 border-sage-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('title')}</h2>
        <p className="text-gray-600">
          {t('subtitle', { schoolName })}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {events.length === 0 ? (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <p className="text-gray-600">{t('noEvents')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <button
              key={event.bookingId}
              onClick={() =>
                onEventSelect(event.bookingId, event.eventDate, event.eventType)
              }
              className="w-full p-4 text-left bg-white border border-gray-200 rounded-lg hover:border-sage-500 hover:bg-sage-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-gray-900">
                    {event.eventType}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {formatDate(event.eventDate)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {t('classesParticipating', { count: event.classCount })}
                  </div>
                </div>
                <div className="text-sage-600">
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
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="mt-6">
        <button
          onClick={onBack}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          &larr; {t('backToSchoolSearch')}
        </button>
      </div>
    </div>
  );
}
