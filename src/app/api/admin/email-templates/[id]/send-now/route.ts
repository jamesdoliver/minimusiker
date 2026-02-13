/**
 * Send Now API
 *
 * @route POST /api/admin/email-templates/[id]/send-now
 *
 * Immediately sends a template to all matching recipients for the selected events.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import {
  getRecipientsForEvent,
  sendAutomatedEmail,
  eventMatchesTemplate,
  getEventTier,
  getTemplateTier,
  daysBetween,
  sleep,
} from '@/lib/services/emailAutomationService';
import { EventThresholdMatch, EventTier } from '@/lib/types/email-automation';

export const dynamic = 'force-dynamic';

const RATE_LIMIT_DELAY_MS = 500;

// Preview response types
interface PreviewEventRecipients {
  teachers: Array<{ email: string; name?: string }>;
  parents: Array<{ email: string; name?: string; childName?: string }>;
  nonBuyers: Array<{ email: string; name?: string; childName?: string }>;
}

interface PreviewEvent {
  eventId: string;
  schoolName: string;
  eventDate: string;
  skipped: boolean;
  skipReason?: string;
  recipients: PreviewEventRecipients;
}

interface PreviewSummary {
  totalRecipients: number;
  teacherCount: number;
  parentCount: number;
  nonBuyerCount: number;
  skippedEvents: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { eventIds, preview, forceResend } = body as { eventIds: string[]; preview?: boolean; forceResend?: boolean };

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

    // Use Berlin timezone for date computation (consistent with cron automation)
    const berlinFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin',
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const todayBerlinStr = berlinFormatter.format(new Date());
    const [y, m, d] = todayBerlinStr.split('-').map(Number);
    const today = new Date(Date.UTC(y, m - 1, d));

    // Preview mode: gather recipients without sending
    if (preview) {
      const previewEvents: PreviewEvent[] = [];
      let totalTeachers = 0;
      let totalParents = 0;
      let totalNonBuyers = 0;
      let skippedEvents = 0;

      for (const eventId of eventIds) {
        const event = await airtable.getEventByEventId(eventId);
        if (!event) {
          previewEvents.push({
            eventId,
            schoolName: 'Unbekannt',
            eventDate: '',
            skipped: true,
            skipReason: 'Event nicht gefunden',
            recipients: { teachers: [], parents: [], nonBuyers: [] },
          });
          skippedEvents++;
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
          isMinimusikertag: event.is_minimusikertag,
          isPlus: event.is_plus,
          isSchulsong: event.is_schulsong,
          isUnder100: event.is_under_100,
        };

        // Check if event matches template's tier (exact match)
        if (!eventMatchesTemplate(thresholdMatch, template)) {
          const tierLabels: Record<EventTier, string> = { plus: 'PLUS', minimusikertag: 'Minimusikertag', schulsong: 'Schulsong' };
          const eventTier = getEventTier(thresholdMatch);
          const templateTier = getTemplateTier(template);
          const skipReason = `Event ist ${tierLabels[eventTier]}, Template erfordert ${tierLabels[templateTier]}`;

          previewEvents.push({
            eventId: event.event_id,
            schoolName: event.school_name,
            eventDate: event.event_date,
            skipped: true,
            skipReason,
            recipients: { teachers: [], parents: [], nonBuyers: [] },
          });
          skippedEvents++;
          continue;
        }

        const recipients = await getRecipientsForEvent(
          event.event_id,
          event.id,
          thresholdMatch,
          template.audience
        );

        const eventRecipients: PreviewEventRecipients = {
          teachers: [],
          parents: [],
          nonBuyers: [],
        };

        for (const recipient of recipients) {
          if (recipient.type === 'teacher') {
            eventRecipients.teachers.push({
              email: recipient.email,
              name: recipient.name,
            });
            totalTeachers++;
          } else if (recipient.type === 'non-buyer') {
            eventRecipients.nonBuyers.push({
              email: recipient.email,
              name: recipient.name,
              childName: recipient.templateData?.child_name,
            });
            totalNonBuyers++;
          } else {
            eventRecipients.parents.push({
              email: recipient.email,
              name: recipient.name,
              childName: recipient.templateData?.child_name,
            });
            totalParents++;
          }
        }

        previewEvents.push({
          eventId: event.event_id,
          schoolName: event.school_name,
          eventDate: event.event_date,
          skipped: false,
          recipients: eventRecipients,
        });
      }

      const summary: PreviewSummary = {
        totalRecipients: totalTeachers + totalParents + totalNonBuyers,
        teacherCount: totalTeachers,
        parentCount: totalParents,
        nonBuyerCount: totalNonBuyers,
        skippedEvents,
      };

      return NextResponse.json({
        success: true,
        data: {
          preview: true,
          events: previewEvents,
          summary,
        },
      });
    }

    // Send mode: actually send emails
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
        isMinimusikertag: event.is_minimusikertag,
        isPlus: event.is_plus,
        isSchulsong: event.is_schulsong,
        isUnder100: event.is_under_100,
      };

      // Check if event matches template's event type filters
      if (!eventMatchesTemplate(thresholdMatch, template)) {
        skipped++;
        continue;
      }

      const recipients = await getRecipientsForEvent(
        event.event_id,
        event.id,
        thresholdMatch,
        template.audience
      );

      for (const recipient of recipients) {
        const result = await sendAutomatedEmail(template, recipient, { skipDuplicateCheck: forceResend });
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
