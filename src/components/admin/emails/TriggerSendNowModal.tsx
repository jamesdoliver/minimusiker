'use client';

import { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface EligibleEvent {
  eventId: string;
  eventRecordId: string;
  schoolName: string;
  eventDate: string;
}

interface PreviewRecipient {
  email: string;
  name: string;
}

interface PreviewEvent {
  eventId: string;
  schoolName: string;
  eventDate: string;
  recipients: PreviewRecipient[];
}

interface SendResult {
  sent: number;
  failed: number;
  skipped: number;
}

interface Props {
  slug: string;
  triggerName: string;
  onClose: () => void;
}

type Step = 'select' | 'preview' | 'sending' | 'results';

export default function TriggerSendNowModal({ slug, triggerName, onClose }: Props) {
  const [step, setStep] = useState<Step>('select');
  const [events, setEvents] = useState<EligibleEvent[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [previewEvents, setPreviewEvents] = useState<PreviewEvent[]>([]);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forceResend, setForceResend] = useState(false);

  // ── Step 1: Fetch eligible events ──
  const fetchEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/trigger-templates/${slug}/send-now`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Laden');
      }

      const data = await response.json();
      if (data.success) {
        setEvents(data.data.events);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Events');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // ── Step 2: Preview recipients ──
  const handlePreview = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/trigger-templates/${slug}/send-now`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventIds: Array.from(selectedEventIds),
          preview: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler bei der Vorschau');
      }

      const data = await response.json();
      if (data.success) {
        setPreviewEvents(data.data.events);
        setStep('preview');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler bei der Vorschau');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 3: Send ──
  const handleSend = async () => {
    try {
      setIsSending(true);
      setStep('sending');
      setError(null);
      const response = await fetch(`/api/admin/trigger-templates/${slug}/send-now`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventIds: Array.from(selectedEventIds),
          preview: false,
          forceResend,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Senden');
      }

      const data = await response.json();
      if (data.success) {
        setSendResult(data.data);
        setStep('results');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Senden');
      setStep('preview');
    } finally {
      setIsSending(false);
    }
  };

  const toggleEvent = (eventId: string) => {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedEventIds.size === events.length) {
      setSelectedEventIds(new Set());
    } else {
      setSelectedEventIds(new Set(events.map((e) => e.eventId)));
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const totalRecipients = previewEvents.reduce((sum, e) => sum + e.recipients.length, 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/30" onClick={onClose} />

        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Jetzt senden</h2>
              <p className="text-sm text-gray-500">{triggerName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              &times;
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Step 1: Event Selection */}
            {step === 'select' && (
              <>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : events.length === 0 ? (
                  <p className="text-sm text-gray-500 py-8 text-center">
                    Keine passenden Events gefunden.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 mb-3">
                      {events.length} Event{events.length !== 1 ? 's' : ''} gefunden.
                      Wähle die Events aus, für die du die E-Mail senden möchtest:
                    </p>

                    <div className="mb-3">
                      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedEventIds.size === events.length && events.length > 0}
                          onChange={toggleAll}
                          className="rounded border-gray-300"
                        />
                        Alle auswählen
                      </label>
                    </div>

                    <div className="space-y-1 max-h-[40vh] overflow-y-auto">
                      {events.map((event) => (
                        <label
                          key={event.eventId}
                          className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedEventIds.has(event.eventId)}
                            onChange={() => toggleEvent(event.eventId)}
                            className="rounded border-gray-300"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {event.schoolName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(event.eventDate)}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* Step 2: Recipient Preview */}
            {step === 'preview' && (
              <>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 mb-4">
                      {totalRecipients} Empfänger für {previewEvents.length} Event{previewEvents.length !== 1 ? 's' : ''}:
                    </p>

                    <div className="space-y-4 max-h-[40vh] overflow-y-auto">
                      {previewEvents.map((event) => (
                        <div key={event.eventId} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-900">
                              {event.schoolName}
                            </p>
                            <span className="text-xs text-gray-500">
                              {formatDate(event.eventDate)}
                            </span>
                          </div>
                          {event.recipients.length === 0 ? (
                            <p className="text-xs text-amber-600">Keine Empfänger gefunden</p>
                          ) : (
                            <div className="space-y-1">
                              {event.recipients.map((r) => (
                                <div key={r.email} className="flex items-center gap-2 text-xs text-gray-600">
                                  <span className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-[10px] flex-shrink-0">
                                    &#10003;
                                  </span>
                                  <span className="truncate">{r.name ? `${r.name} — ` : ''}{r.email}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={forceResend}
                          onChange={(e) => setForceResend(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        Erneut senden (auch an bereits gesendete Empfänger)
                      </label>
                    </div>
                  </>
                )}
              </>
            )}

            {/* Step 3: Sending */}
            {step === 'sending' && (
              <div className="flex flex-col items-center justify-center py-12">
                <LoadingSpinner />
                <p className="mt-4 text-sm text-gray-600">E-Mails werden gesendet...</p>
              </div>
            )}

            {/* Step 4: Results */}
            {step === 'results' && sendResult && (
              <div className="py-4">
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-700">{sendResult.sent}</p>
                    <p className="text-xs text-green-600">Gesendet</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-500">{sendResult.skipped}</p>
                    <p className="text-xs text-gray-500">Übersprungen</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-700">{sendResult.failed}</p>
                    <p className="text-xs text-red-600">Fehlgeschlagen</p>
                  </div>
                </div>
                {sendResult.skipped > 0 && (
                  <p className="text-xs text-gray-500 text-center">
                    Übersprungene Empfänger haben diese E-Mail bereits erhalten.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            {step === 'select' && (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handlePreview}
                  disabled={selectedEventIds.size === 0 || isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Weiter ({selectedEventIds.size} Event{selectedEventIds.size !== 1 ? 's' : ''})
                </button>
              </>
            )}

            {step === 'preview' && (
              <>
                <button
                  onClick={() => setStep('select')}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Zurück
                </button>
                <button
                  onClick={handleSend}
                  disabled={totalRecipients === 0 || isSending}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {totalRecipients} E-Mail{totalRecipients !== 1 ? 's' : ''} senden
                </button>
              </>
            )}

            {step === 'sending' && (
              <div className="w-full text-center text-xs text-gray-400">
                Bitte warten...
              </div>
            )}

            {step === 'results' && (
              <>
                <div />
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
                >
                  Schließen
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
