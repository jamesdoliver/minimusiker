'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { EmailTemplate, TemplateData, AudienceValue } from '@/lib/types/email-automation';

interface PageProps {
  params: { id: string };
}

export default function EmailTemplateEdit({ params }: PageProps) {
  const { id } = params;
  const router = useRouter();
  const isNewTemplate = id === 'new';

  const [template, setTemplate] = useState<Partial<EmailTemplate>>({
    name: '',
    audience: ['parent'],
    triggerDays: -7,
    triggerHour: 7,
    subject: '',
    bodyHtml: '',
    active: true,
    is_minimusikertag: true,
    is_kita: false,
    is_plus: false,
    is_schulsong: false,
  });
  const [isLoading, setIsLoading] = useState(!isNewTemplate);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [events, setEvents] = useState<{ eventId: string; schoolName: string; eventDate: string; eventType: string }[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewData, setPreviewData] = useState<{
    subject: string;
    body: string;
    sampleData: TemplateData;
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const fetchTemplate = useCallback(async () => {
    // Check directly against id to avoid stale closure issues during navigation
    if (id === 'new') return;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/email-templates/${id}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch template');
      }

      const data = await response.json();
      if (data.success) {
        setTemplate(data.data);
      } else {
        throw new Error(data.error || 'Failed to load template');
      }
    } catch (err) {
      console.error('Error fetching template:', err);
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  useEffect(() => {
    if (isNewTemplate) return;
    fetch('/api/admin/events/list', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setEvents(data.data);
      })
      .catch(() => {});
  }, [isNewTemplate]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      const url = isNewTemplate
        ? '/api/admin/email-templates'
        : `/api/admin/email-templates/${id}`;
      const method = isNewTemplate ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(template),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save template');
      }

      setSuccessMessage(
        isNewTemplate ? 'Vorlage erstellt!' : 'Vorlage gespeichert!'
      );

      if (isNewTemplate) {
        // Redirect to the edit page for the new template
        router.push(`/admin/emails/${data.data.id}`);
      } else {
        setTemplate(data.data);
      }
    } catch (err) {
      console.error('Error saving template:', err);
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNewTemplate) return;

    try {
      setIsDeleting(true);
      setError(null);

      const response = await fetch(`/api/admin/email-templates/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete template');
      }

      router.push('/admin/emails');
    } catch (err) {
      console.error('Error deleting template:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete template');
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      setError('Bitte gib eine E-Mail-Adresse ein');
      return;
    }

    try {
      setIsSendingTest(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch(`/api/admin/email-templates/${id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: testEmail, eventId: selectedEventId || undefined }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send test email');
      }

      setSuccessMessage(`Test-E-Mail an ${testEmail} gesendet!`);
      setTestEmail('');
    } catch (err) {
      console.error('Error sending test email:', err);
      setError(err instanceof Error ? err.message : 'Failed to send test email');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handlePreview = async () => {
    if (isNewTemplate) {
      setError('Bitte speichere die Vorlage zuerst, um eine Vorschau zu sehen');
      return;
    }

    try {
      const response = await fetch(`/api/admin/email-templates/${id}/test`, {
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch preview');
      }

      setPreviewData({
        subject: data.data.preview.subject,
        body: data.data.preview.body,
        sampleData: data.data.sampleData,
      });
      setShowPreview(true);
    } catch (err) {
      console.error('Error fetching preview:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch preview');
    }
  };

  const formatTriggerDays = (days: number): string => {
    if (days === 0) return 'Am Veranstaltungstag';
    if (days < 0) return `${Math.abs(days)} Tage vor der Veranstaltung`;
    return `${days} Tage nach der Veranstaltung`;
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Link
            href="/admin/emails"
            className="text-gray-500 hover:text-gray-700"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {isNewTemplate ? 'Neue Vorlage' : 'Vorlage bearbeiten'}
          </h1>
        </div>

        {!isNewTemplate && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-red-600 hover:text-red-800 text-sm"
          >
            Löschen
          </button>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">{successMessage}</p>
        </div>
      )}

      {/* Form */}
      <div className="space-y-6 bg-white rounded-lg border border-gray-200 p-6">
        {/* Event Types */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Event-Typen
          </label>
          <div className="space-y-3">
            {/* Minimusikertag Toggle */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={template.is_minimusikertag ?? true}
                  onChange={(e) => {
                    const next = e.target.checked;
                    if (!next && !template.is_kita && !template.is_plus && !template.is_schulsong) return;
                    setTemplate({ ...template, is_minimusikertag: next });
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-green-500 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform flex items-center justify-center">
                  <span className="text-[8px] font-bold" style={{ color: '#166534' }}>M</span>
                </div>
              </div>
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                Minimusikertag
              </span>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                style={{ backgroundColor: '#86efac', color: '#166534' }}
              >
                M
              </div>
            </label>

            {/* Minimusikertag PLUS Toggle */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={template.is_plus ?? false}
                  onChange={(e) => {
                    const next = e.target.checked;
                    if (!next && !template.is_minimusikertag && !template.is_kita && !template.is_schulsong) return;
                    setTemplate({ ...template, is_plus: next });
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-blue-500 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
              </div>
              <span className="text-sm text-gray-700 group-hover:text-gray-900">
                Minimusikertag PLUS
              </span>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                style={{ backgroundColor: '#93c5fd', color: '#1e40af' }}
              >
                +
              </div>
            </label>

            {/* KiTa Toggle */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={template.is_kita ?? false}
                  onChange={(e) => {
                    const next = e.target.checked;
                    if (!next && !template.is_minimusikertag && !template.is_plus && !template.is_schulsong) return;
                    setTemplate({ ...template, is_kita: next });
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-violet-500 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
              </div>
              <span className="text-sm text-gray-700 group-hover:text-gray-900">KiTa</span>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                style={{ backgroundColor: '#c4b5fd', color: '#5b21b6' }}
              >
                K
              </div>
            </label>

            {/* Schulsong Toggle */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={template.is_schulsong ?? false}
                  onChange={(e) => {
                    const next = e.target.checked;
                    if (!next && !template.is_minimusikertag && !template.is_plus && !template.is_kita) return;
                    setTemplate({ ...template, is_schulsong: next });
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-orange-500 transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform" />
              </div>
              <span className="text-sm text-gray-700 group-hover:text-gray-900">Schulsong</span>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                style={{ backgroundColor: '#fdba74', color: '#9a3412' }}
              >
                S
              </div>
            </label>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Mindestens ein Event-Typ muss ausgewählt sein. Template wird nur an Events gesendet, die alle ausgewählten Typen haben.
          </p>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name der Vorlage
          </label>
          <input
            type="text"
            value={template.name || ''}
            onChange={(e) => setTemplate({ ...template, name: e.target.value })}
            placeholder="z.B. Lehrer 56-Tage Erinnerung"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* Audience */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Zielgruppe
          </label>
          <div className="space-y-2">
            {([
              { value: 'teacher' as AudienceValue, label: 'Lehrer' },
              { value: 'parent' as AudienceValue, label: 'Eltern' },
              { value: 'non-buyers' as AudienceValue, label: 'Non-Buyers' },
            ]).map(({ value, label }) => {
              const currentAudience = template.audience || ['parent'];
              const isChecked = currentAudience.includes(value);
              return (
                <label key={value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                      let next: AudienceValue[];
                      if (e.target.checked) {
                        next = [...currentAudience, value];
                      } else {
                        next = currentAudience.filter((v) => v !== value);
                      }
                      // Prevent unchecking the last checkbox
                      if (next.length === 0) return;
                      setTemplate({ ...template, audience: next });
                    }}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">{label}</span>
                  {value === 'non-buyers' && (
                    <span className="ml-2 text-xs text-gray-400">
                      Eltern, die registriert aber noch nicht bestellt haben.
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Mindestens eine Zielgruppe muss ausgewählt sein.
          </p>
        </div>

        {/* Trigger Days */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Versandzeitpunkt
          </label>
          <div className="flex items-center space-x-4">
            <input
              type="number"
              value={template.triggerDays || 0}
              onChange={(e) =>
                setTemplate({
                  ...template,
                  triggerDays: parseInt(e.target.value, 10) || 0,
                })
              }
              className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <span className="text-sm text-gray-500">
              {formatTriggerDays(template.triggerDays || 0)}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Negative Zahlen = Tage vor der Veranstaltung, positive = Tage danach
          </p>
        </div>

        {/* Trigger Hour */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sendezeit (Uhr)
          </label>
          <select
            value={template.triggerHour ?? 7}
            onChange={(e) =>
              setTemplate({
                ...template,
                triggerHour: parseInt(e.target.value, 10),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {i}:00 Uhr
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Uhrzeit in deutscher Zeit (MEZ/MESZ)
          </p>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Betreff
          </label>
          <input
            type="text"
            value={template.subject || ''}
            onChange={(e) =>
              setTemplate({ ...template, subject: e.target.value })
            }
            placeholder="Verwende {{school_name}}, {{event_date}} etc."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">
            Verfügbare Variablen: {'{{school_name}}'}, {'{{event_date}}'},{' '}
            {'{{event_type}}'}, {'{{event_link}}'}, {'{{teacher_name}}'}, {'{{parent_name}}'},{' '}
            {'{{child_name}}'}, {'{{event_date+/-X}}'} (z.B. {'{{event_date-7}}'})
          </p>
        </div>

        {/* Body HTML */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            E-Mail Inhalt (HTML)
          </label>
          <textarea
            value={template.bodyHtml || ''}
            onChange={(e) =>
              setTemplate({ ...template, bodyHtml: e.target.value })
            }
            rows={15}
            placeholder="HTML-Inhalt der E-Mail..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
          />
          {/* Variable Reference */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">Variablen-Referenz</p>
            <div className="text-xs text-gray-600 space-y-1">
              <p><code className="bg-gray-200 px-1 rounded">{'{{school_name}}'}</code> – Name der Schule</p>
              <p><code className="bg-gray-200 px-1 rounded">{'{{event_date}}'}</code> – Datum der Veranstaltung (z.B. 15.03.2026)</p>
              <p><code className="bg-gray-200 px-1 rounded">{'{{event_date+N}}'}</code> / <code className="bg-gray-200 px-1 rounded">{'{{event_date-N}}'}</code> – Datum ± N Tage</p>
              <p><code className="bg-gray-200 px-1 rounded">{'{{event_type}}'}</code> – {'"'}Schule{'"'} oder {'"'}KiTa{'"'}</p>
              <p><code className="bg-gray-200 px-1 rounded">{'{{event_link}}'}</code> – Kurz-URL zur Registrierung (z.B. minimusiker.app/e/64)</p>
              <p><code className="bg-gray-200 px-1 rounded">{'{{teacher_name}}'}</code> – Name des Lehrers</p>
              <p><code className="bg-gray-200 px-1 rounded">{'{{parent_name}}'}</code> / <code className="bg-gray-200 px-1 rounded">{'{{parent_first_name}}'}</code> – Name des Elternteils</p>
              <p><code className="bg-gray-200 px-1 rounded">{'{{child_name}}'}</code> – Name des Kindes</p>
              <p><code className="bg-gray-200 px-1 rounded">{'{{class_name}}'}</code> – Name der Klasse</p>
              <p><code className="bg-gray-200 px-1 rounded">{'{{parent_portal_link}}'}</code> – Link zum Elternportal</p>
              <p><code className="bg-gray-200 px-1 rounded">{'{{teacher_portal_link}}'}</code> – Link zum Lehrerportal</p>
            </div>
          </div>
        </div>

        {/* Active Toggle */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="active"
            checked={template.active ?? true}
            onChange={(e) =>
              setTemplate({ ...template, active: e.target.checked })
            }
            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
          />
          <label htmlFor="active" className="ml-2 text-sm text-gray-700">
            Vorlage aktiv (wird automatisch versendet)
          </label>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Speichert...' : 'Speichern'}
          </button>

          {!isNewTemplate && (
            <>
              <button
                onClick={handlePreview}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Vorschau
              </button>
            </>
          )}
        </div>

        {/* Test Email Section */}
        {!isNewTemplate && (
          <div className="pt-4 border-t border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test-E-Mail senden
            </label>
            <div className="mb-2">
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              >
                <option value="">Vorschau-Daten verwenden (kein Event)</option>
                {events.map((ev) => (
                  <option key={ev.eventId} value={ev.eventId}>
                    {ev.schoolName} — {new Date(ev.eventDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Wähle ein Event, um echte Daten für die Variablen zu verwenden.
              </p>
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <button
                onClick={handleSendTest}
                disabled={isSendingTest || !testEmail}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSendingTest ? 'Sendet...' : 'Senden'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Vorlage löschen?
            </h3>
            <p className="text-gray-600 mb-4">
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Löscht...' : 'Löschen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                E-Mail Vorschau
              </h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              <div className="mb-4">
                <p className="text-sm text-gray-500">Betreff:</p>
                <p className="font-medium">{previewData.subject}</p>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <iframe
                  srcDoc={previewData.body}
                  className="w-full h-96"
                  title="Email Preview"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
