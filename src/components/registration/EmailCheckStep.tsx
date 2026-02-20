'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { validateEmail } from '@/lib/utils/validators';

interface ExistingChild {
  name: string;
  eventName?: string;
  className?: string;
}

interface EmailCheckResponse {
  exists: boolean;
  registeredForEvent: boolean;
  parentData?: {
    firstName: string;
    phone: string;
  };
  existingChildren?: ExistingChild[];
  childrenForEvent?: Array<{ name: string; className?: string }>;
}

interface EmailCheckStepProps {
  eventId: string;
  onEmailVerified: (
    email: string,
    parentData?: { firstName: string; phone: string },
    existingChildren?: ExistingChild[]
  ) => void;
  onBack?: () => void;
}

export default function EmailCheckStep({
  eventId,
  onEmailVerified,
  onBack,
}: EmailCheckStepProps) {
  const router = useRouter();
  const t = useTranslations('parentPortal.emailCheck');
  const [email, setEmail] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<EmailCheckResponse | null>(null);

  const handleEmailCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setError(emailValidation.error || 'Invalid email');
      return;
    }

    setIsChecking(true);

    try {
      const response = await fetch(
        `/api/auth/check-email?email=${encodeURIComponent(email)}&eventId=${encodeURIComponent(eventId)}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check email');
      }

      const result = data.data as EmailCheckResponse;
      setCheckResult(result);

      // Case 1: Already registered for this event → show redirect option
      if (result.registeredForEvent) {
        // Don't auto-redirect, let user choose
        return;
      }

      // Case 2: Known parent, new event → pass data to form with pre-fill
      if (result.exists && result.parentData) {
        onEmailVerified(email, result.parentData, result.existingChildren);
        return;
      }

      // Case 3: New parent → just pass email
      onEmailVerified(email);
    } catch (err) {
      console.error('Email check error:', err);
      setError(err instanceof Error ? err.message : 'Failed to check email');
    } finally {
      setIsChecking(false);
    }
  };

  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleGoToPortal = async () => {
    setIsRedirecting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/parent-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
        credentials: 'include',
      });

      if (response.ok) {
        router.push('/familie');
      } else {
        setError('Login fehlgeschlagen. Bitte versuche es erneut.');
        setIsRedirecting(false);
      }
    } catch (err) {
      console.error('Portal redirect login error:', err);
      setError('Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
      setIsRedirecting(false);
    }
  };

  const handleContinueAnyway = () => {
    // Even if registered, allow continuing (for adding another child)
    if (checkResult?.parentData) {
      onEmailVerified(email, checkResult.parentData, checkResult.existingChildren);
    } else {
      onEmailVerified(email);
    }
  };

  // Show "already registered" state
  if (checkResult?.registeredForEvent) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('welcomeBack')}</h3>
          <p className="text-gray-600">{t('alreadyRegistered')}</p>
        </div>

        {/* Show registered children */}
        {checkResult.childrenForEvent && checkResult.childrenForEvent.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Registered children:</p>
            <ul className="space-y-1">
              {checkResult.childrenForEvent.map((child, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {child.name}
                  {child.className && <span className="text-gray-400">({child.className})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={handleGoToPortal}
            disabled={isRedirecting}
            className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isRedirecting && <LoadingSpinner size="sm" />}
            {isRedirecting ? 'Weiterleitung...' : t('goToPortal')}
          </button>
          <button
            onClick={handleContinueAnyway}
            className="w-full px-6 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            Register another child
          </button>
        </div>

        {onBack && (
          <div className="text-center">
            <button
              onClick={onBack}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Use a different email
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('title')}</h3>
        <p className="text-gray-600">{t('subtitle')}</p>
      </div>

      <form onSubmit={handleEmailCheck} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            {t('emailLabel')}
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
              setCheckResult(null);
            }}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            placeholder={t('emailPlaceholder')}
            autoFocus
            autoComplete="email"
            disabled={isChecking}
          />
        </div>

        <button
          type="submit"
          disabled={isChecking || !email.trim()}
          className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isChecking && <LoadingSpinner size="sm" />}
          {isChecking ? t('checking') : t('continueButton')}
        </button>
      </form>

      {onBack && (
        <div className="text-center">
          <button
            onClick={onBack}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}
