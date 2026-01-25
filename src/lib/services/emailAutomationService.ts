/**
 * Email Automation Service
 *
 * Handles time-triggered email automation for teachers and parents based on event dates.
 * Processes templates, finds matching events, gathers recipients, and sends emails.
 */

import { getAirtableService } from './airtableService';
import { sendCampaignEmail } from './resendService';
import {
  EmailTemplate,
  EmailRecipient,
  TemplateData,
  AutomationResult,
  EmailSendResult,
  EventThresholdMatch,
  CreateEmailLogInput,
} from '@/lib/types/email-automation';
import { Event, Class, Parent, Registration, EVENTS_TABLE_ID, EVENTS_FIELD_IDS } from '@/lib/types/airtable';

// Constants
const RATE_LIMIT_DELAY_MS = 500; // 500ms delay between emails to respect Resend rate limits

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate the difference in days between two dates (ignoring time)
 */
function daysBetween(date1: Date, date2: Date): number {
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
function sleep(ms: number): Promise<void> {
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

  // Replace all {{variable}} patterns
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(pattern, value);
    }
  }

  // Remove any remaining unreplaced variables (or leave them as markers for debugging)
  // For production, you might want to replace with empty string:
  // result = result.replace(/\{\{[a-z_]+\}\}/g, '');

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
  triggerDays: number
): Promise<EventThresholdMatch[]> {
  const airtable = getAirtableService();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate the target date based on trigger days
  // If triggerDays = -56, we want events that are 56 days in the future
  // If triggerDays = +7, we want events that were 7 days ago
  const targetDate = new Date(today);
  targetDate.setDate(targetDate.getDate() - triggerDays);

  const targetDateStr = targetDate.toISOString().split('T')[0];

  try {
    // Query events with the matching date
    // Note: This uses the normalized Events table
    const events = await airtable.getAllEvents();

    const matchingEvents: EventThresholdMatch[] = [];

    for (const event of events) {
      if (!event.event_date) continue;

      // Compare dates (normalize to YYYY-MM-DD)
      const eventDateStr = event.event_date.split('T')[0];

      if (eventDateStr === targetDateStr) {
        const eventDate = new Date(event.event_date);
        const daysUntil = daysBetween(today, eventDate);

        matchingEvents.push({
          eventId: event.event_id,
          eventRecordId: event.id,
          schoolName: event.school_name,
          eventDate: event.event_date,
          eventType: event.event_type || 'Minimusikertag',
          daysUntilEvent: daysUntil,
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
 * Get teacher recipients for an event
 */
async function getTeacherRecipientsForEvent(
  eventId: string,
  eventRecordId: string,
  eventData: EventThresholdMatch
): Promise<EmailRecipient[]> {
  const airtable = getAirtableService();
  const recipients: EmailRecipient[] = [];

  try {
    // Get classes for this event
    const classes = await airtable.getClassesByEventId(eventRecordId);

    // Track unique teacher emails to avoid duplicates
    const seenEmails = new Set<string>();

    for (const cls of classes) {
      // For now, we don't have direct teacher email in classes
      // Teachers are typically linked through the main_teacher field
      // This would need to be enhanced to look up teacher emails from Personen table

      // For the MVP, we can use the school booking contact as a fallback
      // or implement teacher email lookup later

      if (cls.main_teacher && !seenEmails.has(cls.main_teacher.toLowerCase())) {
        // main_teacher might be a name, not an email
        // We'd need to look this up in the Personen table
        // For now, skip if it's not an email format
        if (cls.main_teacher.includes('@')) {
          seenEmails.add(cls.main_teacher.toLowerCase());
          recipients.push({
            email: cls.main_teacher,
            name: cls.main_teacher.split('@')[0],
            type: 'teacher',
            eventId: eventId,
            classId: cls.class_id,
            templateData: {
              school_name: eventData.schoolName,
              event_date: formatDateGerman(eventData.eventDate),
              event_type: eventData.eventType,
              class_name: cls.class_name,
              teacher_name: cls.main_teacher,
              teacher_first_name: cls.main_teacher.split(' ')[0],
            },
          });
        }
      }
    }

    // If no teacher emails found in classes, try to get from assigned staff
    if (recipients.length === 0) {
      // Try to get staff assigned to the event
      const event = await airtable.getEventByRecordId(eventRecordId);
      if (event?.assigned_staff && event.assigned_staff.length > 0) {
        // Look up staff emails from Personen table
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
                teacher_name: staff.staff_name,
                teacher_first_name: staff.staff_name?.split(' ')[0] || '',
              },
            });
          }
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
async function getParentRecipientsForEvent(
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

        if (parent?.parent_email && !seenEmails.has(parent.parent_email.toLowerCase())) {
          seenEmails.add(parent.parent_email.toLowerCase());

          // Get class details if available
          let className = '';
          if (registration.class_id && registration.class_id.length > 0) {
            const classRecord = await airtable.getClassByRecordId(registration.class_id[0]);
            className = classRecord?.class_name || '';
          }

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
              parent_name: parent.parent_first_name,
              parent_first_name: parent.parent_first_name,
              child_name: registration.registered_child,
              class_name: className,
              parent_portal_link: `${process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app'}/parent`,
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
 * Get all recipients for an event based on audience type
 */
export async function getRecipientsForEvent(
  eventId: string,
  eventRecordId: string,
  eventData: EventThresholdMatch,
  audience: 'teacher' | 'parent' | 'both'
): Promise<EmailRecipient[]> {
  const recipients: EmailRecipient[] = [];

  if (audience === 'teacher' || audience === 'both') {
    const teachers = await getTeacherRecipientsForEvent(eventId, eventRecordId, eventData);
    recipients.push(...teachers);
  }

  if (audience === 'parent' || audience === 'both') {
    const parents = await getParentRecipientsForEvent(eventId, eventRecordId, eventData);
    recipients.push(...parents);
  }

  return recipients;
}

// =============================================================================
// Email Sending
// =============================================================================

/**
 * Send a single automated email
 */
async function sendAutomatedEmail(
  template: EmailTemplate,
  recipient: EmailRecipient
): Promise<EmailSendResult> {
  const airtable = getAirtableService();

  // Build full template data with defaults
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app';
  const fullData: TemplateData = {
    school_name: '',
    event_date: '',
    event_link: `${baseUrl}/parent`,
    ...recipient.templateData,
    teacher_portal_link: `${baseUrl}/teacher`,
    parent_portal_link: `${baseUrl}/parent`,
  };

  // Substitute variables in subject and body
  const subject = substituteTemplateVariables(template.subject, fullData);
  const bodyHtml = substituteTemplateVariables(template.bodyHtml, fullData);

  // Check if already sent
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

  // Send the email
  const result = await sendCampaignEmail(recipient.email, subject, bodyHtml);

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
 * Process all email automation for today
 * This is the main entry point called by the cron job
 */
export async function processEmailAutomation(
  dryRun: boolean = false
): Promise<AutomationResult> {
  const airtable = getAirtableService();
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
    const templates = await airtable.getActiveEmailTemplates();

    if (templates.length === 0) {
      result.errors.push('No active email templates found');
      return result;
    }

    console.log(`[Email Automation] Processing ${templates.length} active templates`);

    for (const template of templates) {
      try {
        result.templatesProcessed++;
        console.log(
          `[Email Automation] Template: ${template.name} (trigger: ${template.triggerDays} days, audience: ${template.audience})`
        );

        // Get events matching this template's trigger threshold
        const events = await getEventsHittingThreshold(template.triggerDays);

        if (events.length === 0) {
          console.log(`[Email Automation] No events match trigger threshold ${template.triggerDays}`);
          continue;
        }

        console.log(`[Email Automation] Found ${events.length} events matching threshold`);

        for (const event of events) {
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
    event_link: 'https://minimusiker.app/parent',
    event_type: 'Minimusikertag',
    teacher_name: 'Frau Schmidt',
    teacher_first_name: 'Maria',
    teacher_portal_link: 'https://minimusiker.app/teacher',
    parent_name: 'Max Mustermann',
    parent_first_name: 'Max',
    child_name: 'Lisa Mustermann',
    parent_portal_link: 'https://minimusiker.app/parent',
    access_code: '12345',
    class_name: 'Klasse 3a',
    class_time: '10:00 Uhr',
    order_link: 'https://minimusiker.app/shop',
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

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app';
      templateData = {
        school_name: event.school_name || '',
        event_date: formatDateGerman(event.event_date || ''),
        event_type: event.event_type || 'Minimusikertag',
        teacher_portal_link: `${baseUrl}/teacher`,
        parent_portal_link: `${baseUrl}/parent`,
        event_link: `${baseUrl}/parent`,
      };
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
