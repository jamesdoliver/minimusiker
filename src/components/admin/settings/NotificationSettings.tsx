'use client';

import { useState, useEffect, useCallback } from 'react';
import { NotificationSetting, NotificationType } from '@/lib/types/notification-settings';

interface NotificationTypeConfig {
  type: NotificationType;
  title: string;
  description: string;
}

const notificationTypes: NotificationTypeConfig[] = [
  {
    type: 'new_booking',
    title: 'Neue Buchung',
    description: 'Benachrichtigung, wenn eine neue Buchung über SimplyBook eingeht.',
  },
  {
    type: 'date_change',
    title: 'Terminänderung',
    description: 'Benachrichtigung, wenn ein Veranstaltungstermin geändert wird.',
  },
  {
    type: 'cancellation',
    title: 'Stornierung / Löschung',
    description: 'Benachrichtigung bei Stornierung oder Löschung einer Buchung.',
  },
];

export default function NotificationSettings() {
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<NotificationType | null>(null);
  const [successType, setSuccessType] = useState<NotificationType | null>(null);

  // Fetch settings on mount
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/settings/notifications');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch settings');
      }

      setSettings(data.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Get setting for a specific type
  const getSettingForType = (type: NotificationType): NotificationSetting | undefined => {
    return settings.find((s) => s.type === type);
  };

  // Handle toggle change
  const handleToggle = async (type: NotificationType, enabled: boolean) => {
    const currentSetting = getSettingForType(type);

    // Optimistic update
    setSettings((prev) =>
      prev.map((s) => (s.type === type ? { ...s, enabled } : s))
    );

    try {
      setSavingType(type);
      const response = await fetch('/api/admin/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          recipientEmails: currentSetting?.recipientEmails || '',
          enabled,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update setting');
      }

      // Update with server response
      setSettings((prev) =>
        prev.map((s) => (s.type === type ? data.setting : s))
      );

      setSuccessType(type);
      setTimeout(() => setSuccessType(null), 2000);
    } catch (err) {
      // Revert on error
      setSettings((prev) =>
        prev.map((s) => (s.type === type ? { ...s, enabled: !enabled } : s))
      );
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setSavingType(null);
    }
  };

  // Handle email update
  const handleEmailUpdate = async (type: NotificationType, recipientEmails: string) => {
    const currentSetting = getSettingForType(type);

    try {
      setSavingType(type);
      const response = await fetch('/api/admin/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          recipientEmails,
          enabled: currentSetting?.enabled || false,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update setting');
      }

      // Update with server response
      setSettings((prev) =>
        prev.map((s) => (s.type === type ? data.setting : s))
      );

      setSuccessType(type);
      setTimeout(() => setSuccessType(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setSavingType(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <span className="text-red-500 mr-2">⚠️</span>
          <p className="text-red-700">{error}</p>
        </div>
        <button
          onClick={fetchSettings}
          className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">E-Mail Benachrichtigungen</h3>
        <p className="mt-1 text-sm text-gray-500">
          Konfigurieren Sie, welche Benachrichtigungen an welche E-Mail-Adressen gesendet werden
          sollen.
        </p>
      </div>

      <div className="space-y-6">
        {notificationTypes.map((config) => (
          <NotificationTypeCard
            key={config.type}
            config={config}
            setting={getSettingForType(config.type)}
            onToggle={(enabled) => handleToggle(config.type, enabled)}
            onEmailUpdate={(emails) => handleEmailUpdate(config.type, emails)}
            isSaving={savingType === config.type}
            isSuccess={successType === config.type}
          />
        ))}
      </div>
    </div>
  );
}

interface NotificationTypeCardProps {
  config: NotificationTypeConfig;
  setting: NotificationSetting | undefined;
  onToggle: (enabled: boolean) => void;
  onEmailUpdate: (emails: string) => void;
  isSaving: boolean;
  isSuccess: boolean;
}

function NotificationTypeCard({
  config,
  setting,
  onToggle,
  onEmailUpdate,
  isSaving,
  isSuccess,
}: NotificationTypeCardProps) {
  const [emailInput, setEmailInput] = useState(setting?.recipientEmails || '');
  const [isDirty, setIsDirty] = useState(false);

  // Update local state when setting changes from server
  useEffect(() => {
    if (setting?.recipientEmails !== undefined) {
      setEmailInput(setting.recipientEmails);
      setIsDirty(false);
    }
  }, [setting?.recipientEmails]);

  const handleEmailChange = (value: string) => {
    setEmailInput(value);
    setIsDirty(value !== (setting?.recipientEmails || ''));
  };

  const handleSave = () => {
    onEmailUpdate(emailInput);
  };

  const isEnabled = setting?.enabled ?? false;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="text-base font-medium text-gray-900">{config.title}</h4>
          <p className="mt-1 text-sm text-gray-500">{config.description}</p>
        </div>

        {/* Toggle switch */}
        <button
          onClick={() => onToggle(!isEnabled)}
          disabled={isSaving}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
            isEnabled ? 'bg-primary' : 'bg-gray-200'
          } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
          role="switch"
          aria-checked={isEnabled}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Email input area - only show if enabled */}
      {isEnabled && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Empfänger E-Mail-Adressen
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Mehrere E-Mail-Adressen mit Komma trennen
          </p>
          <div className="flex gap-2">
            <textarea
              value={emailInput}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
              rows={2}
              className="flex-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm resize-none"
            />
            <button
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                isDirty && !isSaving
                  ? 'bg-primary text-white hover:bg-primary/90'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isSaving ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  ...
                </span>
              ) : (
                'Speichern'
              )}
            </button>
          </div>

          {/* Success indicator */}
          {isSuccess && (
            <p className="mt-2 text-sm text-green-600 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Gespeichert
            </p>
          )}
        </div>
      )}
    </div>
  );
}
