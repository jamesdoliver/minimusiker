'use client';

import { useState } from 'react';

interface InviteTeacherModalProps {
  eventId: string;
  schoolName: string;
  onClose: () => void;
}

type ModalState = 'initial' | 'loading' | 'generated' | 'error';

export default function InviteTeacherModal({
  eventId,
  schoolName,
  onClose,
}: InviteTeacherModalProps) {
  const [state, setState] = useState<ModalState>('initial');
  const [inviteUrl, setInviteUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCreateLink = async () => {
    setState('loading');
    setError('');

    try {
      const response = await fetch('/api/teacher/invite/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Erstellen des Links');
      }

      const data = await response.json();
      setInviteUrl(data.inviteUrl);
      setExpiresAt(data.expiresAt);
      setState('generated');
    } catch (err) {
      console.error('Error creating invite:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen des Links');
      setState('error');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatExpiryDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Lehrkraft einladen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Initial State */}
        {state === 'initial' && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-800">So funktioniert es</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Erstellen Sie einen Link, um eine andere Lehrkraft zu diesem Event einzuladen.
                    Die eingeladene Person erhält Zugriff auf alle Klassen und Lieder.
                  </p>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              Sie laden eine Lehrkraft zum Event <strong>&quot;{schoolName}&quot;</strong> ein.
            </p>

            <button
              onClick={handleCreateLink}
              className="w-full px-4 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium"
            >
              Einladungslink erstellen
            </button>
          </>
        )}

        {/* Loading State */}
        {state === 'loading' && (
          <div className="py-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Link wird erstellt...</p>
          </div>
        )}

        {/* Generated State */}
        {state === 'generated' && (
          <>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-green-800">Link erstellt!</p>
                  <p className="text-sm text-green-700 mt-1">
                    Teilen Sie diesen Link mit Ihrer Kollegin oder Ihrem Kollegen.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Einladungslink
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600"
                />
                <button
                  onClick={handleCopy}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    copied
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {copied ? 'Kopiert!' : 'Kopieren'}
                </button>
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-6">
              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Dieser Link ist bis zum {formatExpiryDate(expiresAt)} gültig.
            </p>

            <button
              onClick={onClose}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Schließen
            </button>
          </>
        )}

        {/* Error State */}
        {state === 'error' && (
          <>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-red-800">Fehler</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleCreateLink}
                className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
              >
                Erneut versuchen
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
