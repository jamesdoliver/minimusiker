'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';

interface ClassOption {
  classId: string;
  className: string;
  teacherName: string;
  registeredCount: number;
  isDefault: boolean;
}

interface EventSelectionStepProps {
  schoolName: string;
  onEventSelect: (
    bookingId: string,
    eventDate: string,
    eventType: string,
    classId?: string,
    className?: string
  ) => void;
  onBack: () => void;
}

interface EventOption {
  bookingId: string;
  eventType: string;
  eventDate: string;
  classCount: number;
  classes: ClassOption[];
}

export default function EventSelectionStep({
  schoolName,
  onEventSelect,
  onBack,
}: EventSelectionStepProps) {
  const t = useTranslations('registration.eventSelection');
  const tClass = useTranslations('registration.classSelection');
  const locale = useLocale();
  const [events, setEvents] = useState<EventOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

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

  const handleEventClick = (event: EventOption) => {
    // Toggle expansion
    if (expandedEventId === event.bookingId) {
      setExpandedEventId(null);
    } else {
      setExpandedEventId(event.bookingId);
    }
  };

  const handleClassClick = (
    event: EventOption,
    classOption: ClassOption,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    onEventSelect(
      event.bookingId,
      event.eventDate,
      event.eventType,
      classOption.classId,
      classOption.className
    );
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
        <p className="text-gray-600">{t('subtitle', { schoolName })}</p>
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
          {events.map((event) => {
            const isExpanded = expandedEventId === event.bookingId;

            return (
              <div
                key={event.bookingId}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden transition-all"
              >
                {/* Event Header (clickable to expand/collapse) */}
                <button
                  onClick={() => handleEventClick(event)}
                  className={`w-full p-4 text-left hover:bg-sage-50 transition-colors ${
                    isExpanded ? 'border-b border-gray-200' : ''
                  }`}
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
                    <div
                      className={`text-sage-600 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
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
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Expanded Class List */}
                <div
                  className={`transition-all duration-200 ease-in-out overflow-hidden ${
                    isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="max-h-64 overflow-y-auto">
                    <div className="p-2 space-y-2">
                      {event.classes.map((classOption) => (
                        <button
                          key={classOption.classId}
                          onClick={(e) => handleClassClick(event, classOption, e)}
                          className={`w-full p-3 text-left rounded-lg border transition-colors ${
                            classOption.isDefault
                              ? 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
                              : 'border-gray-200 bg-white hover:border-sage-500 hover:bg-sage-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div
                                className={`font-medium truncate ${
                                  classOption.isDefault
                                    ? 'text-gray-700'
                                    : 'text-gray-900'
                                }`}
                              >
                                {classOption.className}
                              </div>
                              {classOption.teacherName && !classOption.isDefault && (
                                <div className="text-xs text-gray-500 mt-0.5 truncate">
                                  {tClass('teacher', {
                                    teacherName: classOption.teacherName,
                                  })}
                                </div>
                              )}
                              {classOption.isDefault && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                  (Sammelklasse)
                                </div>
                              )}
                              <div className="text-xs text-gray-400 mt-0.5">
                                {tClass('parentsRegistered', {
                                  count: classOption.registeredCount,
                                })}
                              </div>
                            </div>
                            <div className="text-sage-600 ml-2 flex-shrink-0">
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
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
