/**
 * Shared helper for sending schulsong release emails.
 *
 * Used by:
 * - Admin instant-approve (fires immediately)
 * - Cron auto-fire (fires at scheduled release time)
 */

import { Resend } from 'resend';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherRecipientsForEvent, sleep } from '@/lib/services/emailAutomationService';
import {
  getTriggerTemplate,
  renderTriggerTemplate,
  renderFullTriggerEmail,
} from '@/lib/services/triggerTemplateService';
import { getRegistryEntry } from '@/lib/config/trigger-email-registry';
import { EventThresholdMatch, CreateEmailLogInput } from '@/lib/types/email-automation';

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
  };

  const recipients = await getTeacherRecipientsForEvent(event.event_id, event.id, eventData);

  // Build template variables (matching send-now's buildTriggerVariables)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app';
  const eventLink = event.access_code
    ? `${baseUrl}/e/${event.access_code}`
    : `${baseUrl}/parent`;
  const variables: Record<string, string> = {
    schoolName: event.school_name,
    eventLink,
    parentPortalLink: `${baseUrl}/familie`,
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
