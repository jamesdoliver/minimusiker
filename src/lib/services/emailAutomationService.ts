/**
 * Email Automation Service
 *
 * Handles time-triggered email automation for teachers and parents based on event dates.
 * Processes templates, finds matching events, gathers recipients, and sends emails.
 */

import { getAirtableService } from './airtableService';
import { sendCampaignEmail, CampaignEmailOptions } from './resendService';
import { generateUnsubscribeUrl } from '@/lib/utils/unsubscribe';
import { getTeacherService } from './teacherService';
import {
  EmailTemplate,
  EmailRecipient,
  TemplateData,
  AutomationResult,
  EmailSendResult,
  EventThresholdMatch,
  CreateEmailLogInput,
  Audience,
  EventTier,
} from '@/lib/types/email-automation';
import { Event, Class, Parent, Registration, EVENTS_TABLE_ID, EVENTS_FIELD_IDS, ORDERS_TABLE_ID, ORDERS_FIELD_IDS } from '@/lib/types/airtable';

// Constants
const RATE_LIMIT_DELAY_MS = 500; // 500ms delay between emails to respect Resend rate limits

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Derive the effective tier for an event (highest wins).
 * Hierarchy: PLUS > Minimusikertag > Schulsong
 */
export function getEventTier(event: { isMinimusikertag?: boolean; isPlus?: boolean; isSchulsong?: boolean }): EventTier {
  if (event.isPlus) return 'plus';
  if (event.isMinimusikertag) return 'minimusikertag';
  if (event.isSchulsong) return 'schulsong';
  return 'minimusikertag'; // fallback (legacy default)
}

/**
 * Derive the effective tier for a template (highest wins).
 */
export function getTemplateTier(template: { is_minimusikertag: boolean; is_plus: boolean; is_schulsong: boolean }): EventTier {
  if (template.is_plus) return 'plus';
  if (template.is_minimusikertag) return 'minimusikertag';
  if (template.is_schulsong) return 'schulsong';
  return 'minimusikertag'; // fallback
}

/**
 * Check if an event matches a template's tier (exact match).
 */
export function eventMatchesTemplate(event: EventThresholdMatch, template: EmailTemplate): boolean {
  if (getEventTier(event) !== getTemplateTier(template)) return false;
  if (template.only_under_100 && !event.isUnder100) return false;
  return true;
}

/**
 * Calculate the difference in days between two dates (ignoring time)
 */
export function daysBetween(date1: Date, date2: Date): number {
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format a date in German locale
 */
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

/**
 * Format a date with day of week in German
 */
function formatDateWithDayGerman(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Template Variable Substitution
// =============================================================================

/**
 * Substitute template variables in a string
 * Variables use {{variable_name}} syntax
 */
export function substituteTemplateVariables(
  template: string,
  data: Partial<TemplateData>
): string {
  let result = template;

  // Pre-process date math: {{event_date+N}} or {{event_date-N}}
  if (data._event_date_iso) {
    const baseDate = new Date(data._event_date_iso);
    result = result.replace(/\{\{event_date([+-]\d+)\}\}/g, (_match, offsetStr: string) => {
      const offset = parseInt(offsetStr, 10);
      const computed = new Date(baseDate);
      computed.setDate(computed.getDate() + offset);
      return formatDateGerman(computed.toISOString());
    });
  }

  // Replace all {{variable}} patterns, skipping _-prefixed internal keys
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && !key.startsWith('_')) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(pattern, value);
    }
  }

  // Remove any remaining unreplaced {{variable}} placeholders to prevent
  // raw template variables from appearing in sent emails.
  // Supports snake_case, camelCase, and date math patterns like {{event_date+7}}.
  result = result.replace(/\{\{[^}]+\}\}/g, '');

  return result;
}

// =============================================================================
// Event Threshold Matching
// =============================================================================

/**
 * Get all events that match a specific trigger threshold
 * @param triggerDays - Number of days before (negative) or after (positive) the event
 * @returns Events where (event_date - today) equals triggerDays
 */
export async function getEventsHittingThreshold(
  triggerDays: number,
  prefetchedEvents?: Event[]
): Promise<EventThresholdMatch[]> {
  const airtable = getAirtableService();

  // Get today's date in Berlin timezone using Intl.DateTimeFormat('en-CA') which
  // produces YYYY-MM-DD directly — no ambiguous locale string re-parsing.
  const berlinFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const todayBerlinStr = berlinFormatter.format(new Date()); // "2026-02-08"
  const [y, m, d] = todayBerlinStr.split('-').map(Number);
  const todayUtcMidnight = new Date(Date.UTC(y, m - 1, d));

  // Calculate the target date based on trigger days
  // If triggerDays = -56, we want events that are 56 days in the future
  // If triggerDays = +7, we want events that were 7 days ago
  const targetDate = new Date(todayUtcMidnight);
  targetDate.setUTCDate(targetDate.getUTCDate() - triggerDays);

  const targetDateStr = targetDate.toISOString().split('T')[0];

  try {
    const events = prefetchedEvents ?? await airtable.getAllEvents();

    const matchingEvents: EventThresholdMatch[] = [];

    for (const event of events) {
      if (!event.event_date) continue;
      // Skip cancelled or deleted events — no further communication
      if (event.status === 'Cancelled' || event.status === 'Deleted') continue;

      // Compare dates (normalize to YYYY-MM-DD)
      const eventDateStr = event.event_date.split('T')[0];

      if (eventDateStr === targetDateStr) {
        const eventDate = new Date(event.event_date);
        const daysUntil = daysBetween(todayUtcMidnight, eventDate);

        matchingEvents.push({
          eventId: event.event_id,
          eventRecordId: event.id,
          schoolName: event.school_name,
          eventDate: event.event_date,
          eventType: event.is_kita ? 'KiTa' : 'Schule',
          daysUntilEvent: daysUntil,
          accessCode: event.access_code,
          isKita: event.is_kita,
          isMinimusikertag: event.is_minimusikertag,
          isPlus: event.is_plus,
          isSchulsong: event.is_schulsong,
          isUnder100: event.is_under_100,
        });
      }
    }

    return matchingEvents;
  } catch (error) {
    console.error('Error getting events hitting threshold:', error);
    return [];
  }
}

// =============================================================================
// Recipient Gathering
// =============================================================================

/**
 * Get teacher recipients for an event using a failsafe chain:
 * Priority 1: Events.teachers linked records → Teachers table (proper teacher names)
 * Priority 2: Events.simplybook_booking → SchoolBookings.school_contact_name (booking contact)
 * Priority 3: Events.assigned_staff → Personen (staff names as last resort)
 */
export async function getTeacherRecipientsForEvent(
  eventId: string,
  eventRecordId: string,
  eventData: EventThresholdMatch
): Promise<EmailRecipient[]> {
  const airtable = getAirtableService();
  const recipients: EmailRecipient[] = [];
  const seenEmails = new Set<string>();

  try {
    // Get event with teachers and simplybook_booking linked records
    const event = await airtable.getEventByRecordId(eventRecordId);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app';
    const eventLink = eventData.accessCode
      ? `${baseUrl}/e/${eventData.accessCode}`
      : `${baseUrl}/parent`;

    // PRIORITY 1: Use linked teachers from Events.teachers
    if (event?.teachers && event.teachers.length > 0) {
      const teacherService = getTeacherService();
      for (const teacherId of event.teachers) {
        const teacher = await teacherService.getTeacherById(teacherId);
        if (teacher?.email && !seenEmails.has(teacher.email.toLowerCase())) {
          seenEmails.add(teacher.email.toLowerCase());
          recipients.push({
            email: teacher.email,
            name: teacher.name,
            type: 'teacher',
            eventId: eventId,
            templateData: {
              school_name: eventData.schoolName,
              event_date: formatDateGerman(eventData.eventDate),
              event_type: eventData.eventType,
              event_link: eventLink,
              teacher_name: teacher.name,
              teacher_first_name: teacher.name?.split(' ')[0] || '',
              _event_date_iso: eventData.eventDate,
            },
          });
        }
      }
    }

    // PRIORITY 2: Fallback to SchoolBookings.school_contact_name
    if (recipients.length === 0 && event?.simplybook_booking?.[0]) {
      const booking = await airtable.getSchoolBookingById(event.simplybook_booking[0]);
      if (booking?.schoolContactEmail && !seenEmails.has(booking.schoolContactEmail.toLowerCase())) {
        seenEmails.add(booking.schoolContactEmail.toLowerCase());
        const contactName = booking.schoolContactName || 'Kontaktperson';
        recipients.push({
          email: booking.schoolContactEmail,
          name: contactName,
          type: 'teacher',
          eventId: eventId,
          templateData: {
            school_name: eventData.schoolName,
            event_date: formatDateGerman(eventData.eventDate),
            event_type: eventData.eventType,
            event_link: eventLink,
            teacher_name: contactName,
            teacher_first_name: contactName.split(' ')[0] || '',
            _event_date_iso: eventData.eventDate,
          },
        });
      }
    }

    // PRIORITY 3: Fallback to assigned_staff (existing logic)
    if (recipients.length === 0 && event?.assigned_staff && event.assigned_staff.length > 0) {
      for (const staffId of event.assigned_staff) {
        const staff = await airtable.getPersonById(staffId);
        if (staff?.email && !seenEmails.has(staff.email.toLowerCase())) {
          seenEmails.add(staff.email.toLowerCase());
          recipients.push({
            email: staff.email,
            name: staff.staff_name,
            type: 'teacher',
            eventId: eventId,
            templateData: {
              school_name: eventData.schoolName,
              event_date: formatDateGerman(eventData.eventDate),
              event_type: eventData.eventType,
              event_link: eventLink,
              teacher_name: staff.staff_name,
              teacher_first_name: staff.staff_name?.split(' ')[0] || '',
              _event_date_iso: eventData.eventDate,
            },
          });
        }
      }
    }
  } catch (error) {
    console.error('Error getting teacher recipients:', error);
  }

  return recipients;
}

/**
 * Get parent recipients for an event
 */
export async function getParentRecipientsForEvent(
  eventId: string,
  eventRecordId: string,
  eventData: EventThresholdMatch
): Promise<EmailRecipient[]> {
  const airtable = getAirtableService();
  const recipients: EmailRecipient[] = [];

  try {
    // Get registrations for this event
    const registrations = await airtable.getRegistrationsByEventId(eventRecordId);

    // Track unique parent emails to avoid duplicates
    const seenEmails = new Set<string>();

    for (const registration of registrations) {
      // Get parent details
      if (registration.parent_id && registration.parent_id.length > 0) {
        const parentRecordId = registration.parent_id[0];
        const parent = await airtable.getParentByRecordId(parentRecordId);

        if (parent?.parent_email
            && !seenEmails.has(parent.parent_email.toLowerCase())
            && parent.email_campaigns !== 'no') {
          seenEmails.add(parent.parent_email.toLowerCase());

          // Get class details if available
          let className = '';
          if (registration.class_id && registration.class_id.length > 0) {
            const classRecord = await airtable.getClassByRecordId(registration.class_id[0]);
            className = classRecord?.class_name || '';
          }

          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app';
          const eventLink = eventData.accessCode
            ? `${baseUrl}/e/${eventData.accessCode}`
            : `${baseUrl}/parent`;
          recipients.push({
            email: parent.parent_email,
            name: parent.parent_first_name,
            type: 'parent',
            eventId: eventId,
            classId: registration.class_id?.[0],
            templateData: {
              school_name: eventData.schoolName,
              event_date: formatDateGerman(eventData.eventDate),
              event_type: eventData.eventType,
              event_link: eventLink,
              parent_name: parent.parent_first_name,
              parent_first_name: parent.parent_first_name,
              child_name: registration.registered_child,
              class_name: className,
              parent_portal_link: `${baseUrl}/familie`,
              _event_date_iso: eventData.eventDate,
            },
          });
        }
      }
    }
  } catch (error) {
    console.error('Error getting parent recipients:', error);
  }

  return recipients;
}

/**
 * Get emails of parents who have at least one paid order for an event
 * @param eventRecordId - The Airtable record ID of the Event
 */
async function getPaidParentEmailsForEvent(eventRecordId: string): Promise<Set<string>> {
  const Airtable = (await import('airtable')).default;
  const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
    .base(process.env.AIRTABLE_BASE_ID!);

  const paidEmails = new Set<string>();

  // Fetch all paid orders and filter by event_id linked record
  const allPaidOrders = await base(ORDERS_TABLE_ID)
    .select({
      filterByFormula: `{${ORDERS_FIELD_IDS.payment_status}} = "paid"`,
      fields: [ORDERS_FIELD_IDS.parent_id, ORDERS_FIELD_IDS.event_id],
      returnFieldsByFieldId: true,
    })
    .all();

  // Filter orders by event_id linked record
  const orders = allPaidOrders.filter((order) => {
    const eventIds = order.get(ORDERS_FIELD_IDS.event_id) as string[] | undefined;
    return eventIds && eventIds.includes(eventRecordId);
  });

  const airtable = getAirtableService();
  for (const order of orders) {
    const parentRecordIds = order.get(ORDERS_FIELD_IDS.parent_id) as string[] | undefined;
    if (parentRecordIds?.[0]) {
      const parent = await airtable.getParentByRecordId(parentRecordIds[0]);
      if (parent?.parent_email) paidEmails.add(parent.parent_email.toLowerCase());
    }
  }
  return paidEmails;
}

/**
 * Get non-buyer recipients for an event (parents registered but without paid orders)
 */
async function getNonBuyerRecipientsForEvent(
  eventId: string,
  eventRecordId: string,
  eventData: EventThresholdMatch
): Promise<EmailRecipient[]> {
  const allParents = await getParentRecipientsForEvent(eventId, eventRecordId, eventData);
  // Use eventRecordId for order lookup via linked record field
  const paidEmails = await getPaidParentEmailsForEvent(eventRecordId);
  return allParents
    .filter(p => !paidEmails.has(p.email.toLowerCase()))
    .map(p => ({ ...p, type: 'non-buyer' as const }));
}

/**
 * Get all recipients for an event based on audience type
 */
export async function getRecipientsForEvent(
  eventId: string,
  eventRecordId: string,
  eventData: EventThresholdMatch,
  audience: Audience
): Promise<EmailRecipient[]> {
  const recipients: EmailRecipient[] = [];

  if (audience.includes('teacher')) {
    recipients.push(...await getTeacherRecipientsForEvent(eventId, eventRecordId, eventData));
  }

  if (audience.includes('parent')) {
    recipients.push(...await getParentRecipientsForEvent(eventId, eventRecordId, eventData));
  }

  if (audience.includes('non-buyers')) {
    recipients.push(...await getNonBuyerRecipientsForEvent(eventId, eventRecordId, eventData));
  }

  // Deduplicate by email+eventId to avoid double-sending
  // (e.g., if both 'parent' and 'non-buyer' are selected, non-buyers are a subset of parents)
  const seen = new Set<string>();
  return recipients.filter(r => {
    const key = `${r.email.toLowerCase()}:${r.eventId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// =============================================================================
// Email Sending
// =============================================================================

/**
 * Send a single automated email
 * @param template - The email template to send
 * @param recipient - The recipient to send to
 * @param options - Optional settings
 * @param options.skipDuplicateCheck - If true, skip the duplicate check and send even if already sent
 */
export async function sendAutomatedEmail(
  template: EmailTemplate,
  recipient: EmailRecipient,
  options?: { skipDuplicateCheck?: boolean }
): Promise<EmailSendResult> {
  const airtable = getAirtableService();
  const { skipDuplicateCheck = false } = options || {};

  // Build full template data with defaults
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app';
  const fullData: TemplateData = {
    school_name: '',
    event_date: '',
    event_link: `${baseUrl}/parent`,
    ...recipient.templateData,
    teacher_portal_link: `${baseUrl}/paedagogen-login`,
    parent_portal_link: `${baseUrl}/familie`,
  };

  // Substitute variables in subject and body
  const subject = substituteTemplateVariables(template.subject, fullData);
  const bodyHtml = substituteTemplateVariables(template.bodyHtml, fullData);

  // Check if already sent (unless skipDuplicateCheck is true)
  if (!skipDuplicateCheck) {
    const alreadySent = await airtable.hasEmailBeenSent(
      template.name,
      recipient.eventId,
      recipient.email
    );

    if (alreadySent) {
      // Log as skipped
      await airtable.createEmailLog({
        templateName: template.name,
        eventId: recipient.eventId,
        recipientEmail: recipient.email,
        recipientType: recipient.type,
        status: 'skipped',
        errorMessage: 'Email already sent for this template/event/recipient combination',
      });

      return {
        recipientEmail: recipient.email,
        recipientType: recipient.type,
        eventId: recipient.eventId,
        templateName: template.name,
        success: false,
        error: 'Already sent',
      };
    }
  }

  // Send the email (with unsubscribe for parent recipients)
  const isParent = recipient.type === 'parent' || recipient.type === 'non-buyer';
  const unsubscribeUrl = isParent ? generateUnsubscribeUrl(recipient.email) : undefined;
  const campaignOptions: CampaignEmailOptions | undefined = isParent && unsubscribeUrl
    ? {
        showUnsubscribe: true,
        unsubscribeUrl,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }
    : undefined;
  const result = await sendCampaignEmail(recipient.email, subject, bodyHtml, campaignOptions);

  // Log the result
  const logInput: CreateEmailLogInput = {
    templateName: template.name,
    eventId: recipient.eventId,
    recipientEmail: recipient.email,
    recipientType: recipient.type,
    status: result.success ? 'sent' : 'failed',
    errorMessage: result.error,
    resendMessageId: result.messageId,
  };

  await airtable.createEmailLog(logInput);

  return {
    recipientEmail: recipient.email,
    recipientType: recipient.type,
    eventId: recipient.eventId,
    templateName: template.name,
    success: result.success,
    messageId: result.messageId,
    error: result.error,
  };
}

// =============================================================================
// Main Automation Process
// =============================================================================

/**
 * Get the current hour in Europe/Berlin timezone
 */
export function getCurrentBerlinHour(): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    hour: 'numeric',
    hourCycle: 'h23',
  });
  return parseInt(formatter.format(new Date()), 10);
}

/**
 * Process all email automation for the current hour
 * This is the main entry point called by the cron job (runs hourly).
 * Only processes templates whose triggerHour matches the current Berlin time hour.
 *
 * @param dryRun - If true, logs what would be sent without actually sending
 * @param currentHour - Override the current hour (for testing). If not provided, uses Europe/Berlin time.
 */
export async function processEmailAutomation(
  dryRun: boolean = false,
  currentHour?: number
): Promise<AutomationResult> {
  const airtable = getAirtableService();
  const hour = currentHour ?? getCurrentBerlinHour();
  const result: AutomationResult = {
    processedAt: new Date().toISOString(),
    templatesProcessed: 0,
    emailsSent: 0,
    emailsFailed: 0,
    emailsSkipped: 0,
    details: [],
    errors: [],
  };

  try {
    // Get all active templates
    const allTemplates = await airtable.getActiveEmailTemplates();

    if (allTemplates.length === 0) {
      result.errors.push('No active email templates found');
      return result;
    }

    // Filter to only templates matching the current hour
    const templates = allTemplates.filter(t => t.triggerHour === hour);

    console.log(`[Email Automation] Hour ${hour} (Berlin) — ${templates.length}/${allTemplates.length} active templates match`);

    if (templates.length === 0) {
      return result;
    }

    // Fetch all events once and share across templates to avoid repeated Airtable calls
    const allEvents = await airtable.getAllEvents();

    for (const template of templates) {
      try {
        result.templatesProcessed++;
        console.log(
          `[Email Automation] Template: ${template.name} (trigger: ${template.triggerDays} days, audience: ${template.audience.join(', ')})`
        );

        // Get events matching this template's trigger threshold
        const events = await getEventsHittingThreshold(template.triggerDays, allEvents);

        // Filter events by template's event type filters
        const filteredEvents = events.filter(event => eventMatchesTemplate(event, template));

        if (filteredEvents.length === 0) {
          console.log(`[Email Automation] No events match trigger threshold ${template.triggerDays} (${events.length} before event type filter)`);
          continue;
        }

        console.log(`[Email Automation] Found ${filteredEvents.length} events matching threshold (${events.length} before event type filter)`);

        for (const event of filteredEvents) {
          // Get recipients for this event
          const recipients = await getRecipientsForEvent(
            event.eventId,
            event.eventRecordId,
            event,
            template.audience
          );

          if (recipients.length === 0) {
            console.log(`[Email Automation] No recipients found for event ${event.eventId}`);
            continue;
          }

          console.log(
            `[Email Automation] Sending to ${recipients.length} recipients for event ${event.eventId}`
          );

          for (const recipient of recipients) {
            if (dryRun) {
              // In dry run mode, just log what would be sent
              console.log(
                `[DRY RUN] Would send "${template.name}" to ${recipient.email} for event ${event.eventId}`
              );
              result.details.push({
                recipientEmail: recipient.email,
                recipientType: recipient.type,
                eventId: event.eventId,
                templateName: template.name,
                success: true,
                messageId: 'dry-run',
              });
              result.emailsSent++;
            } else {
              // Send the actual email
              const sendResult = await sendAutomatedEmail(template, recipient);
              result.details.push(sendResult);

              if (sendResult.success) {
                result.emailsSent++;
              } else if (sendResult.error === 'Already sent') {
                result.emailsSkipped++;
              } else {
                result.emailsFailed++;
              }

              // Rate limiting delay
              await sleep(RATE_LIMIT_DELAY_MS);
            }
          }
        }
      } catch (templateError) {
        const errorMsg = `Error processing template ${template.name}: ${
          templateError instanceof Error ? templateError.message : String(templateError)
        }`;
        console.error(`[Email Automation] ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    console.log(
      `[Email Automation] Complete: ${result.emailsSent} sent, ${result.emailsFailed} failed, ${result.emailsSkipped} skipped`
    );
  } catch (error) {
    const errorMsg = `Fatal error in email automation: ${
      error instanceof Error ? error.message : String(error)
    }`;
    console.error(`[Email Automation] ${errorMsg}`);
    result.errors.push(errorMsg);
  }

  return result;
}

// =============================================================================
// Schulsong Release Email Processing (called by cron)
// =============================================================================

/**
 * Find all events with a schulsong release time in the past and send release
 * emails. Dedup via EMAIL_LOGS prevents double-sends, so multiple runs are safe.
 */
export async function processSchulsongReleaseEmails(
  dryRun: boolean = false
): Promise<{ sent: number; skipped: number; failed: number; errors: string[] }> {
  // Lazy import to avoid circular dependency
  const { sendSchulsongReleaseEmailForEvent, sendSchulsongParentReleaseEmailForEvent } = await import('@/lib/services/schulsongEmailService');

  const airtable = getAirtableService();
  const allEvents = await airtable.getAllEvents();
  const now = new Date();

  // Filter: schulsong + approved + released_at in the past
  const eligible = allEvents.filter(
    (e) =>
      e.is_schulsong &&
      e.status !== 'Cancelled' && e.status !== 'Deleted' &&
      e.admin_approval_status === 'approved' &&
      e.schulsong_released_at &&
      new Date(e.schulsong_released_at) <= now
  );

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const event of eligible) {
    try {
      if (dryRun) {
        console.log(`[SchulsongCron] (dry-run) Would send for ${event.event_id} (${event.school_name})`);
        skipped++;
        continue;
      }

      const teacherResult = await sendSchulsongReleaseEmailForEvent(event.event_id);
      const parentResult = await sendSchulsongParentReleaseEmailForEvent(event.event_id);
      sent += teacherResult.sent + parentResult.sent;
      skipped += teacherResult.skipped + parentResult.skipped;
      failed += teacherResult.failed + parentResult.failed;
    } catch (err) {
      const msg = `Failed to process ${event.event_id}: ${err instanceof Error ? err.message : String(err)}`;
      console.error(`[SchulsongCron] ${msg}`);
      errors.push(msg);
    }
  }

  console.log(`[SchulsongCron] Processed ${eligible.length} events: ${sent} sent, ${skipped} skipped, ${failed} failed`);
  return { sent, skipped, failed, errors };
}

// =============================================================================
// Utility Functions for Testing
// =============================================================================

/**
 * Generate preview data for testing template rendering
 */
export function getPreviewTemplateData(): TemplateData {
  const today = new Date();
  const eventDate = new Date(today);
  eventDate.setDate(eventDate.getDate() + 30);

  return {
    school_name: 'Muster-Grundschule',
    event_date: formatDateGerman(eventDate.toISOString()),
    event_link: 'https://minimusiker.app/e/1234',
    event_type: 'Schule',
    teacher_name: 'Frau Schmidt',
    teacher_first_name: 'Maria',
    teacher_portal_link: 'https://minimusiker.app/paedagogen-login',
    parent_name: 'Max Mustermann',
    parent_first_name: 'Max',
    child_name: 'Lisa Mustermann',
    parent_portal_link: 'https://minimusiker.app/familie',
    access_code: '12345',
    class_name: 'Klasse 3a',
    class_time: '10:00 Uhr',
    order_link: 'https://minimusiker.app/shop',
    _event_date_iso: eventDate.toISOString(),
  };
}

/**
 * Test send a template to a specific email address
 * @param templateId - The template record ID
 * @param testEmail - The email address to send the test to
 * @param eventId - Optional event ID (e.g., "evt_test_school_minimusiker_...") to use real event data instead of preview data
 */
export async function sendTestEmail(
  templateId: string,
  testEmail: string,
  eventId?: string
): Promise<{ success: boolean; messageId?: string; error?: string; previewData?: Partial<TemplateData> }> {
  const airtable = getAirtableService();

  try {
    const template = await airtable.getEmailTemplateById(templateId);

    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    let templateData: Partial<TemplateData>;

    if (eventId) {
      // Use real event data - lookup by eventId
      const event = await airtable.getEventByEventId(eventId);
      if (!event) {
        return { success: false, error: 'Event not found' };
      }

      // Build eventData for recipient fetching (same structure as production emails)
      const eventData: EventThresholdMatch = {
        eventId: eventId,
        eventRecordId: event.id,
        schoolName: event.school_name || '',
        eventDate: event.event_date || '',
        eventType: event.is_kita ? 'KiTa' : 'Schule',
        daysUntilEvent: 0, // Not relevant for test emails
        accessCode: event.access_code,
        isKita: event.is_kita,
        isMinimusikertag: event.is_minimusikertag,
        isPlus: event.is_plus,
        isSchulsong: event.is_schulsong,
        isUnder100: event.is_under_100,
      };

      // Get recipients using the same pipeline as normal emails
      // This ensures test emails have all the same variables (teacher_name, parent_name, etc.)
      const recipients = await getRecipientsForEvent(
        eventId,
        event.id,
        eventData,
        template.audience
      );

      if (recipients.length > 0) {
        // Use the first recipient's templateData (complete with teacher/parent info)
        templateData = recipients[0].templateData;
      } else {
        // Fallback: build basic event data if no recipients found
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app';
        const eventLink = event.access_code
          ? `${baseUrl}/e/${event.access_code}`
          : `${baseUrl}/parent`;
        templateData = {
          school_name: event.school_name || '',
          event_date: formatDateGerman(event.event_date || ''),
          event_type: event.is_kita ? 'KiTa' : 'Schule',
          teacher_portal_link: `${baseUrl}/paedagogen-login`,
          parent_portal_link: `${baseUrl}/familie`,
          event_link: eventLink,
          _event_date_iso: event.event_date,
        };
      }
    } else {
      // Use default preview data
      templateData = getPreviewTemplateData();
    }

    const subject = substituteTemplateVariables(template.subject, templateData);
    const bodyHtml = substituteTemplateVariables(template.bodyHtml, templateData);

    const result = await sendCampaignEmail(testEmail, subject, bodyHtml);

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      previewData: templateData,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
