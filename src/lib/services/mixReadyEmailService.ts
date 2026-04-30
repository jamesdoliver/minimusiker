import { Resend } from 'resend';
import type { Event } from '@/lib/types/airtable';
import { parseOverrides } from '@/lib/utils/eventThresholds';
import { getAirtableService } from '@/lib/services/airtableService';
import {
  getEventTier,
  getTeacherRecipientsForEvent,
  getParentRecipientsForEvent,
  sleep,
} from '@/lib/services/emailAutomationService';
import {
  getTriggerTemplate,
  renderTriggerTemplate,
  renderFullTriggerEmail,
} from '@/lib/services/triggerTemplateService';
import { getRegistryEntry } from '@/lib/config/trigger-email-registry';
import { hasAudioPurchaseForEvent } from '@/lib/utils/audioPurchaseAccess';
import { generateUnsubscribeUrl } from '@/lib/utils/unsubscribe';
import type {
  EventThresholdMatch,
  CreateEmailLogInput,
  EmailRecipient,
} from '@/lib/types/email-automation';

/**
 * Snapshot of events that were ALREADY in `audio_pipeline_stage='finals_submitted'`
 * when this trigger pipeline launched (audited 2026-04-30). Their parents have
 * never received a mix-ready email under any system (the legacy timeline templates
 * never fired in production), so flipping the trigger on without a guard would
 * blast ~1,300 parents with notifications about events that happened 1-2 months ago.
 *
 * The skip is by event_id, which means: even if these events get re-uploaded or
 * status-changed, they will continue to be excluded. That's the correct behaviour
 * for "from today onwards" semantics — we are explicitly excluding the existing
 * backlog. New events that *enter* finals_submitted after launch are unaffected
 * and fire normally.
 *
 * Safe to remove this constant once all 12 events have aged out (i.e. no longer
 * in finals_submitted, e.g. the admin marked them done or the data was archived).
 */
export const MIX_READY_PRE_LAUNCH_SKIP: ReadonlySet<string> = new Set([
  'evt_drk_kindergarten_am_postweg_minimusiker_20260422_53ce38',
  'evt_drk_kindertageseinrichtung_zwe_minimusiker_20260311_b9d3b6',
  'evt_fuchshofschule_minimusiker_20260319_f7041a',
  'evt_grundschule_am_r_merbad_zunzwe_minimusiker_20260302_1afb54',
  'evt_grundschule_nordstadt_minimusiker_20260309_0fcf5b',
  'evt_grundschule_s_dstadt_minimusiker_20260417_3b5e82',
  'evt_grundschule_sundheim_minimusiker_20260313_c0ca18',
  'evt_grundschule_unterharmersbach_minimusiker_20260306_583f43',
  'evt_heier_grundschule_minimusiker_20260324_988e38',
  'evt_kita_zum_regenbogen_r_hen_minimusiker_20260304_a618fc',
  'evt_otto_willmann_schule_minimusiker_20260126_8d295e',
  'evt_sterfeldschule_minimusiker_20260318_5104a0',
]);

export function isMixReadyForEvent(event: Event): boolean {
  // Pre-launch backlog skip: events that were already finals_submitted when this
  // trigger pipeline went live are explicitly excluded so we don't mass-email
  // parents about old events.
  if (MIX_READY_PRE_LAUNCH_SKIP.has(event.event_id)) return false;

  // Tier check — Mimi/Plus only. Pure schulsong-only is handled by the
  // existing schulsong_release trigger.
  const tier = getEventTier({
    isMinimusikertag: event.is_minimusikertag,
    isPlus: event.is_plus,
    isSchulsong: event.is_schulsong,
    eventId: event.event_id,
    schoolName: event.school_name,
  });
  if (tier !== 'minimusikertag' && tier !== 'plus') return false;

  if (event.status === 'Cancelled' || event.status === 'Deleted') return false;

  if (event.audio_pipeline_stage !== 'finals_submitted') return false;

  // For schulsong-appended events, teacher must have approved schulsong
  // (the approve route writes schulsong_released_at to a non-null value).
  if (event.is_schulsong && !event.schulsong_released_at) return false;

  const overrides = parseOverrides(event.timeline_overrides);
  if (overrides?.audio_hidden === true) return false;
  if (overrides?.communications_paused === true) return false;

  return true;
}

const TEACHER_SLUG = 'teacher_mix_ready';
const PARENT_BUYER_SLUG = 'parent_mix_ready_audio_buyer';
const PARENT_NON_BUYER_SLUG = 'parent_mix_ready_non_audio_buyer';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@minimusiker.app';
const FROM_NAME = 'Minimusiker';
const RATE_LIMIT_DELAY_MS = 500;

interface SendCounters { sent: number; skipped: number; failed: number; }

function buildVariables(recipient: EmailRecipient, schoolName: string, parentPortalLink: string) {
  return {
    schoolName,
    eventDate: (recipient.templateData?.event_date as string) || '',
    parentName: (recipient.templateData?.parent_name as string) || '',
    parentFirstName: (recipient.templateData?.parent_first_name as string) || '',
    childName: (recipient.templateData?.child_name as string) || '',
    className: (recipient.templateData?.class_name as string) || '',
    parentPortalLink,
  };
}

async function sendOne(
  slug: string,
  recipient: EmailRecipient,
  variables: Record<string, string>,
  counters: SendCounters
): Promise<void> {
  const airtable = getAirtableService();
  const entry = getRegistryEntry(slug);
  if (!entry) { counters.failed++; return; }

  const trigger = await getTriggerTemplate(slug);
  if (!trigger.active) { counters.skipped++; return; }

  const alreadySent = await airtable.hasEmailBeenSent(entry.name, recipient.eventId, recipient.email);
  if (alreadySent) { counters.skipped++; return; }

  // Cross-variant dedup: a parent who already received the OTHER variant
  // (e.g. non-buyer email already sent, then they bought audio) must not
  // receive a second email under the new variant's name.
  if (slug === PARENT_BUYER_SLUG || slug === PARENT_NON_BUYER_SLUG) {
    const otherSlug = slug === PARENT_BUYER_SLUG ? PARENT_NON_BUYER_SLUG : PARENT_BUYER_SLUG;
    const otherEntry = getRegistryEntry(otherSlug);
    if (otherEntry) {
      const sentOther = await airtable.hasEmailBeenSent(otherEntry.name, recipient.eventId, recipient.email);
      if (sentOther) { counters.skipped++; return; }
    }
  }

  const isParentLike = recipient.type === 'parent' || recipient.type === 'non-buyer';
  const unsubscribeUrl = isParentLike ? generateUnsubscribeUrl(recipient.email) : undefined;
  const templateOptions = isParentLike && unsubscribeUrl
    ? { showUnsubscribe: true, unsubscribeUrl }
    : undefined;

  const subject = renderTriggerTemplate(trigger.subject, variables);
  const html = renderFullTriggerEmail(trigger.bodyHtml, variables, templateOptions);

  let status: 'sent' | 'failed' = 'sent';
  let errorMessage: string | undefined;
  let resendMessageId: string | undefined;

  if (!process.env.RESEND_API_KEY) {
    console.log(`[MixReadyEmail] (dev) To: ${recipient.email}, Subject: ${subject}`);
    resendMessageId = 'dev-mode';
  } else {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const headers: Record<string, string> = {};
      if (unsubscribeUrl) {
        headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`;
        headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
      }
      const { data, error } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: recipient.email,
        subject,
        html,
        headers: Object.keys(headers).length ? headers : undefined,
      });
      if (error) { status = 'failed'; errorMessage = error.message; }
      else { resendMessageId = data?.id; }
    } catch (err) {
      status = 'failed';
      errorMessage = err instanceof Error ? err.message : 'Unknown error';
    }
  }

  const logInput: CreateEmailLogInput = {
    templateName: entry.name,
    eventId: recipient.eventId,
    recipientEmail: recipient.email,
    recipientType: recipient.type,
    status,
    errorMessage,
    resendMessageId,
  };
  await airtable.createEmailLog(logInput);

  if (status === 'sent') counters.sent++;
  else counters.failed++;

  await sleep(RATE_LIMIT_DELAY_MS);
}

export async function sendMixReadyEmailForEvent(eventId: string): Promise<SendCounters> {
  const airtable = getAirtableService();
  const event = await airtable.getEventByEventId(eventId);
  if (!event) {
    console.error(`[MixReadyEmail] Event not found: ${eventId}`);
    return { sent: 0, skipped: 0, failed: 0 };
  }
  if (!isMixReadyForEvent(event)) {
    console.log(`[MixReadyEmail] Skipping — event no longer eligible: ${eventId}`);
    return { sent: 0, skipped: 0, failed: 0 };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app';
  const parentPortalLink = `${baseUrl}/familie`;
  const teacherPortalLink = `${baseUrl}/paedagogen`;

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

  const counters: SendCounters = { sent: 0, skipped: 0, failed: 0 };

  // 1. Teachers — single template
  const teachers = await getTeacherRecipientsForEvent(event.event_id, event.id, eventData);
  for (const t of teachers) {
    const vars = buildVariables(t, event.school_name, teacherPortalLink);
    await sendOne(TEACHER_SLUG, t, vars, counters);
  }

  // 2. Parents — partition by audio purchase
  const parents = await getParentRecipientsForEvent(event.event_id, event.id, eventData);
  for (const p of parents) {
    const isBuyer = p.parentRecordId
      ? await hasAudioPurchaseForEvent(p.parentRecordId, event.event_id)
      : false;
    const slug = isBuyer ? PARENT_BUYER_SLUG : PARENT_NON_BUYER_SLUG;
    const vars = buildVariables(p, event.school_name, parentPortalLink);
    await sendOne(slug, p, vars, counters);
  }

  console.log(
    `[MixReadyEmail] ${eventId}: ${counters.sent} sent, ${counters.failed} failed, ${counters.skipped} skipped`
  );
  return counters;
}
