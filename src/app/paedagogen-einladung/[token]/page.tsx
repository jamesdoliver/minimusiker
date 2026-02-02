'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type PageState = 'loading' | 'valid' | 'invalid' | 'submitting' | 'error';
type ErrorType = 'expired' | 'used' | 'not_found' | 'invalid' | 'server_error';

interface InviteInfo {
  schoolName: string;
  eventDate: string;
  eventType: string;
  invitedByName?: string;
  expiresAt: string;
}

function formatDate(dateString: string): string {
  if (!dateString) return 'Datum unbekannt';
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getErrorMessage(errorType: ErrorType): { title: string; message: string } {
  switch (errorType) {
    case 'expired':
      return {
        title: 'Einladung abgelaufen',
        message: 'Diese Einladung ist leider abgelaufen. Bitten Sie die einladende Person, Ihnen einen neuen Link zu senden.',
      };
    case 'used':
      return {
        title: 'Einladung bereits verwendet',
        message: 'Diese Einladung wurde bereits verwendet. Wenn Sie bereits Zugang haben, melden Sie sich einfach an.',
      };
    case 'not_found':
      return {
        title: 'Einladung nicht gefunden',
        message: 'Diese Einladung existiert nicht oder wurde gelöscht. Bitten Sie die einladende Person um einen neuen Link.',
      };
    default:
      return {
        title: 'Fehler',
        message: 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.',
      };
  }
}

export default function InviteAcceptancePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [state, setState] = useState<PageState>('loading');
  const [errorType, setErrorType] = useState<ErrorType>('not_found');
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (token) {
      validateInvite();
    }
  }, [token]);

  const validateInvite = async () => {
    try {
      const response = await fetch(`/api/teacher/invite/${encodeURIComponent(token)}`);
      const data = await response.json();

      if (!response.ok || !data.valid) {
        setErrorType(data.error || 'not_found');
        setState('invalid');
        return;
      }

      setInviteInfo({
        schoolName: data.schoolName,
        eventDate: data.eventDate,
        eventType: data.eventType,
        invitedByName: data.invitedByName,
        expiresAt: data.expiresAt,
      });
      setState('valid');
    } catch (error) {
      console.error('Error validating invite:', error);
      setErrorType('server_error');
      setState('invalid');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setSubmitError('Bitte geben Sie Ihre E-Mail-Adresse ein');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setSubmitError('Bitte geben Sie eine gültige E-Mail-Adresse ein');
      return;
    }

    setState('submitting');
    setSubmitError('');

    try {
      const response = await fetch('/api/teacher/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email: email.trim().toLowerCase(),
          name: name.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Annehmen der Einladung');
      }

      // Redirect to the event page
      router.push(data.redirectUrl);
    } catch (error) {
      console.error('Error accepting invite:', error);
      setSubmitError(error instanceof Error ? error.message : 'Fehler beim Annehmen der Einladung');
      setState('valid');
    }
  };

  // Loading State
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Einladung wird überprüft...</p>
        </div>
      </div>
    );
  }

  // Invalid State
  if (state === 'invalid') {
    const errorInfo = getErrorMessage(errorType);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{errorInfo.title}</h1>
          <p className="text-gray-600 mb-6">{errorInfo.message}</p>
          <Link
            href="/paedagogen-login"
            className="inline-block px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium"
          >
            Zur Anmeldung
          </Link>
        </div>
      </div>
    );
  }

  // Valid State - Show Form
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 max-w-md w-full p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Sie wurden eingeladen!</h1>
          {inviteInfo?.invitedByName && (
            <p className="text-gray-600 text-sm">
              {inviteInfo.invitedByName} hat Sie zu einem Event eingeladen.
            </p>
          )}
        </div>

        {/* Event Info Card */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-2">{inviteInfo?.schoolName}</h3>
          <div className="space-y-1 text-sm text-gray-600">
            <p className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDate(inviteInfo?.eventDate || '')}
            </p>
            {inviteInfo?.eventType && (
              <p className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                {inviteInfo.eventType}
              </p>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ihre E-Mail-Adresse <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500"
              placeholder="name@schule.de"
              disabled={state === 'submitting'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ihr Name <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500"
              placeholder="Max Mustermann"
              disabled={state === 'submitting'}
            />
          </div>

          <button
            type="submit"
            disabled={state === 'submitting'}
            className="w-full px-4 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium disabled:opacity-50"
          >
            {state === 'submitting' ? 'Wird verarbeitet...' : 'Einladung annehmen'}
          </button>
        </form>

        {/* Footer Note */}
        <p className="mt-4 text-xs text-gray-500 text-center">
          Mit dem Annehmen der Einladung erhalten Sie Zugriff auf das Event und können
          Klassen und Lieder bearbeiten.
        </p>
      </div>
    </div>
  );
}
