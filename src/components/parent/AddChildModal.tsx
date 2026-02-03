'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface AddChildModalProps {
  eventId: string;
  classId: string;
  existingChildren: Array<{ name: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddChildModal({
  eventId,
  classId,
  existingChildren,
  onClose,
  onSuccess,
}: AddChildModalProps) {
  const t = useTranslations('parentPortal.manageChildren');
  const [childName, setChildName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);

  // Check for similar names when child name changes
  useEffect(() => {
    if (!childName.trim()) {
      setDuplicateWarning(null);
      setConfirmDuplicate(false);
      return;
    }

    const normalizedInput = childName.trim().toLowerCase();
    const similarChild = existingChildren.find(child => {
      const normalizedExisting = child.name.toLowerCase();
      // Check for exact match or similar names
      return normalizedExisting === normalizedInput ||
        normalizedExisting.includes(normalizedInput) ||
        normalizedInput.includes(normalizedExisting);
    });

    if (similarChild) {
      setDuplicateWarning(similarChild.name);
      setConfirmDuplicate(false);
    } else {
      setDuplicateWarning(null);
    }
  }, [childName, existingChildren]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = childName.trim();
    if (!trimmedName) {
      setError(t('enterChildName'));
      return;
    }

    if (trimmedName.length < 2) {
      setError(t('nameTooShort'));
      return;
    }

    // If there's a duplicate warning and user hasn't confirmed, show confirmation
    if (duplicateWarning && !confirmDuplicate) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/parent/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          eventId,
          classId,
          childName: trimmedName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.data?.isDuplicate) {
          setError(t('duplicateChild', { name: trimmedName }));
        } else {
          throw new Error(data.error || t('addFailed'));
        }
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('addFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{t('addChild')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('childNameLabel')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500"
              placeholder={t('childNamePlaceholder')}
              autoFocus
            />
          </div>

          {/* Duplicate Warning */}
          {duplicateWarning && !confirmDuplicate && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">
                    {t('duplicateWarningTitle')}
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    {t('duplicateWarningMessage', { name: duplicateWarning })}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDuplicate(true)}
                      className="px-3 py-1.5 text-sm bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors"
                    >
                      {t('continueAnyway')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setChildName('')}
                      className="px-3 py-1.5 text-sm text-amber-700 hover:text-amber-900 transition-colors"
                    >
                      {t('enterDifferentName')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Confirmed duplicate message */}
          {duplicateWarning && confirmDuplicate && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                {t('duplicateConfirmed', { name: duplicateWarning })}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!!duplicateWarning && !confirmDuplicate)}
              className="flex-1 px-4 py-2 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t('adding') : t('addChildButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
