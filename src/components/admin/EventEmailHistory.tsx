'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EmailLog } from '@/lib/types/email-automation';

interface EventEmailHistoryProps {
  eventId: string;
}

type StatusFilter = 'all' | 'sent' | 'failed' | 'skipped';

const STATUS_LABEL: Record<EmailLog['status'], string> = {
  sent: 'Gesendet',
  failed: 'Fehlgeschlagen',
  skipped: 'Übersprungen',
};

const STATUS_BADGE: Record<EmailLog['status'], string> = {
  sent: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  skipped: 'bg-gray-100 text-gray-700',
};

const RECIPIENT_LABEL: Record<EmailLog['recipientType'], string> = {
  teacher: 'Lehrer',
  parent: 'Eltern',
  'non-buyer': 'Non-Buyer',
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function EventEmailHistory({ eventId }: EventEmailHistoryProps) {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(
        `/api/admin/email-logs?eventId=${encodeURIComponent(eventId)}`,
        { credentials: 'include' }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Failed to load logs');
      setLogs(data.data.logs as EmailLog[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const counts = useMemo(() => ({
    total: logs.length,
    sent: logs.filter((l) => l.status === 'sent').length,
    failed: logs.filter((l) => l.status === 'failed').length,
    skipped: logs.filter((l) => l.status === 'skipped').length,
  }), [logs]);

  const filteredLogs = useMemo(() => (
    statusFilter === 'all' ? logs : logs.filter((l) => l.status === statusFilter)
  ), [logs, statusFilter]);

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">E-Mail-Verlauf</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Alle Timeline-E-Mails (Email-Logs) für diese Veranstaltung
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={isLoading}
          className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
        >
          ↻ Aktualisieren
        </button>
      </div>

      {/* Stat chips + status filter */}
      <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
        {(['all', 'sent', 'failed', 'skipped'] as StatusFilter[]).map((s) => {
          const label = s === 'all' ? 'Alle' : STATUS_LABEL[s as EmailLog['status']];
          const count = s === 'all' ? counts.total : counts[s];
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                active
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="max-h-[420px] overflow-y-auto">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-gray-500">Lädt...</div>
        ) : error ? (
          <div className="py-6 px-4 text-sm text-red-700 bg-red-50">
            Fehler beim Laden: {error}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">
            {logs.length === 0
              ? 'Noch keine E-Mails für diese Veranstaltung protokolliert.'
              : 'Keine Einträge im gewählten Filter.'}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase text-gray-500 tracking-wider">
                  Zeitpunkt
                </th>
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase text-gray-500 tracking-wider">
                  Vorlage
                </th>
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase text-gray-500 tracking-wider">
                  Empfänger
                </th>
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase text-gray-500 tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                    {formatDateTime(log.sentAt)}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-900">
                    {log.templateName}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">
                    <span className="text-gray-400 mr-1">
                      [{RECIPIENT_LABEL[log.recipientType]}]
                    </span>
                    {log.recipientEmail}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_BADGE[log.status]}`}
                      title={log.errorMessage || undefined}
                    >
                      {STATUS_LABEL[log.status]}
                    </span>
                    {log.status === 'failed' && log.errorMessage && (
                      <div className="text-[10px] text-red-600 mt-0.5 max-w-xs truncate" title={log.errorMessage}>
                        {log.errorMessage}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
