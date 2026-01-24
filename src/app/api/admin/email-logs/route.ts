/**
 * Email Logs Admin API
 *
 * @route GET /api/admin/email-logs - List recent email logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/email-logs
 * Get recent email logs with optional filtering
 *
 * Query params:
 * - limit: number (default: 100, max: 500)
 * - eventId: string (filter by specific event)
 * - status: 'sent' | 'failed' | 'skipped' (filter by status)
 * - templateName: string (filter by template name)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const eventIdFilter = searchParams.get('eventId');
    const statusFilter = searchParams.get('status') as 'sent' | 'failed' | 'skipped' | null;
    const templateNameFilter = searchParams.get('templateName');

    const airtable = getAirtableService();

    let logs = eventIdFilter
      ? await airtable.getEmailLogsForEvent(eventIdFilter)
      : await airtable.getRecentEmailLogs(limit);

    // Apply additional filters
    if (statusFilter) {
      logs = logs.filter((log) => log.status === statusFilter);
    }

    if (templateNameFilter) {
      logs = logs.filter((log) =>
        log.templateName.toLowerCase().includes(templateNameFilter.toLowerCase())
      );
    }

    // Calculate summary statistics
    const stats = {
      total: logs.length,
      sent: logs.filter((l) => l.status === 'sent').length,
      failed: logs.filter((l) => l.status === 'failed').length,
      skipped: logs.filter((l) => l.status === 'skipped').length,
    };

    // Get unique templates and events for filtering
    const uniqueTemplates = [...new Set(logs.map((l) => l.templateName))];
    const uniqueEvents = [...new Set(logs.map((l) => l.eventId))];

    return NextResponse.json({
      success: true,
      data: {
        logs,
        stats,
        filters: {
          templates: uniqueTemplates,
          events: uniqueEvents,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching email logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch email logs' },
      { status: 500 }
    );
  }
}
