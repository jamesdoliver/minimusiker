'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { TriggerEmailTemplate } from '@/lib/types/email-automation';

interface Props {
  slug: string;
  onClose: () => void;
}

export default function TriggerEmailEditor({ slug, onClose }: Props) {
  const [template, setTemplate] = useState<TriggerEmailTemplate | null>(null);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fetchTemplate = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/trigger-templates/${slug}`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to fetch template');

      const data = await response.json();
      if (data.success) {
        setTemplate(data.data);
        setSubject(data.data.subject);
        setBodyHtml(data.data.bodyHtml);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading template');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/admin/trigger-templates/${slug}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, bodyHtml }),
      });

      const data = await response.json();
      if (data.success) {
        setTemplate(data.data);
        setSuccessMessage('Vorlage gespeichert');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || 'Fehler beim Speichern');
      }
    } catch (err) {
      setError('Fehler beim Speichern');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/trigger-templates/${slug}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToDefault: true }),
      });

      const data = await response.json();
      if (data.success) {
        setTemplate(data.data);
        setSubject(data.data.subject);
        setBodyHtml(data.data.bodyHtml);
        setSuccessMessage('Auf Standard zurückgesetzt');
        setPreviewHtml(null);
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || 'Fehler beim Zurücksetzen');
      }
    } catch (err) {
      setError('Fehler beim Zurücksetzen');
    } finally {
      setIsResetting(false);
    }
  };

  const handlePreview = async () => {
    setIsLoadingPreview(true);

    try {
      const response = await fetch(`/api/admin/trigger-templates/${slug}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, bodyHtml }),
      });

      const data = await response.json();
      if (data.success) {
        setPreviewHtml(data.data.html);
      }
    } catch (err) {
      console.error('Preview error:', err);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Write preview HTML to iframe when it changes
  useEffect(() => {
    if (previewHtml && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(previewHtml);
        doc.close();
      }
    }
  }, [previewHtml]);

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('trigger-body-editor') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const placeholder = `{{${variable}}}`;
      const newValue = bodyHtml.substring(0, start) + placeholder + bodyHtml.substring(end);
      setBodyHtml(newValue);
      // Restore cursor position after React re-render
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
      }, 0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/30" onClick={onClose} />
        <div className="relative w-full max-w-4xl transform overflow-hidden rounded-lg bg-white text-left shadow-xl">
          {/* Modal Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {template?.name || 'Trigger-E-Mail bearbeiten'}
                </h3>
                {template && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {template.description}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>
          </div>

          {/* Modal Content */}
          <div className="px-6 py-4 max-h-[75vh] overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Error / Success Messages */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                    {error}
                  </div>
                )}
                {successMessage && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                    {successMessage}
                  </div>
                )}

                {/* Trigger Event Info */}
                {template?.triggerEventName && (
                  <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-cyan-700">
                      Trigger: {template.triggerEventName}
                    </p>
                    {template.triggerEventDescription && (
                      <p className="text-xs text-cyan-600 mt-0.5">
                        {template.triggerEventDescription}
                      </p>
                    )}
                  </div>
                )}

                {/* Available Variables */}
                {template && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-600 mb-2">
                      Verfügbare Variablen (klicken zum Einfügen):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {template.availableVariables.map((v) => (
                        <button
                          key={v}
                          onClick={() => insertVariable(v)}
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-white border border-gray-200 text-gray-700 hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors cursor-pointer"
                        >
                          {'{{'}
                          {v}
                          {'}}'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Betreff
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary font-mono"
                    placeholder="E-Mail Betreff mit {{variablen}}"
                  />
                </div>

                {/* Body HTML */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    HTML Inhalt
                  </label>
                  <textarea
                    id="trigger-body-editor"
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    rows={16}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-primary focus:border-primary font-mono leading-relaxed"
                    placeholder="HTML Body mit {{variablen}}"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Der Inhalt wird automatisch in das Minimusiker E-Mail-Template (Header + Footer) eingebettet.
                  </p>
                </div>

                {/* Preview */}
                {previewHtml && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Vorschau (mit Beispieldaten)
                      </label>
                      <button
                        onClick={() => setPreviewHtml(null)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Schließen
                      </button>
                    </div>
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100">
                      <iframe
                        ref={iframeRef}
                        className="w-full bg-white"
                        style={{ height: '500px' }}
                        sandbox="allow-same-origin"
                        title="E-Mail Vorschau"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {template?.isCustomized && (
                <button
                  onClick={handleReset}
                  disabled={isResetting}
                  className="px-3 py-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50"
                >
                  {isResetting ? 'Setze zurück...' : 'Auf Standard zurücksetzen'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePreview}
                disabled={isLoadingPreview}
                className="px-3 py-2 text-sm text-gray-700 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                {isLoadingPreview ? 'Lädt...' : 'Vorschau'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium"
              >
                {isSaving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
