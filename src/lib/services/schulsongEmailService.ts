/**
 * Shared helper for sending schulsong release emails.
 *
 * Used by:
 * - Admin instant-approve (fires immediately)
 * - Cron auto-fire (fires at scheduled release time)
 */

import { Resend } from 'resend';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherRecipientsForEvent, getParentRecipientsForEvent, sleep } from '@/lib/services/emailAutomationService';
import {
  getTriggerTemplate,
  renderTriggerTemplate,
  renderFullTriggerEmail,
} from '@/lib/services/triggerTemplateService';
import { getRegistryEntry } from '@/lib/config/trigger-email-registry';
import { generateUnsubscribeUrl } from '@/lib/utils/unsubscribe';
import { EventThresholdMatch, CreateEmailLogInput } from '@/lib/types/email-automation';
import { parseOverrides, getThreshold, EventTimelineOverrides } from '@/lib/utils/eventThresholds';

const SLUG = 'schulsong_audio_release';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@minimusiker.app';
const FROM_NAME = 'Minimusiker';
const RATE_LIMIT_DELAY_MS = 500;

/**
 * Send schulsong release emails to all teacher recipients for an event.
 * Deduplication via EMAIL_LOGS prevents double-sends.
 */
export async function sendSchulsongReleaseEmailForEvent(
  eventId: string
): Promise<{ sent: number; skipped: number; failed: number }> {
  const airtable = getAirtableService();
  const event = await airtable.getEventByEventId(eventId);

  if (!event) {
    console.error(`[SchulsongEmail] Event not found: ${eventId}`);
    return { sent: 0, skipped: 0, failed: 0 };
  }

  const entry = getRegistryEntry(SLUG);
  if (!entry) {
    console.error(`[SchulsongEmail] Registry entry not found: ${SLUG}`);
    return { sent: 0, skipped: 0, failed: 0 };
  }

  const trigger = await getTriggerTemplate(SLUG);
  if (!trigger.active) {
    console.log(`[SchulsongEmail] Template disabled, skipping: ${SLUG}`);
    return { sent: 0, skipped: 0, failed: 0 };
  }

  // Build EventThresholdMatch for getTeacherRecipientsForEvent
  const eventData: EventThresholdMatch = {
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
    isUnder100: event.is_under_100,
  };

  const recipients = await getTeacherRecipientsForEvent(event.event_id, event.id, eventData);

  // Build template variables (matching send-now's buildTriggerVariables)
  const variables: Record<string, string> = {
    schoolName: event.school_name,
  };

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const recipient of recipients) {
    // Dedup check
    const alreadySent = await airtable.hasEmailBeenSent(
      entry.name,
      recipient.eventId,
      recipient.email
    );
    if (alreadySent) {
      skipped++;
      continue;
    }

    // Render template
    const subject = renderTriggerTemplate(trigger.subject, variables);
    const html = renderFullTriggerEmail(trigger.bodyHtml, variables);

    // Send
    let sendStatus: 'sent' | 'failed' = 'sent';
    let errorMessage: string | undefined;
    let resendMessageId: string | undefined;

    if (!process.env.RESEND_API_KEY) {
      console.log(`[SchulsongEmail] (dev) To: ${recipient.email}, Subject: ${subject}`);
      resendMessageId = 'dev-mode';
    } else {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { data, error } = await resend.emails.send({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: recipient.email,
          subject,
          html,
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

    // Rate limiting
    await sleep(RATE_LIMIT_DELAY_MS);
  }

  console.log(`[SchulsongEmail] ${eventId}: ${sent} sent, ${failed} failed, ${skipped} skipped`);
  return { sent, skipped, failed };
}

// ─── Parent Release Email ──────────────────────────────────────────

const PARENT_SLUG = 'schulsong_parent_release';

function computeMerchandiseDeadline(eventDate: string, overrides?: EventTimelineOverrides | null): string {
  const date = new Date(eventDate);
  const days = getThreshold('merchandise_deadline_days', overrides);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Send schulsong release emails to all parent recipients for an event.
 * Deduplication via EMAIL_LOGS prevents double-sends.
 */
export async function sendSchulsongParentReleaseEmailForEvent(
  eventId: string
): Promise<{ sent: number; skipped: number; failed: number }> {
  const airtable = getAirtableService();
  const event = await airtable.getEventByEventId(eventId);

  if (!event) {
    console.error(`[SchulsongParentEmail] Event not found: ${eventId}`);
    return { sent: 0, skipped: 0, failed: 0 };
  }

  const entry = getRegistryEntry(PARENT_SLUG);
  if (!entry) {
    console.error(`[SchulsongParentEmail] Registry entry not found: ${PARENT_SLUG}`);
    return { sent: 0, skipped: 0, failed: 0 };
  }

  const trigger = await getTriggerTemplate(PARENT_SLUG);
  if (!trigger.active) {
    console.log(`[SchulsongParentEmail] Template disabled, skipping: ${PARENT_SLUG}`);
    return { sent: 0, skipped: 0, failed: 0 };
  }

  // Build EventThresholdMatch for getParentRecipientsForEvent
  const eventData: EventThresholdMatch = {
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
    isUnder100: event.is_under_100,
  };

  const recipients = await getParentRecipientsForEvent(event.event_id, event.id, eventData);

  // Build template variables
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app';
  const eventLink = event.access_code
    ? `${baseUrl}/e/${event.access_code}`
    : `${baseUrl}/parent`;

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const recipient of recipients) {
    // Dedup check
    const alreadySent = await airtable.hasEmailBeenSent(
      entry.name,
      recipient.eventId,
      recipient.email
    );
    if (alreadySent) {
      skipped++;
      continue;
    }

    // Per-recipient variables (parentName varies per recipient)
    const variables: Record<string, string> = {
      schoolName: event.school_name,
      eventLink,
      parentPortalLink: `${baseUrl}/familie`,
      parentName: recipient.name || '',
      merchandiseDeadline: computeMerchandiseDeadline(event.event_date, parseOverrides(event.timeline_overrides)),
    };

    // Render template (with unsubscribe for parent recipients)
    const unsubscribeUrl = generateUnsubscribeUrl(recipient.email);
    const subject = renderTriggerTemplate(trigger.subject, variables);
    const html = renderFullTriggerEmail(trigger.bodyHtml, variables, {
      showUnsubscribe: true,
      unsubscribeUrl,
    });

    // Send
    let sendStatus: 'sent' | 'failed' = 'sent';
    let errorMessage: string | undefined;
    let resendMessageId: string | undefined;

    if (!process.env.RESEND_API_KEY) {
      console.log(`[SchulsongParentEmail] (dev) To: ${recipient.email}, Subject: ${subject}`);
      resendMessageId = 'dev-mode';
    } else {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { data, error } = await resend.emails.send({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: recipient.email,
          subject,
          html,
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
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

    // Rate limiting
    await sleep(RATE_LIMIT_DELAY_MS);
  }

  console.log(`[SchulsongParentEmail] ${eventId}: ${sent} sent, ${failed} failed, ${skipped} skipped`);
  return { sent, skipped, failed };
}
