'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { EmailTemplate, EmailLog } from '@/lib/types/email-automation';

interface TemplatesData {
  templates: EmailTemplate[];
  grouped: {
    teacher: EmailTemplate[];
    parent: EmailTemplate[];
    both: EmailTemplate[];
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

interface DryRunData {
  template: {
    id: string;
    name: string;
    triggerDays: number;
    audience: 'teacher' | 'parent' | 'both';
  };
  matchingEvents: DryRunEventMatch[];
  recipients: {
    teachers: DryRunTeacherRecipient[];
    parents: DryRunParentRecipient[];
  };
  summary: {
    totalEvents: number;
    totalRecipients: number;
    teacherCount: number;
    parentCount: number;
  };
}

export default function AdminEmails() {
  const [templatesData, setTemplatesData] = useState<TemplatesData | null>(null);
  const [logsData, setLogsData] = useState<LogsData | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'teacher' | 'parent' | 'all'>('all');
  const [dryRunData, setDryRunData] = useState<DryRunData | null>(null);
  const [isDryRunLoading, setIsDryRunLoading] = useState(false);
  const [isDryRunModalOpen, setIsDryRunModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoadingLogs(true);
      const response = await fetch('/api/admin/email-logs?limit=50', {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch logs');
      }

      const data = await response.json();
      if (data.success) {
        setLogsData(data.data);
      } else {
        throw new Error(data.error || 'Failed to load logs');
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
      // Don't set error for logs - templates are primary
    } finally {
      setIsLoadingLogs(false);
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

  useEffect(() => {
    fetchTemplates();
    fetchLogs();
  }, [fetchTemplates, fetchLogs]);

  const getFilteredTemplates = () => {
    if (!templatesData) return [];
    if (activeTab === 'all') return templatesData.templates;
    return templatesData.templates.filter(
      (t) => t.audience === activeTab || t.audience === 'both'
    );
  };

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

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'all', label: 'Alle Vorlagen' },
            { key: 'teacher', label: 'Lehrer' },
            { key: 'parent', label: 'Eltern' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'all' | 'teacher' | 'parent')}
              className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {templatesData && (
                <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-gray-100">
                  {tab.key === 'all'
                    ? templatesData.total
                    : tab.key === 'teacher'
                    ? templatesData.grouped.teacher.length
                    : templatesData.grouped.parent.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Templates Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoadingTemplates ? (
          <div className="col-span-full flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : getFilteredTemplates().length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            Keine Vorlagen gefunden
          </div>
        ) : (
          getFilteredTemplates().map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <Link
                href={`/admin/emails/${template.id}`}
                className="block"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {template.name}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">
                      {template.audience === 'teacher' && 'Lehrer'}
                      {template.audience === 'parent' && 'Eltern'}
                      {template.audience === 'both' && 'Lehrer & Eltern'}
                      {' | '}
                      {formatTriggerDays(template.triggerDays)}
                    </p>
                  </div>
                  <span
                    className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      template.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {template.active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-600 truncate">
                  Betreff: {template.subject}
                </p>
              </Link>
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    fetchDryRun(template.id);
                  }}
                  className="text-xs text-primary hover:text-primary/80 font-medium"
                >
                  Dry Run
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeleteConfirmId(template.id);
                  }}
                  className="text-xs text-red-600 hover:text-red-800 font-medium"
                >
                  Löschen
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recent Logs Section */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Letzte Aktivitäten
        </h2>

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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
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
                  {logsData?.logs.slice(0, 10).map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
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
                        {dryRunData.template.audience === 'teacher' && 'Lehrer'}
                        {dryRunData.template.audience === 'parent' && 'Eltern'}
                        {dryRunData.template.audience === 'both' && 'Lehrer & Eltern'}
                      </p>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-4 gap-3">
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
