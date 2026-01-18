'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import RegistrationForm from '@/components/registration/RegistrationForm';
import SchoolSearchStep from '@/components/registration/SchoolSearchStep';
import EventSelectionStep from '@/components/registration/EventSelectionStep';
import ClassSelectionStep from '@/components/registration/ClassSelectionStep';
import RegistrationStepper from '@/components/registration/RegistrationStepper';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import LanguageSelector from '@/components/shared/LanguageSelector';
import { EventClassDetails } from '@/lib/types/airtable';
import { isValidEventId, isValidClassId } from '@/lib/utils/validators';

type RegistrationStep = 'school' | 'event' | 'class' | 'form';

interface DiscoveryState {
  schoolName: string;
  eventId: string;
  eventDate: string;
  eventType: string;
  classId: string;
  className: string;
}

function RegistrationPageContent() {
  const searchParams = useSearchParams();
  const t = useTranslations('registration.page');
  const tErrors = useTranslations('registration.errors');
  const tEventInfo = useTranslations('registration.eventInfo');
  const tStepper = useTranslations('registration.stepper');
  const locale = useLocale();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventDetails, setEventDetails] = useState<EventClassDetails | null>(null);

  // URL parameters for direct link flow
  const urlEventId = searchParams.get('event') || '';
  const urlClassId = searchParams.get('class') || '';
  const initialEmail = searchParams.get('email') || '';

  // Discovery flow state
  const [isDiscoveryMode, setIsDiscoveryMode] = useState(false);
  const [isQrFlow, setIsQrFlow] = useState(false);
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('school');
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>({
    schoolName: '',
    eventId: '',
    eventDate: '',
    eventType: '',
    classId: '',
    className: '',
  });

  useEffect(() => {
    const validateAndFetchEvent = async () => {
      // Case 1: Both event and class provided → direct to form
      if (urlEventId && urlClassId) {
        // Validate URL parameters
        if (!isValidEventId(urlEventId) || !isValidClassId(urlClassId)) {
          setError('invalid_params');
          setIsLoading(false);
          return;
        }

        // Fetch event details
        try {
          const response = await fetch(
            `/api/airtable/event-details?eventId=${encodeURIComponent(urlEventId)}&classId=${encodeURIComponent(urlClassId)}`
          );

          if (!response.ok) {
            if (response.status === 404) {
              setError('event_not_found');
            } else {
              setError('fetch_error');
            }
            setIsLoading(false);
            return;
          }

          const data = await response.json();
          if (data.success && data.data) {
            setEventDetails(data.data);
          } else {
            setError('event_not_found');
          }
        } catch (err) {
          console.error('Error fetching event details:', err);
          setError('network_error');
        } finally {
          setIsLoading(false);
        }
      }
      // Case 2: Only event provided (QR flow) → smart class handling
      else if (urlEventId) {
        setIsQrFlow(true);

        try {
          // Fetch classes for this event
          const classResponse = await fetch(
            `/api/airtable/school-events?bookingId=${encodeURIComponent(urlEventId)}`
          );
          const classData = await classResponse.json();

          if (!classData.success) {
            setError('event_not_found');
            setIsLoading(false);
            return;
          }

          // Event exists but no classes set up yet
          if (!classData.data?.classes?.length) {
            setError('no_classes');
            setIsLoading(false);
            return;
          }

          const classes = classData.data.classes;

          // If only 1 class, auto-select and fetch event details
          if (classes.length === 1) {
            const singleClass = classes[0];
            const detailsResponse = await fetch(
              `/api/airtable/event-details?eventId=${encodeURIComponent(urlEventId)}&classId=${encodeURIComponent(singleClass.classId)}`
            );
            const detailsData = await detailsResponse.json();

            if (detailsData.success && detailsData.data) {
              setEventDetails(detailsData.data);
              setDiscoveryState((prev) => ({
                ...prev,
                classId: singleClass.classId,
                className: singleClass.className,
                eventId: urlEventId,
              }));
            } else {
              setError('event_not_found');
            }
          } else {
            // Multiple classes - show class picker only
            setIsDiscoveryMode(true);
            setDiscoveryState((prev) => ({
              ...prev,
              eventId: urlEventId,
              schoolName: classData.data.schoolName || '',
              eventDate: classData.data.eventDate || '',
              eventType: classData.data.eventType || '',
            }));
            setCurrentStep('class');
          }
        } catch (err) {
          console.error('Error fetching classes:', err);
          setError('network_error');
        } finally {
          setIsLoading(false);
        }
      }
      // Case 3: No params → full discovery mode
      else {
        setIsDiscoveryMode(true);
        setIsLoading(false);
      }
    };

    validateAndFetchEvent();
  }, [urlEventId, urlClassId]);

  // Discovery flow handlers
  const handleSchoolSelect = (schoolName: string) => {
    setDiscoveryState((prev) => ({ ...prev, schoolName }));
    setCurrentStep('event');
  };

  const handleEventSelect = (eventId: string, eventDate: string, eventType: string) => {
    setDiscoveryState((prev) => ({
      ...prev,
      eventId,
      eventDate,
      eventType,
    }));
    setCurrentStep('class');
  };

  const handleClassSelect = async (classId: string, className: string) => {
    setDiscoveryState((prev) => ({ ...prev, classId, className }));

    // Fetch full event details for the form
    try {
      const response = await fetch(
        `/api/airtable/event-details?eventId=${encodeURIComponent(discoveryState.eventId)}&classId=${encodeURIComponent(classId)}`
      );
      const data = await response.json();

      if (data.success && data.data) {
        setEventDetails(data.data);
        setCurrentStep('form');
      } else {
        setError('event_not_found');
      }
    } catch (err) {
      console.error('Error fetching event details:', err);
      setError('network_error');
    }
  };

  const handleBack = () => {
    // In QR flow, don't allow going back past class selection
    if (isQrFlow && currentStep === 'class') {
      return;
    }

    switch (currentStep) {
      case 'event':
        setCurrentStep('school');
        break;
      case 'class':
        setCurrentStep('event');
        break;
      case 'form':
        setCurrentStep('class');
        break;
    }
  };

  const handleSwitchSchool = () => {
    // Reset all state to start fresh school search
    setIsDiscoveryMode(true);
    setIsQrFlow(false);
    setCurrentStep('school');
    setEventDetails(null);
    setDiscoveryState({
      schoolName: '',
      eventId: '',
      eventDate: '',
      eventType: '',
      classId: '',
      className: '',
    });
  };

  const getStepNumber = (): number => {
    switch (currentStep) {
      case 'school':
        return 1;
      case 'event':
        return 2;
      case 'class':
        return 3;
      case 'form':
        return 4;
      default:
        return 1;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">{t('loading')}</p>
        </div>
      </div>
    );
  }

  // Error states
  if (error) {
    // Map error codes to translation keys
    const errorKeyMap: Record<string, string> = {
      missing_params: 'missingParams',
      invalid_params: 'invalidParams',
      event_not_found: 'eventNotFound',
      no_classes: 'noClasses',
      fetch_error: 'fetchError',
      network_error: 'networkError',
    };

    const errorKey = errorKeyMap[error] || 'fetchError';

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {tErrors(`${errorKey}.title`)}
          </h2>
          <p className="text-gray-600 mb-4">{tErrors(`${errorKey}.message`)}</p>
          <p className="text-sm text-gray-500 mb-6">{tErrors(`${errorKey}.suggestion`)}</p>
          {error === 'network_error' && (
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            >
              {tErrors('retry')}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Discovery mode - multi-step flow
  if (isDiscoveryMode && currentStep !== 'form') {
    const stepLabels = [
      tStepper('school'),
      tStepper('event'),
      tStepper('class'),
      tStepper('details'),
    ];

    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* Language Selector */}
          <div className="flex justify-end mb-4">
            <LanguageSelector />
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-gray-600 mt-2">{t('subtitle')}</p>
          </div>

          {/* Stepper */}
          <RegistrationStepper
            currentStep={getStepNumber()}
            totalSteps={4}
            stepLabels={stepLabels}
          />

          {/* Step Content */}
          <div className="bg-white shadow-lg rounded-lg p-8">
            {currentStep === 'school' && (
              <SchoolSearchStep onSchoolSelect={handleSchoolSelect} />
            )}
            {currentStep === 'event' && (
              <EventSelectionStep
                schoolName={discoveryState.schoolName}
                onEventSelect={handleEventSelect}
                onBack={handleBack}
              />
            )}
            {currentStep === 'class' && (
              <ClassSelectionStep
                bookingId={discoveryState.eventId}
                schoolName={discoveryState.schoolName}
                eventDate={discoveryState.eventDate}
                eventType={discoveryState.eventType}
                onClassSelect={handleClassSelect}
                onBack={isQrFlow ? undefined : handleBack}
              />
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>
              {t('footerQuestion')}{' '}
              <span className="text-sage-600">{t('footerHint')}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show registration form (either from direct link or after discovery)
  if (!eventDetails) {
    return null;
  }

  const effectiveEventId = isDiscoveryMode ? discoveryState.eventId : urlEventId;
  // Use discoveryState.classId when QR flow auto-selects single class, otherwise use URL param
  const effectiveClassId = discoveryState.classId || urlClassId;

  const stepLabels = [
    tStepper('school'),
    tStepper('event'),
    tStepper('class'),
    tStepper('details'),
  ];

  // Locale-aware date formatting
  const dateLocale = locale === 'de' ? 'de-DE' : 'en-GB';

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Language Selector */}
        <div className="flex justify-end mb-4">
          <LanguageSelector />
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-600 mt-2">
            {t('registerFor', { schoolName: eventDetails.schoolName })}
          </p>
        </div>

        {/* Stepper for discovery mode */}
        {isDiscoveryMode && (
          <RegistrationStepper currentStep={4} totalSteps={4} stepLabels={stepLabels} />
        )}

        {/* Event Info Card */}
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center md:text-left">
            <div>
              <p className="text-sm text-gray-600 mb-1">{tEventInfo('school')}</p>
              <p className="font-semibold text-gray-900">{eventDetails.schoolName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">{tEventInfo('class')}</p>
              <p className="font-semibold text-gray-900">{eventDetails.className}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">{tEventInfo('eventType')}</p>
              <p className="font-semibold text-gray-900 capitalize">
                {eventDetails.eventType}
              </p>
            </div>
          </div>
          {eventDetails.bookingDate && (
            <div className="mt-4 text-center md:text-left">
              <p className="text-sm text-gray-600 mb-1">{tEventInfo('eventDate')}</p>
              <p className="font-semibold text-gray-900">
                {new Date(eventDetails.bookingDate).toLocaleDateString(dateLocale, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          )}
        </div>

        {/* Registration Form */}
        <RegistrationForm
          eventId={effectiveEventId}
          classId={effectiveClassId}
          schoolName={eventDetails.schoolName}
          className={eventDetails.className}
          eventType={eventDetails.eventType}
          initialEmail={initialEmail}
        />

        {/* Back button for discovery mode */}
        {isDiscoveryMode && (
          <div className="mt-4 text-center">
            <button
              onClick={handleBack}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              &larr; {t('backToClassSelection')}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>{t('footerHelp')}</p>

          {/* Not Your School Link - show when coming from QR/direct link */}
          {!isDiscoveryMode && (
            <p className="mt-4">
              <button
                onClick={handleSwitchSchool}
                className="text-sage-600 hover:text-sage-700 underline"
              >
                {t('notYourSchool')} {t('searchCorrectSchool')}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RegistrationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <RegistrationPageContent />
    </Suspense>
  );
}
