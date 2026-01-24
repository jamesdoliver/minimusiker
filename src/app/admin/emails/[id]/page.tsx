'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { EmailTemplate, TemplateData } from '@/lib/types/email-automation';

interface PageProps {
  params: { id: string };
}

export default function EmailTemplateEdit({ params }: PageProps) {
  const { id } = params;
  const router = useRouter();
  const isNewTemplate = id === 'new';

  const [template, setTemplate] = useState<Partial<EmailTemplate>>({
    name: '',
    audience: 'parent',
    triggerDays: -7,
    subject: '',
    bodyHtml: '',
    active: true,
  });
  const [isLoading, setIsLoading] = useState(!isNewTemplate);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewData, setPreviewData] = useState<{
    subject: string;
    body: string;
    sampleData: TemplateData;
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const fetchTemplate = useCallback(async () => {
    if (isNewTemplate) return;

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
  }, [id, isNewTemplate]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

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
        body: JSON.stringify({ email: testEmail }),
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
          <select
            value={template.audience || 'parent'}
            onChange={(e) =>
              setTemplate({
                ...template,
                audience: e.target.value as 'teacher' | 'parent' | 'both',
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="teacher">Lehrer</option>
            <option value="parent">Eltern</option>
            <option value="both">Lehrer & Eltern</option>
          </select>
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
            {'{{teacher_name}}'}, {'{{parent_name}}'}, {'{{child_name}}'}
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
