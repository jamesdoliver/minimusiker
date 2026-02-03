'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface EditChildModalProps {
  registrationId: string;
  currentName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditChildModal({
  registrationId,
  currentName,
  onClose,
  onSuccess,
}: EditChildModalProps) {
  const t = useTranslations('parentPortal.manageChildren');
  const [childName, setChildName] = useState(currentName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

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

    // No change
    if (trimmedName === currentName) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/parent/registrations/${registrationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          childName: trimmedName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('updateFailed'));
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('updateFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{t('editChild')}</h3>
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
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? t('saving') : t('saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
