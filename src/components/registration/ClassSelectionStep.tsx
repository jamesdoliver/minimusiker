'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';

interface ClassSelectionStepProps {
  bookingId: string;
  schoolName: string;
  eventDate: string;
  eventType: string;
  onClassSelect: (classId: string, className: string) => void;
  onBack?: () => void;
}

interface ClassOption {
  classId: string;
  className: string;
  teacherName: string;
  registeredCount: number;
}

export default function ClassSelectionStep({
  bookingId,
  schoolName,
  eventDate,
  eventType,
  onClassSelect,
  onBack,
}: ClassSelectionStepProps) {
  const t = useTranslations('registration.classSelection');
  const locale = useLocale();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const response = await fetch(
          `/api/airtable/school-events?bookingId=${encodeURIComponent(bookingId)}`
        );
        const data = await response.json();

        if (data.success) {
          setClasses(data.data.classes);
        } else {
          setError(data.error || 'Failed to fetch classes');
        }
      } catch (err) {
        console.error('Error fetching classes:', err);
        setError('Failed to load classes. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchClasses();
  }, [bookingId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const dateLocale = locale === 'de' ? 'de-DE' : 'en-GB';
    return date.toLocaleDateString(dateLocale, {
      weekday: 'long',
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
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('title')}</h2>
        <div className="text-sm text-gray-600 space-y-1">
          <p>
            <strong>{schoolName}</strong>
          </p>
          <p>
            {eventType} - {formatDate(eventDate)}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {classes.length === 0 ? (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <p className="text-gray-600">{t('noClasses')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map((classItem) => (
            <button
              key={classItem.classId}
              onClick={() => onClassSelect(classItem.classId, classItem.className)}
              className="w-full p-4 text-left bg-white border border-gray-200 rounded-lg hover:border-sage-500 hover:bg-sage-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-gray-900">
                    {classItem.className}
                  </div>
                  {classItem.teacherName && (
                    <div className="text-sm text-gray-600 mt-1">
                      {t('teacher', { teacherName: classItem.teacherName })}
                    </div>
                  )}
                  {classItem.registeredCount > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      {t('parentsRegistered', { count: classItem.registeredCount })}
                    </div>
                  )}
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

      {onBack && (
        <div className="mt-6">
          <button
            onClick={onBack}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            &larr; {t('backToEventSelection')}
          </button>
        </div>
      )}
    </div>
  );
}
