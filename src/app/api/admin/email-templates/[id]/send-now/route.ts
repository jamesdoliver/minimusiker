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
  eventMatchesTemplate,
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
        };

        // Check if event matches template's event type filters
        if (!eventMatchesTemplate(thresholdMatch, template)) {
          // Determine skip reason based on template filters
          let skipReason = 'Event passt nicht zu Template-Filter';
          if (template.is_kita && !event.is_kita) {
            skipReason = 'Template erfordert KiTa';
          } else if (template.is_minimusikertag && !event.is_minimusikertag) {
            skipReason = 'Template erfordert Minimusikertag';
          } else if (template.is_plus && !event.is_plus) {
            skipReason = 'Template erfordert Plus-Event';
          } else if (template.is_schulsong && !event.is_schulsong) {
            skipReason = 'Template erfordert Schulsong';
          }

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
