/**
 * Email Logs Diagnostic Stats API
 *
 * Returns aggregated EMAIL_LOGS stats over a configurable window (default 30
 * days). Powers the "Versand-Log" diagnostic tab on `/admin/emails` so admins
 * can answer "are timeline emails actually firing? are they failing? are they
 * being silently skipped by dedup?".
 *
 * @route GET /api/admin/email-logs/stats?days=30
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';
import type { EmailLog } from '@/lib/types/email-automation';

export const dynamic = 'force-dynamic';

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

interface DailyCount {
  date: string; // YYYY-MM-DD
  sent: number;
  failed: number;
  skipped: number;
}

export interface EmailLogsStatsResponse {
  windowDays: number;
  totals: { sent: number; failed: number; skipped: number };
  byTemplate: ByTemplateRow[];
  recentFailures: RecentFailure[];
  dailyCounts: DailyCount[];
}

const DEFAULT_DAYS = 30;
const ALLOWED_DAYS = [7, 30, 90] as const;
const MAX_DAYS = 90;
const RECENT_FAILURES_LIMIT = 50;

/**
 * GET /api/admin/email-logs/stats
 * Aggregate EMAIL_LOGS over the requested window.
 *
 * Query params:
 * - days: 7 | 30 | 90 (default: 30)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const rawDays = parseInt(searchParams.get('days') || String(DEFAULT_DAYS), 10);
    const windowDays = ALLOWED_DAYS.includes(rawDays as (typeof ALLOWED_DAYS)[number])
      ? rawDays
      : Math.min(Math.max(Number.isFinite(rawDays) ? rawDays : DEFAULT_DAYS, 1), MAX_DAYS);

    const airtable = getAirtableService();
    const logs = await airtable.getEmailLogsSince(windowDays);

    const totals = { sent: 0, failed: 0, skipped: 0 };
    const byTemplateMap = new Map<string, ByTemplateRow>();
    const dailyMap = new Map<string, DailyCount>();

    for (const log of logs) {
      // Totals
      if (log.status === 'sent') totals.sent += 1;
      else if (log.status === 'failed') totals.failed += 1;
      else if (log.status === 'skipped') totals.skipped += 1;

      // By-template
      const templateKey = log.templateName || '(ohne Vorlage)';
      const row = byTemplateMap.get(templateKey) ?? {
        templateName: templateKey,
        sent: 0,
        failed: 0,
        skipped: 0,
      };
      if (log.status === 'sent') row.sent += 1;
      else if (log.status === 'failed') row.failed += 1;
      else if (log.status === 'skipped') row.skipped += 1;
      byTemplateMap.set(templateKey, row);

      // Daily — bucket by YYYY-MM-DD in UTC for stable aggregation
      const dateKey = (log.sentAt || '').slice(0, 10);
      if (dateKey) {
        const daily = dailyMap.get(dateKey) ?? {
          date: dateKey,
          sent: 0,
          failed: 0,
          skipped: 0,
        };
        if (log.status === 'sent') daily.sent += 1;
        else if (log.status === 'failed') daily.failed += 1;
        else if (log.status === 'skipped') daily.skipped += 1;
        dailyMap.set(dateKey, daily);
      }
    }

    // Sort by-template by total volume desc, then by name asc
    const byTemplate = Array.from(byTemplateMap.values()).sort((a, b) => {
      const totalA = a.sent + a.failed + a.skipped;
      const totalB = b.sent + b.failed + b.skipped;
      if (totalB !== totalA) return totalB - totalA;
      return a.templateName.localeCompare(b.templateName);
    });

    // Recent failures: chronological (newest first), capped at 50
    const recentFailures: RecentFailure[] = logs
      .filter((l: EmailLog) => l.status === 'failed')
      .sort((a, b) => (b.sentAt || '').localeCompare(a.sentAt || ''))
      .slice(0, RECENT_FAILURES_LIMIT)
      .map((l) => ({
        id: l.id,
        sentAt: l.sentAt,
        templateName: l.templateName,
        recipientEmail: l.recipientEmail,
        eventId: l.eventId,
        errorMessage: l.errorMessage,
      }));

    // Daily counts: ascending by date
    const dailyCounts = Array.from(dailyMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const responseData: EmailLogsStatsResponse = {
      windowDays,
      totals,
      byTemplate,
      recentFailures,
      dailyCounts,
    };

    return NextResponse.json({ success: true, data: responseData });
  } catch (error) {
    console.error('Error computing email log stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to compute email log stats' },
      { status: 500 }
    );
  }
}
