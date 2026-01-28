/**
 * Send Now API
 *
 * @route POST /api/admin/email-templates/[id]/send-now
 *
 * Immediately sends a template to all matching recipients for the selected events.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';
import {
  getRecipientsForEvent,
  sendAutomatedEmail,
} from '@/lib/services/emailAutomationService';
import { EventThresholdMatch } from '@/lib/types/email-automation';

export const dynamic = 'force-dynamic';

const RATE_LIMIT_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function daysBetween(date1: Date, date2: Date): number {
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await request.json();
    const { eventIds } = body as { eventIds: string[] };

    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'eventIds array is required' },
        { status: 400 }
      );
    }

    const airtable = getAirtableService();
    const template = await airtable.getEmailTemplateById(id);

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const details: Array<{ eventId: string; email: string; status: string; error?: string }> = [];

    for (const eventId of eventIds) {
      const event = await airtable.getEventByEventId(eventId);
      if (!event) {
        details.push({ eventId, email: '', status: 'failed', error: 'Event not found' });
        failed++;
        continue;
      }

      const eventDate = new Date(event.event_date);
      const thresholdMatch: EventThresholdMatch = {
        eventId: event.event_id,
        eventRecordId: event.id,
        schoolName: event.school_name,
        eventDate: event.event_date,
        eventType: event.is_kita ? 'KiTa' : 'Schule',
        daysUntilEvent: daysBetween(today, eventDate),
        accessCode: event.access_code,
        isKita: event.is_kita,
      };

      const recipients = await getRecipientsForEvent(
        event.event_id,
        event.id,
        thresholdMatch,
        template.audience
      );

      for (const recipient of recipients) {
        const result = await sendAutomatedEmail(template, recipient);
        details.push({
          eventId: event.event_id,
          email: recipient.email,
          status: result.success ? 'sent' : result.error === 'Already sent' ? 'skipped' : 'failed',
          error: result.error,
        });

        if (result.success) {
          sent++;
        } else if (result.error === 'Already sent') {
          skipped++;
        } else {
          failed++;
        }

        await sleep(RATE_LIMIT_DELAY_MS);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: { sent, failed, skipped },
        details,
      },
    });
  } catch (error) {
    console.error('Error in send-now:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send emails' },
      { status: 500 }
    );
  }
}
