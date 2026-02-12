/**
 * Trigger Email Send-Now API
 *
 * @route GET  /api/admin/trigger-templates/[slug]/send-now - List eligible events
 * @route POST /api/admin/trigger-templates/[slug]/send-now - Preview or send
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getRegistryEntry } from '@/lib/config/trigger-email-registry';
import { getAirtableService } from '@/lib/services/airtableService';
import {
  getTeacherRecipientsForEvent,
  getParentRecipientsForEvent,
  sleep,
} from '@/lib/services/emailAutomationService';
import {
  getTriggerTemplate,
  renderTriggerTemplate,
  renderFullTriggerEmail,
} from '@/lib/services/triggerTemplateService';
import { Event } from '@/lib/types/airtable';
import { parseOverrides, getThreshold } from '@/lib/utils/eventThresholds';
import { EventThresholdMatch, CreateEmailLogInput } from '@/lib/types/email-automation';
import { Resend } from 'resend';
import { generateUnsubscribeUrl } from '@/lib/utils/unsubscribe';

export const dynamic = 'force-dynamic';

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@minimusiker.app';
const FROM_NAME = 'Minimusiker';
const RATE_LIMIT_DELAY_MS = 500;

// ─── Helpers ─────────────────────────────────────────────────────────

function getEligibleEvents(filterName: string, allEvents: Event[]): Event[] {
  switch (filterName) {
    case 'schulsong_approved':
      return allEvents.filter(
        (e) => e.is_schulsong && e.admin_approval_status === 'approved'
      );
    case 'schulsong_events':
      return allEvents.filter((e) => e.is_schulsong);
    case 'all_events':
      return allEvents;
    default:
      return [];
  }
}

function eventToThresholdMatch(event: Event): EventThresholdMatch {
  return {
    eventId: event.event_id,
    eventRecordId: event.id,
    schoolName: event.school_name,
    eventDate: event.event_date,
    eventType: event.is_kita ? 'KiTa' : 'Schule',
    daysUntilEvent: 0,
    accessCode: event.access_code,
    isKita: event.is_kita,
    isMinimusikertag: event.is_minimusikertag,
    isPlus: event.is_plus,
    isSchulsong: event.is_schulsong,
  };
}

function buildTriggerVariables(
  slug: string,
  event: Event,
): Record<string, string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app';
  const eventLink = event.access_code
    ? `${baseUrl}/e/${event.access_code}`
    : `${baseUrl}/parent`;

  switch (slug) {
    case 'schulsong_audio_release':
      return {
        schoolName: event.school_name,
      };
    case 'schulsong_parent_release':
      return {
        schoolName: event.school_name,
        eventLink,
        parentPortalLink: `${baseUrl}/familie`,
        parentName: '',
        merchandiseDeadline: computeMerchandiseDeadline(event),
      };
    default:
      return { schoolName: event.school_name };
  }
}

function computeMerchandiseDeadline(event: Event): string {
  const date = new Date(event.event_date);
  const overrides = parseOverrides(event.timeline_overrides);
  const days = getThreshold('merchandise_deadline_days', overrides);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateGerman(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ─── GET: List eligible events ───────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    const entry = getRegistryEntry(slug);

    if (!entry?.sendNow) {
      return NextResponse.json(
        { success: false, error: 'This trigger does not support Send Now' },
        { status: 404 }
      );
    }

    const airtable = getAirtableService();
    const allEvents = await airtable.getAllEvents();
    const eligible = getEligibleEvents(entry.sendNow.eventFilter, allEvents);

    const events = eligible.map((e) => ({
      eventId: e.event_id,
      eventRecordId: e.id,
      schoolName: e.school_name,
      eventDate: e.event_date,
    }));

    return NextResponse.json({ success: true, data: { events } });
  } catch (error) {
    console.error('Error fetching eligible events:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch eligible events' },
      { status: 500 }
    );
  }
}

// ─── POST: Preview or send ──────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    const entry = getRegistryEntry(slug);

    if (!entry?.sendNow) {
      return NextResponse.json(
        { success: false, error: 'This trigger does not support Send Now' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { eventIds, preview = false, forceResend = false } = body as {
      eventIds: string[];
      preview?: boolean;
      forceResend?: boolean;
    };

    if (!eventIds || eventIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No event IDs provided' },
        { status: 400 }
      );
    }

    const airtable = getAirtableService();
    const allEvents = await airtable.getAllEvents();
    const eligible = getEligibleEvents(entry.sendNow.eventFilter, allEvents);
    const eligibleMap = new Map(eligible.map((e) => [e.event_id, e]));

    // Validate selected events are eligible
    const selectedEvents: Event[] = [];
    for (const eventId of eventIds) {
      const event = eligibleMap.get(eventId);
      if (!event) {
        return NextResponse.json(
          { success: false, error: `Event ${eventId} is not eligible` },
          { status: 400 }
        );
      }
      selectedEvents.push(event);
    }

    // ── Preview mode ──
    if (preview) {
      const previewResults = [];

      for (const event of selectedEvents) {
        const eventData = eventToThresholdMatch(event);
        const recipients = entry.sendNow.recipientResolver === 'event_teacher'
          ? await getTeacherRecipientsForEvent(event.event_id, event.id, eventData)
          : await getParentRecipientsForEvent(event.event_id, event.id, eventData);

        previewResults.push({
          eventId: event.event_id,
          schoolName: event.school_name,
          eventDate: event.event_date,
          recipients: recipients.map((r) => ({ email: r.email, name: r.name || '' })),
        });
      }

      return NextResponse.json({ success: true, data: { events: previewResults } });
    }

    // ── Send mode ──
    const trigger = await getTriggerTemplate(slug);
    if (!trigger.active) {
      return NextResponse.json(
        { success: false, error: 'This trigger template is currently disabled' },
        { status: 400 }
      );
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const details: Array<{
      eventId: string;
      email: string;
      status: 'sent' | 'failed' | 'skipped';
      error?: string;
    }> = [];

    for (const event of selectedEvents) {
      const eventData = eventToThresholdMatch(event);
      const recipients = entry.sendNow.recipientResolver === 'event_teacher'
        ? await getTeacherRecipientsForEvent(event.event_id, event.id, eventData)
        : await getParentRecipientsForEvent(event.event_id, event.id, eventData);

      const variables = buildTriggerVariables(slug, event);

      for (const recipient of recipients) {
        // Dedup check
        if (!forceResend) {
          const alreadySent = await airtable.hasEmailBeenSent(
            entry.name,
            recipient.eventId,
            recipient.email
          );
          if (alreadySent) {
            skipped++;
            details.push({ eventId: event.event_id, email: recipient.email, status: 'skipped' });
            continue;
          }
        }

        // Render template (with unsubscribe for parent recipients)
        const isParent = recipient.type === 'parent' || recipient.type === 'non-buyer';
        const unsubscribeUrl = isParent ? generateUnsubscribeUrl(recipient.email) : undefined;
        const subject = renderTriggerTemplate(trigger.subject, variables);
        const html = renderFullTriggerEmail(trigger.bodyHtml, variables,
          isParent && unsubscribeUrl ? { showUnsubscribe: true, unsubscribeUrl } : undefined
        );

        // Send
        let sendStatus: 'sent' | 'failed' = 'sent';
        let errorMessage: string | undefined;
        let resendMessageId: string | undefined;

        if (!process.env.RESEND_API_KEY) {
          console.log(`[SendNow] (dev) To: ${recipient.email}, Subject: ${subject}`);
          resendMessageId = 'dev-mode';
        } else {
          try {
            const resend = new Resend(process.env.RESEND_API_KEY);
            const { data, error } = await resend.emails.send({
              from: `${FROM_NAME} <${FROM_EMAIL}>`,
              to: recipient.email,
              subject,
              html,
              headers: isParent && unsubscribeUrl ? {
                'List-Unsubscribe': `<${unsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              } : undefined,
            });

            if (error) {
              sendStatus = 'failed';
              errorMessage = error.message;
            } else {
              resendMessageId = data?.id;
            }
          } catch (err) {
            sendStatus = 'failed';
            errorMessage = err instanceof Error ? err.message : 'Unknown error';
          }
        }

        // Log to EMAIL_LOGS
        const logInput: CreateEmailLogInput = {
          templateName: entry.name,
          eventId: recipient.eventId,
          recipientEmail: recipient.email,
          recipientType: recipient.type,
          status: sendStatus,
          errorMessage,
          resendMessageId,
        };
        await airtable.createEmailLog(logInput);

        if (sendStatus === 'sent') {
          sent++;
        } else {
          failed++;
        }
        details.push({
          eventId: event.event_id,
          email: recipient.email,
          status: sendStatus,
          error: errorMessage,
        });

        // Rate limiting
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    }

    console.log(`[SendNow] ${slug}: ${sent} sent, ${failed} failed, ${skipped} skipped`);

    return NextResponse.json({
      success: true,
      data: { sent, failed, skipped, details },
    });
  } catch (error) {
    console.error('Error in send-now:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process send-now request' },
      { status: 500 }
    );
  }
}
