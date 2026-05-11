'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

type WindowDays = 7 | 30 | 90;
const WINDOW_OPTIONS: WindowDays[] = [7, 30, 90];
const DEFAULT_WINDOW: WindowDays = 30;

interface ByTemplateRow {
  templateName: string;
  sent: number;
  failed: number;
  skipped: number;
}

interface RecentFailure {
  id: string;
  sentAt: string;
  templateName: string;
  recipientEmail: string;
  eventId: string;
  errorMessage?: string;
}

interface StatsData {
  windowDays: number;
  totals: { sent: number; failed: number; skipped: number };
  byTemplate: ByTemplateRow[];
  recentFailures: RecentFailure[];
}

type ByTemplateSortKey = 'templateName' | 'sent' | 'failed' | 'skipped' | 'failureRate';
type SortDirection = 'asc' | 'desc';

function formatDateTime(dateStr: string): string {
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
}

function failureRate(row: ByTemplateRow): number {
  const denom = row.sent + row.failed;
  if (denom === 0) return 0;
  return (row.failed / denom) * 100;
}

export default function EmailLogsDiagnostic() {
  const [windowDays, setWindowDays] = useState<WindowDays>(DEFAULT_WINDOW);
  const [data, setData] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<ByTemplateSortKey>('sent');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const fetchStats = useCallback(async (days: WindowDays) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/email-logs/stats?days=${days}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Fehler beim Laden (HTTP ${response.status})`);
      }

      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || 'Fehler beim Laden der Statistik');
      }

      setData(payload.data as StatsData);
    } catch (err) {
      console.error('Error fetching email log stats:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Statistik');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(windowDays);
  }, [fetchStats, windowDays]);

  const handleSort = useCallback(
    (key: ByTemplateSortKey) => {
      if (sortKey === key) {
        setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        // Default direction: descending for numeric columns, ascending for text
        setSortDir(key === 'templateName' ? 'asc' : 'desc');
      }
    },
    [sortKey]
  );

  const sortedByTemplate = useMemo(() => {
    if (!data) return [];
    const rows = [...data.byTemplate];
    rows.sort((a, b) => {
      let diff: number;
      switch (sortKey) {
        case 'templateName':
          diff = a.templateName.localeCompare(b.templateName);
          break;
        case 'sent':
          diff = a.sent - b.sent;
          break;
        case 'failed':
          diff = a.failed - b.failed;
          break;
        case 'skipped':
          diff = a.skipped - b.skipped;
          break;
        case 'failureRate':
          diff = failureRate(a) - failureRate(b);
          break;
        default:
          diff = 0;
      }
      return sortDir === 'asc' ? diff : -diff;
    });
    return rows;
  }, [data, sortKey, sortDir]);

  const renderSortIndicator = (key: ByTemplateSortKey) => {
    if (sortKey !== key) return <span className="text-gray-300 ml-1">↕</span>;
    return (
      <span className="text-gray-700 ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Window selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Versand-Log Diagnose</h2>
          <p className="text-sm text-gray-500">
            Aggregierte Statistik über alle gesendeten, fehlgeschlagenen und übersprungenen E-Mails im gewählten Zeitraum.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setWindowDays(opt)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                windowDays === opt
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt} Tage
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
          <button
            onClick={() => fetchStats(windowDays)}
            className="mt-2 text-sm text-red-600 underline hover:no-underline"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : !data ? null : (
        <>
          {/* Totals cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-green-200 p-4">
              <p className="text-xs text-green-600 uppercase tracking-wide">Gesendet</p>
              <p className="mt-1 text-3xl font-semibold text-green-700">
                {data.totals.sent.toLocaleString('de-DE')}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                in den letzten {data.windowDays} Tagen
              </p>
            </div>
            <div className="bg-white rounded-lg border border-red-200 p-4">
              <p className="text-xs text-red-600 uppercase tracking-wide">Fehlgeschlagen</p>
              <p className="mt-1 text-3xl font-semibold text-red-700">
                {data.totals.failed.toLocaleString('de-DE')}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                in den letzten {data.windowDays} Tagen
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Übersprungen</p>
              <p className="mt-1 text-3xl font-semibold text-gray-700">
                {data.totals.skipped.toLocaleString('de-DE')}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Duplikat-/Filter-Checks
              </p>
            </div>
          </div>

          {/* Empty state */}
          {data.totals.sent === 0 &&
            data.totals.failed === 0 &&
            data.totals.skipped === 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
                Keine E-Mail-Aktivitäten im gewählten Zeitraum.
              </div>
            )}

          {/* By template */}
          {data.byTemplate.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Nach Vorlage
              </h3>
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          onClick={() => handleSort('templateName')}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        >
                          Vorlage{renderSortIndicator('templateName')}
                        </th>
                        <th
                          onClick={() => handleSort('sent')}
                          className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        >
                          Gesendet{renderSortIndicator('sent')}
                        </th>
                        <th
                          onClick={() => handleSort('failed')}
                          className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        >
                          Fehlgeschlagen{renderSortIndicator('failed')}
                        </th>
                        <th
                          onClick={() => handleSort('skipped')}
                          className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        >
                          Übersprungen{renderSortIndicator('skipped')}
                        </th>
                        <th
                          onClick={() => handleSort('failureRate')}
                          className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        >
                          Fehlerquote{renderSortIndicator('failureRate')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedByTemplate.map((row) => {
                        const rate = failureRate(row);
                        const rateClass =
                          rate >= 25
                            ? 'text-red-700 font-medium'
                            : rate >= 5
                            ? 'text-amber-700'
                            : 'text-gray-500';
                        return (
                          <tr key={row.templateName} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">
                              {row.templateName}
                            </td>
                            <td className="px-4 py-2 text-sm text-green-700 text-right tabular-nums">
                              {row.sent.toLocaleString('de-DE')}
                            </td>
                            <td className="px-4 py-2 text-sm text-red-700 text-right tabular-nums">
                              {row.failed.toLocaleString('de-DE')}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600 text-right tabular-nums">
                              {row.skipped.toLocaleString('de-DE')}
                            </td>
                            <td className={`px-4 py-2 text-sm text-right tabular-nums ${rateClass}`}>
                              {row.sent + row.failed === 0
                                ? '–'
                                : `${rate.toFixed(1)} %`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Recent failures */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Letzte Fehler ({data.recentFailures.length})
            </h3>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {data.recentFailures.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-gray-500">
                  Keine Fehler im gewählten Zeitraum.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Zeitpunkt
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Vorlage
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Empfänger
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Event
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fehler
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.recentFailures.map((failure) => {
                        const eventId = failure.eventId?.trim();
                        const linkable = !!eventId;
                        return (
                          <tr key={failure.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
                              {formatDateTime(failure.sentAt)}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">
                              {failure.templateName}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
                              {failure.recipientEmail}
                            </td>
                            <td className="px-4 py-2 text-sm whitespace-nowrap">
                              {linkable ? (
                                <Link
                                  href={`/admin/events/${encodeURIComponent(eventId)}`}
                                  className="text-primary hover:underline font-mono text-xs"
                                >
                                  {eventId}
                                </Link>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-red-700 break-words max-w-md">
                              {failure.errorMessage || '(keine Fehlermeldung)'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
