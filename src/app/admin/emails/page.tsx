'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { EmailTemplate, EmailLog, Audience } from '@/lib/types/email-automation';

interface TemplatesData {
  templates: EmailTemplate[];
  grouped: {
    teacher: EmailTemplate[];
    parent: EmailTemplate[];
    'non-buyers': EmailTemplate[];
  };
  total: number;
}

interface LogsData {
  logs: EmailLog[];
  stats: {
    total: number;
    sent: number;
    failed: number;
    skipped: number;
  };
}

interface DryRunEventMatch {
  eventId: string;
  schoolName: string;
  eventDate: string;
  daysUntilEvent: number;
}

interface DryRunTeacherRecipient {
  email: string;
  name: string | undefined;
  eventId: string;
}

interface DryRunParentRecipient {
  email: string;
  name: string | undefined;
  eventId: string;
  childName: string | undefined;
}

interface SendNowEvent {
  eventId: string;
  eventRecordId: string;
  schoolName: string;
  eventDate: string;
  eventType: string;
}

interface SendNowResult {
  summary: { sent: number; failed: number; skipped: number };
  details: Array<{ eventId: string; email: string; status: string; error?: string }>;
}

interface DryRunData {
  template: {
    id: string;
    name: string;
    triggerDays: number;
    audience: Audience;
  };
  matchingEvents: DryRunEventMatch[];
  recipients: {
    teachers: DryRunTeacherRecipient[];
    parents: DryRunParentRecipient[];
    nonBuyers: DryRunParentRecipient[];
  };
  summary: {
    totalEvents: number;
    totalRecipients: number;
    teacherCount: number;
    parentCount: number;
    nonBuyerCount: number;
  };
}

export default function AdminEmails() {
  const [templatesData, setTemplatesData] = useState<TemplatesData | null>(null);
  const [logsData, setLogsData] = useState<LogsData | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dryRunData, setDryRunData] = useState<DryRunData | null>(null);
  const [isDryRunLoading, setIsDryRunLoading] = useState(false);
  const [isDryRunModalOpen, setIsDryRunModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sendNowTemplateId, setSendNowTemplateId] = useState<string | null>(null);
  const [sendNowEvents, setSendNowEvents] = useState<SendNowEvent[]>([]);
  const [sendNowSelectedEventIds, setSendNowSelectedEventIds] = useState<Set<string>>(new Set());
  const [isSendNowModalOpen, setIsSendNowModalOpen] = useState(false);
  const [isSendNowLoading, setIsSendNowLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendNowResult, setSendNowResult] = useState<SendNowResult | null>(null);
  const [newLogIds, setNewLogIds] = useState<Set<string>>(new Set());
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previousLogIdsRef = useRef<Set<string>>(new Set());

  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoadingTemplates(true);
      const response = await fetch('/api/admin/email-templates', {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch templates');
      }

      const data = await response.json();
      if (data.success) {
        setTemplatesData(data.data);
      } else {
        throw new Error(data.error || 'Failed to load templates');
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  const fetchLogs = useCallback(async (silent?: boolean) => {
    try {
      if (!silent) setIsLoadingLogs(true);
      const response = await fetch('/api/admin/email-logs?limit=50', {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch logs');
      }

      const data = await response.json();
      if (data.success) {
        const newLogs: EmailLog[] = data.data.logs;
        // Detect new log entries on silent refresh
        if (silent && newLogs.length > 0) {
          const currentIds = new Set(newLogs.map((l: EmailLog) => l.id));
          const freshIds = new Set<string>();
          for (const id of currentIds) {
            if (!previousLogIdsRef.current.has(id)) {
              freshIds.add(id);
            }
          }
          if (freshIds.size > 0) {
            setNewLogIds(freshIds);
            // Clear highlight after 3 seconds
            setTimeout(() => setNewLogIds(new Set()), 3000);
          }
          previousLogIdsRef.current = currentIds;
        } else if (!silent && newLogs.length > 0) {
          previousLogIdsRef.current = new Set(newLogs.map((l: EmailLog) => l.id));
        }
        setLogsData(data.data);
      } else {
        throw new Error(data.error || 'Failed to load logs');
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
      // Don't set error for logs - templates are primary
    } finally {
      if (!silent) setIsLoadingLogs(false);
    }
  }, []);

  const fetchDryRun = useCallback(async (templateId: string) => {
    try {
      setIsDryRunLoading(true);
      setIsDryRunModalOpen(true);
      setDryRunData(null);

      const response = await fetch(`/api/admin/email-templates/${templateId}/dry-run`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run dry-run');
      }

      const data = await response.json();
      if (data.success) {
        setDryRunData(data.data);
      } else {
        throw new Error(data.error || 'Failed to run dry-run');
      }
    } catch (err) {
      console.error('Error fetching dry-run:', err);
      setIsDryRunModalOpen(false);
      alert(err instanceof Error ? err.message : 'Failed to run dry-run analysis');
    } finally {
      setIsDryRunLoading(false);
    }
  }, []);

  const closeDryRunModal = useCallback(() => {
    setIsDryRunModalOpen(false);
    setDryRunData(null);
  }, []);

  const handleDelete = async (templateId: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/email-templates/${templateId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.ok) {
        fetchTemplates();
      } else {
        const errorData = await response.json();
        console.error('Delete failed:', errorData.error);
      }
    } catch (err) {
      console.error('Error deleting template:', err);
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const openSendNowModal = useCallback(async (templateId: string) => {
    setSendNowTemplateId(templateId);
    setIsSendNowModalOpen(true);
    setIsSendNowLoading(true);
    setSendNowResult(null);
    setSendNowSelectedEventIds(new Set());
    try {
      const response = await fetch('/api/admin/events/list', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch events');
      const data = await response.json();
      if (data.success) {
        setSendNowEvents(data.data);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
      setSendNowEvents([]);
    } finally {
      setIsSendNowLoading(false);
    }
  }, []);

  const closeSendNowModal = useCallback(() => {
    setIsSendNowModalOpen(false);
    setSendNowTemplateId(null);
    setSendNowEvents([]);
    setSendNowSelectedEventIds(new Set());
    setSendNowResult(null);
  }, []);

  const toggleSendNowEvent = useCallback((eventId: string) => {
    setSendNowSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  const executeSendNow = useCallback(async () => {
    if (!sendNowTemplateId || sendNowSelectedEventIds.size === 0) return;
    setIsSending(true);
    try {
      const response = await fetch(`/api/admin/email-templates/${sendNowTemplateId}/send-now`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventIds: Array.from(sendNowSelectedEventIds) }),
      });
      const data = await response.json();
      if (data.success) {
        setSendNowResult(data.data);
        fetchLogs();
      } else {
        alert(data.error || 'Fehler beim Senden');
      }
    } catch (err) {
      console.error('Error sending:', err);
      alert('Fehler beim Senden');
    } finally {
      setIsSending(false);
    }
  }, [sendNowTemplateId, sendNowSelectedEventIds, fetchLogs]);

  useEffect(() => {
    fetchTemplates();
    fetchLogs();
  }, [fetchTemplates, fetchLogs]);

  // Auto-poll logs every 15 seconds
  useEffect(() => {
    pollingIntervalRef.current = setInterval(() => {
      fetchLogs(true);
    }, 15000);
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [fetchLogs]);

  const formatTriggerDays = (days: number): string => {
    if (days === 0) return 'Am Veranstaltungstag';
    if (days < 0) return `${Math.abs(days)} Tage vorher`;
    return `${days} Tage nachher`;
  };

  const formatDate = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoadingTemplates && isLoadingLogs) {
    return <LoadingSpinner fullScreen />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={() => {
              setError(null);
              fetchTemplates();
              fetchLogs();
            }}
            className="mt-2 text-sm text-red-600 underline hover:no-underline"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">E-Mail Automation</h1>
          <p className="mt-1 text-sm text-gray-500">
            Verwalte automatisierte E-Mail-Vorlagen und verfolge gesendete E-Mails
          </p>
        </div>
        <Link
          href="/admin/emails/new"
          className="inline-flex items-center justify-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <span className="mr-2">+</span>
          Neue Vorlage
        </Link>
      </div>

      {/* Templates Timeline */}
      {isLoadingTemplates ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : !templatesData || templatesData.templates.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Keine Vorlagen gefunden
        </div>
      ) : (
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[7.5rem] top-0 bottom-0 w-0.5 bg-gray-200" />

          <div className="space-y-0">
            {(() => {
              const sorted = [...templatesData.templates].sort((a, b) => a.triggerDays - b.triggerDays);
              const firstNonNegativeIdx = sorted.findIndex(t => t.triggerDays >= 0);
              const items: React.ReactNode[] = [];

              sorted.forEach((template, idx) => {
                // Insert "Veranstaltungstag" divider before first template with triggerDays >= 0
                if (idx === firstNonNegativeIdx) {
                  items.push(
                    <div key="divider" className="relative flex items-center py-3">
                      <div className="w-[7.5rem] flex-shrink-0" />
                      <div className="relative z-10 flex items-center justify-center w-5 h-5 bg-primary rounded-full ring-4 ring-primary/20" />
                      <div className="ml-4 flex-1 border-t-2 border-dashed border-primary/40 relative">
                        <span className="absolute -top-3 left-2 bg-white px-2 text-xs font-semibold text-primary">
                          Veranstaltungstag
                        </span>
                      </div>
                    </div>
                  );
                }

                const dotColor = template.triggerDays < 0
                  ? 'bg-blue-500'
                  : template.triggerDays === 0
                  ? 'bg-primary'
                  : 'bg-amber-500';

                // Build audience badges
                const audienceBadges: { label: string; cls: string }[] = [];
                const aud = template.audience;
                const hasTeacher = aud.includes('teacher');
                const hasParent = aud.includes('parent');
                const hasNonBuyer = aud.includes('non-buyers');

                if (hasTeacher && hasParent && !hasNonBuyer) {
                  audienceBadges.push({ label: 'Beide', cls: 'bg-blue-100 text-blue-700' });
                } else {
                  if (hasTeacher) audienceBadges.push({ label: 'Lehrer', cls: 'bg-purple-100 text-purple-700' });
                  if (hasParent) audienceBadges.push({ label: 'Eltern', cls: 'bg-orange-100 text-orange-700' });
                }
                if (hasNonBuyer) audienceBadges.push({ label: 'Non-Buyers', cls: 'bg-amber-100 text-amber-700' });

                items.push(
                  <div key={template.id} className="relative flex items-start py-2 group">
                    {/* Trigger day label */}
                    <div className="w-[7.5rem] flex-shrink-0 text-right pr-4 pt-3">
                      <span className="text-xs font-medium text-gray-500">
                        {formatTriggerDays(template.triggerDays)} · {template.triggerHour}:00 Uhr
                      </span>
                    </div>

                    {/* Dot */}
                    <div className={`relative z-10 mt-3.5 w-3 h-3 rounded-full ${dotColor} ring-2 ring-white flex-shrink-0`} />

                    {/* Card */}
                    <div className="ml-4 flex-1 bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                      <Link href={`/admin/emails/${template.id}`} className="block">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-medium text-gray-900">
                                {template.name}
                              </h3>
                              {audienceBadges.map((badge) => (
                                <span key={badge.label} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.cls}`}>
                                  {badge.label}
                                </span>
                              ))}
                            </div>
                            <p className="mt-1 text-xs text-gray-600 truncate">
                              Betreff: {template.subject}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                              template.active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {template.active ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </div>
                      </Link>
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                        <button
                          onClick={() => fetchDryRun(template.id)}
                          className="text-xs text-primary hover:text-primary/80 font-medium"
                        >
                          Dry Run
                        </button>
                        <button
                          onClick={() => openSendNowModal(template.id)}
                          className="text-xs text-green-600 hover:text-green-800 font-medium"
                        >
                          Jetzt senden
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(template.id)}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                  </div>
                );
              });

              return items;
            })()}
          </div>
        </div>
      )}

      {/* Recent Logs Section */}
      <div className="mt-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Letzte Aktivitäten
          </h2>
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Automatische Aktualisierung
          </span>
        </div>

        {logsData && logsData.stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Gesamt</p>
              <p className="text-lg font-semibold text-gray-900">
                {logsData.stats.total}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-green-200 p-3">
              <p className="text-xs text-green-600">Gesendet</p>
              <p className="text-lg font-semibold text-green-700">
                {logsData.stats.sent}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-red-200 p-3">
              <p className="text-xs text-red-600">Fehlgeschlagen</p>
              <p className="text-lg font-semibold text-red-700">
                {logsData.stats.failed}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Übersprungen</p>
              <p className="text-lg font-semibold text-gray-600">
                {logsData.stats.skipped}
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {isLoadingLogs ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : logsData?.logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Noch keine E-Mails gesendet
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Zeitpunkt
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vorlage
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Empfänger
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logsData?.logs.map((log) => (
                    <tr
                      key={log.id}
                      className={`transition-colors duration-500 ${
                        newLogIds.has(log.id) ? 'bg-green-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(log.sentAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {log.templateName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        <span className="inline-flex items-center">
                          {log.recipientType === 'teacher' ? '👨‍🏫' : '👨‍👩‍👧'}
                          <span className="ml-1">{log.recipientEmail}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            log.status === 'sent'
                              ? 'bg-green-100 text-green-800'
                              : log.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {log.status === 'sent' && 'Gesendet'}
                          {log.status === 'failed' && 'Fehlgeschlagen'}
                          {log.status === 'skipped' && 'Übersprungen'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <div
              className="fixed inset-0 bg-black/30"
              onClick={() => setDeleteConfirmId(null)}
            />
            <div className="relative w-full max-w-md transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Vorlage löschen?
                </h3>
                <p className="text-gray-600 mb-2">
                  Diese Aktion kann nicht rückgängig gemacht werden.
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Vorlage:{' '}
                  <span className="font-medium text-gray-700">
                    {templatesData?.templates.find((t) => t.id === deleteConfirmId)?.name}
                  </span>
                </p>
                <div className="flex gap-4">
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={() => handleDelete(deleteConfirmId)}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeleting ? 'Löscht...' : 'Löschen'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Now Modal */}
      {isSendNowModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <div
              className="fixed inset-0 bg-black/30"
              onClick={closeSendNowModal}
            />
            <div className="relative w-full max-w-lg transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all">
              {/* Modal Header */}
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Jetzt senden: {templatesData?.templates.find(t => t.id === sendNowTemplateId)?.name}
                  </h3>
                  <button
                    onClick={closeSendNowModal}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <span className="text-2xl">&times;</span>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
                {isSendNowLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : sendNowResult ? (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Ergebnis</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <p className="text-xl font-bold text-green-700">{sendNowResult.summary.sent}</p>
                        <p className="text-xs text-green-600">Gesendet</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-3 text-center">
                        <p className="text-xl font-bold text-red-700">{sendNowResult.summary.failed}</p>
                        <p className="text-xs text-red-600">Fehlgeschlagen</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-xl font-bold text-gray-600">{sendNowResult.summary.skipped}</p>
                        <p className="text-xs text-gray-500">Übersprungen</p>
                      </div>
                    </div>
                  </div>
                ) : sendNowEvents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Keine Veranstaltungen im Zeitfenster gefunden
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500 mb-3">
                      Wähle die Veranstaltungen aus, an deren Empfänger die E-Mail gesendet werden soll:
                    </p>
                    {sendNowEvents.map((event) => (
                      <label
                        key={event.eventId}
                        className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={sendNowSelectedEventIds.has(event.eventId)}
                          onChange={() => toggleSendNowEvent(event.eventId)}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {event.schoolName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(event.eventDate).toLocaleDateString('de-DE', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                            })}
                            {' | '}
                            {event.eventType}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 px-6 py-4 flex gap-3">
                <button
                  onClick={closeSendNowModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  {sendNowResult ? 'Schließen' : 'Abbrechen'}
                </button>
                {!sendNowResult && (
                  <button
                    onClick={executeSendNow}
                    disabled={sendNowSelectedEventIds.size === 0 || isSending}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isSending ? 'Sendet...' : `Senden (${sendNowSelectedEventIds.size} Events)`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dry Run Modal */}
      {isDryRunModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <div
              className="fixed inset-0 bg-black/30"
              onClick={closeDryRunModal}
            />
            <div className="relative w-full max-w-2xl transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all">
              {/* Modal Header */}
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Dry Run Analyse
                  </h3>
                  <button
                    onClick={closeDryRunModal}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <span className="text-2xl">&times;</span>
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
                {isDryRunLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : dryRunData ? (
                  <div className="space-y-6">
                    {/* Template Info */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900">
                        {dryRunData.template.name}
                      </h4>
                      <p className="text-sm text-gray-500 mt-1">
                        Trigger: {formatTriggerDays(dryRunData.template.triggerDays)}
                        {' | '}
                        Zielgruppe:{' '}
                        {dryRunData.template.audience.map(a =>
                          a === 'teacher' ? 'Lehrer' : a === 'parent' ? 'Eltern' : a === 'non-buyers' ? 'Non-Buyers' : a
                        ).join(', ')}
                      </p>
                    </div>

                    {/* Summary Stats */}
                    <div className={`grid gap-3 ${dryRunData.summary.nonBuyerCount > 0 ? 'grid-cols-5' : 'grid-cols-4'}`}>
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-blue-700">
                          {dryRunData.summary.totalEvents}
                        </p>
                        <p className="text-xs text-blue-600">Events</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-green-700">
                          {dryRunData.summary.totalRecipients}
                        </p>
                        <p className="text-xs text-green-600">Empfänger</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-purple-700">
                          {dryRunData.summary.teacherCount}
                        </p>
                        <p className="text-xs text-purple-600">Lehrer</p>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-orange-700">
                          {dryRunData.summary.parentCount}
                        </p>
                        <p className="text-xs text-orange-600">Eltern</p>
                      </div>
                      {dryRunData.summary.nonBuyerCount > 0 && (
                        <div className="bg-amber-50 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-amber-700">
                            {dryRunData.summary.nonBuyerCount}
                          </p>
                          <p className="text-xs text-amber-600">Non-Buyers</p>
                        </div>
                      )}
                    </div>

                    {/* Matching Events */}
                    {dryRunData.matchingEvents.length > 0 ? (
                      <div>
                        <h5 className="font-medium text-gray-900 mb-2">
                          Passende Veranstaltungen ({dryRunData.matchingEvents.length})
                        </h5>
                        <div className="space-y-2">
                          {dryRunData.matchingEvents.map((event) => (
                            <div
                              key={event.eventId}
                              className="bg-white border border-gray-200 rounded-lg p-3"
                            >
                              <p className="font-medium text-gray-900 text-sm">
                                {event.schoolName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(event.eventDate).toLocaleDateString('de-DE', {
                                  day: '2-digit',
                                  month: 'long',
                                  year: 'numeric',
                                })}
                                {' '}
                                <span className="text-gray-400">
                                  ({event.daysUntilEvent > 0
                                    ? `in ${event.daysUntilEvent} Tagen`
                                    : event.daysUntilEvent < 0
                                    ? `vor ${Math.abs(event.daysUntilEvent)} Tagen`
                                    : 'heute'})
                                </span>
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-gray-50 rounded-lg">
                        <p className="text-gray-500">
                          Keine Veranstaltungen entsprechen dem Trigger-Zeitpunkt heute.
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          Diese Vorlage würde heute keine E-Mails senden.
                        </p>
                      </div>
                    )}

                    {/* Recipients Lists */}
                    {(dryRunData.recipients.teachers.length > 0 ||
                      dryRunData.recipients.parents.length > 0) && (
                      <div className="space-y-4">
                        {/* Teachers */}
                        {dryRunData.recipients.teachers.length > 0 && (
                          <div>
                            <h5 className="font-medium text-gray-900 mb-2">
                              Lehrer ({dryRunData.recipients.teachers.length})
                            </h5>
                            <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                              <div className="space-y-1">
                                {dryRunData.recipients.teachers.map((teacher, idx) => (
                                  <div
                                    key={`${teacher.email}-${teacher.eventId}-${idx}`}
                                    className="flex items-center justify-between text-sm"
                                  >
                                    <span className="text-gray-700">
                                      {teacher.name || teacher.email}
                                    </span>
                                    <span className="text-gray-400 text-xs">
                                      {teacher.email}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Parents */}
                        {dryRunData.recipients.parents.length > 0 && (
                          <div>
                            <h5 className="font-medium text-gray-900 mb-2">
                              Eltern ({dryRunData.recipients.parents.length})
                            </h5>
                            <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                              <div className="space-y-1">
                                {dryRunData.recipients.parents.map((parent, idx) => (
                                  <div
                                    key={`${parent.email}-${parent.eventId}-${idx}`}
                                    className="flex items-center justify-between text-sm"
                                  >
                                    <span className="text-gray-700">
                                      {parent.name || parent.email}
                                      {parent.childName && (
                                        <span className="text-gray-400 ml-1">
                                          (Kind: {parent.childName})
                                        </span>
                                      )}
                                    </span>
                                    <span className="text-gray-400 text-xs">
                                      {parent.email}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Modal Footer */}
              <div className="border-t border-gray-200 px-6 py-4">
                <button
                  onClick={closeDryRunModal}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
