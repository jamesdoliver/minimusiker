/**
 * Notification Service
 * Handles fetching notification settings and sending admin notifications
 */

import Airtable from 'airtable';
import {
  NotificationSetting,
  NotificationType,
  BookingNotificationData,
  DateChangeNotificationData,
  CancellationNotificationData,
  UnassignedStaffNotificationData,
} from '@/lib/types/notification-settings';
import {
  sendNewBookingNotification,
  sendDateChangeNotification,
  sendCancellationNotification,
  sendSchulsongTeacherApprovedNotification,
  SchulsongTeacherApprovedData,
  sendEngineerSchulsongUploadedEmail,
  sendEngineerMinimusikerUploadedEmail,
  sendUnassignedStaffAlertEmail,
} from './resendService';
import { getAirtableService } from './airtableService';

// Airtable table ID for NotificationSettings
const NOTIFICATION_SETTINGS_TABLE_ID = 'tbld82JxKX4Ju1XHP';

/**
 * Get notification settings from Airtable for a specific type
 */
async function getNotificationSettings(type: NotificationType): Promise<NotificationSetting | null> {
  try {
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
      process.env.AIRTABLE_BASE_ID!
    );

    const records = await base(NOTIFICATION_SETTINGS_TABLE_ID)
      .select({
        filterByFormula: `{type} = "${type}"`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    const record = records[0];
    return {
      id: record.id,
      type: (record.fields['type'] as NotificationType) || type,
      recipientEmails: (record.fields['recipientEmails'] as string) || '',
      enabled: (record.fields['enabled'] as boolean) || false,
    };
  } catch (error) {
    console.error(`[NotificationService] Error fetching settings for ${type}:`, error);
    return null;
  }
}

/**
 * Parse recipient emails from comma-separated string
 */
function parseRecipientEmails(recipientEmails: string): string[] {
  if (!recipientEmails) return [];
  return recipientEmails
    .split(',')
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
}

/**
 * Send new booking notification if enabled
 */
export async function triggerNewBookingNotification(
  data: BookingNotificationData
): Promise<{ sent: boolean; error?: string }> {
  try {
    const settings = await getNotificationSettings('new_booking');

    if (!settings || !settings.enabled) {
      console.log('[NotificationService] New booking notification disabled or not configured');
      return { sent: false };
    }

    const recipients = parseRecipientEmails(settings.recipientEmails);
    if (recipients.length === 0) {
      console.log('[NotificationService] No recipients configured for new booking notification');
      return { sent: false };
    }

    const result = await sendNewBookingNotification(recipients, data);

    if (result.success) {
      console.log(`[NotificationService] New booking notification sent to ${recipients.length} recipients`);
      return { sent: true };
    } else {
      console.error('[NotificationService] Failed to send new booking notification:', result.error);
      return { sent: false, error: result.error };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[NotificationService] Error in triggerNewBookingNotification:', error);
    return { sent: false, error: errorMessage };
  }
}

/**
 * Send date change notification if enabled
 */
export async function triggerDateChangeNotification(
  data: DateChangeNotificationData
): Promise<{ sent: boolean; error?: string }> {
  try {
    const settings = await getNotificationSettings('date_change');

    if (!settings || !settings.enabled) {
      console.log('[NotificationService] Date change notification disabled or not configured');
      return { sent: false };
    }

    const recipients = parseRecipientEmails(settings.recipientEmails);
    if (recipients.length === 0) {
      console.log('[NotificationService] No recipients configured for date change notification');
      return { sent: false };
    }

    const result = await sendDateChangeNotification(recipients, data);

    if (result.success) {
      console.log(`[NotificationService] Date change notification sent to ${recipients.length} recipients`);
      return { sent: true };
    } else {
      console.error('[NotificationService] Failed to send date change notification:', result.error);
      return { sent: false, error: result.error };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[NotificationService] Error in triggerDateChangeNotification:', error);
    return { sent: false, error: errorMessage };
  }
}

/**
 * Send cancellation notification if enabled
 */
export async function triggerCancellationNotification(
  data: CancellationNotificationData
): Promise<{ sent: boolean; error?: string }> {
  try {
    const settings = await getNotificationSettings('cancellation');

    if (!settings || !settings.enabled) {
      console.log('[NotificationService] Cancellation notification disabled or not configured');
      return { sent: false };
    }

    const recipients = parseRecipientEmails(settings.recipientEmails);
    if (recipients.length === 0) {
      console.log('[NotificationService] No recipients configured for cancellation notification');
      return { sent: false };
    }

    const result = await sendCancellationNotification(recipients, data);

    if (result.success) {
      console.log(`[NotificationService] Cancellation notification sent to ${recipients.length} recipients`);
      return { sent: true };
    } else {
      console.error('[NotificationService] Failed to send cancellation notification:', result.error);
      return { sent: false, error: result.error };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[NotificationService] Error in triggerCancellationNotification:', error);
    return { sent: false, error: errorMessage };
  }
}

/**
 * Send unassigned staff alert notification if enabled
 */
export async function triggerUnassignedStaffNotification(
  data: UnassignedStaffNotificationData
): Promise<{ sent: boolean; error?: string }> {
  try {
    const settings = await getNotificationSettings('unassigned_staff');

    if (!settings || !settings.enabled) {
      console.log('[NotificationService] Unassigned staff notification disabled or not configured');
      return { sent: false };
    }

    const recipients = parseRecipientEmails(settings.recipientEmails);
    if (recipients.length === 0) {
      console.log('[NotificationService] No recipients configured for unassigned staff notification');
      return { sent: false };
    }

    const result = await sendUnassignedStaffAlertEmail(recipients, data);

    if (result.success) {
      console.log(`[NotificationService] Unassigned staff alert sent to ${recipients.length} recipients`);
      return { sent: true };
    } else {
      console.error('[NotificationService] Failed to send unassigned staff alert:', result.error);
      return { sent: false, error: result.error };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[NotificationService] Error in triggerUnassignedStaffNotification:', error);
    return { sent: false, error: errorMessage };
  }
}

/**
 * Send schulsong teacher approved notification if enabled
 */
export async function triggerSchulsongTeacherApprovedNotification(
  data: SchulsongTeacherApprovedData
): Promise<{ sent: boolean; error?: string }> {
  try {
    const settings = await getNotificationSettings('schulsong_teacher_approved');

    if (!settings || !settings.enabled) {
      console.log('[NotificationService] Schulsong teacher approved notification disabled or not configured');
      return { sent: false };
    }

    const recipients = parseRecipientEmails(settings.recipientEmails);
    if (recipients.length === 0) {
      console.log('[NotificationService] No recipients configured for schulsong teacher approved notification');
      return { sent: false };
    }

    const result = await sendSchulsongTeacherApprovedNotification(recipients, data);

    if (result.success) {
      console.log(`[NotificationService] Schulsong teacher approved notification sent to ${recipients.length} recipients`);
      return { sent: true };
    } else {
      console.error('[NotificationService] Failed to send schulsong teacher approved notification:', result.error);
      return { sent: false, error: result.error };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[NotificationService] Error in triggerSchulsongTeacherApprovedNotification:', error);
    return { sent: false, error: errorMessage };
  }
}

/**
 * Notify admins when teacher rejects schulsong
 * Reuses the same admin recipients from schulsong_teacher_approved notification settings
 */
export async function triggerSchulsongTeacherRejectedNotification(
  data: { schoolName: string; eventDate: string; eventId: string; teacherNotes?: string }
): Promise<{ sent: boolean; error?: string }> {
  try {
    // Reuse the same admin recipients as the approval notification
    const settings = await getNotificationSettings('schulsong_teacher_approved');

    if (!settings || !settings.enabled) {
      console.log('[NotificationService] Schulsong teacher rejected notification disabled or not configured');
      return { sent: false };
    }

    const recipients = parseRecipientEmails(settings.recipientEmails);
    if (recipients.length === 0) {
      console.log('[NotificationService] No recipients configured for schulsong teacher rejected notification');
      return { sent: false };
    }

    const { sendSchulsongTeacherRejectedNotification } = await import('./resendService');
    const result = await sendSchulsongTeacherRejectedNotification(recipients, {
      schoolName: data.schoolName,
      eventDate: data.eventDate,
      eventId: data.eventId,
      teacherNotes: data.teacherNotes,
    });

    if (result.success) {
      console.log(`[NotificationService] Schulsong teacher rejected notification sent to ${recipients.length} recipients`);
      return { sent: true };
    } else {
      console.error('[NotificationService] Failed to send schulsong teacher rejected notification:', result.error);
      return { sent: false, error: result.error };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[NotificationService] Error in triggerSchulsongTeacherRejectedNotification:', error);
    return { sent: false, error: errorMessage };
  }
}

/**
 * Send schulsong approval reminder to teacher + admin recipients
 * Used by cron when schulsong is pending for >24h after upload
 */
export async function triggerSchulsongApprovalReminder(
  data: { schoolName: string; eventDate: string; eventId: string; daysPending: number; teacherEmail: string }
): Promise<{ sent: boolean; error?: string }> {
  try {
    // Get admin recipients from notification settings (reuse same config as approval notification)
    const settings = await getNotificationSettings('schulsong_teacher_approved');
    const adminRecipients = settings?.enabled ? parseRecipientEmails(settings.recipientEmails) : [];

    // Combine teacher + admins, deduplicate
    const allRecipients = [...new Set([data.teacherEmail, ...adminRecipients].map(e => e.toLowerCase()))];

    if (allRecipients.length === 0) {
      return { sent: false, error: 'No recipients' };
    }

    const { sendSchulsongApprovalReminderEmail } = await import('./resendService');
    const result = await sendSchulsongApprovalReminderEmail(allRecipients, {
      schoolName: data.schoolName,
      eventDate: data.eventDate,
      daysPending: String(data.daysPending),
    });

    if (result.success) {
      console.log(`[NotificationService] Schulsong approval reminder sent for ${data.eventId} to ${allRecipients.length} recipients`);
      return { sent: true };
    }
    return { sent: false, error: result.error };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[NotificationService] Error in triggerSchulsongApprovalReminder:', error);
    return { sent: false, error: errorMessage };
  }
}

/**
 * Notify engineer (Micha) when teacher approves or rejects schulsong
 * Looks up engineer via ENGINEER_MICHA_ID env var -> Personen table
 */
export async function triggerSchulsongTeacherActionNotification(
  data: { schoolName: string; eventDate: string; eventId: string; action: 'approved' | 'rejected'; teacherNotes?: string }
): Promise<{ sent: boolean; error?: string }> {
  try {
    const engineerId = process.env.ENGINEER_MICHA_ID;
    if (!engineerId) {
      console.warn('[NotificationService] ENGINEER_MICHA_ID not configured');
      return { sent: false, error: 'ENGINEER_MICHA_ID not configured' };
    }

    const airtable = getAirtableService();
    const engineer = await airtable.getPersonById(engineerId);
    if (!engineer || !engineer.email) {
      console.warn(`[NotificationService] Engineer ${engineerId} has no email`);
      return { sent: false, error: 'Engineer email not found' };
    }

    const { sendSchulsongTeacherActionEmail } = await import('./resendService');
    const result = await sendSchulsongTeacherActionEmail(engineer.email, engineer.staff_name, {
      schoolName: data.schoolName,
      eventDate: data.eventDate,
      eventId: data.eventId,
      action: data.action,
      teacherNotes: data.teacherNotes,
    });

    if (result.success) {
      console.log(`[NotificationService] Schulsong teacher ${data.action} notification sent to ${engineer.email}`);
      return { sent: true };
    } else {
      console.error('[NotificationService] Failed to send schulsong teacher action notification:', result.error);
      return { sent: false, error: result.error };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[NotificationService] Error in triggerSchulsongTeacherActionNotification:', error);
    return { sent: false, error: errorMessage };
  }
}

/**
 * Notify teacher when engineer uploads a new schulsong version after rejection
 * Teacher email comes from the event's school_contact_email
 */
export async function triggerSchulsongNewVersionNotification(
  data: { eventId: string; schoolName: string; eventDate: string; teacherEmail: string }
): Promise<{ sent: boolean; error?: string }> {
  try {
    const teacherPortalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app'}/paedagogen`;

    const { sendSchulsongNewVersionEmail } = await import('./resendService');
    const result = await sendSchulsongNewVersionEmail(data.teacherEmail, {
      schoolName: data.schoolName,
      eventDate: data.eventDate,
      teacherPortalUrl,
    });

    if (result.success) {
      console.log(`[NotificationService] Schulsong new version notification sent to ${data.teacherEmail}`);
      return { sent: true };
    } else {
      console.error('[NotificationService] Failed to send schulsong new version notification:', result.error);
      return { sent: false, error: result.error };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[NotificationService] Error in triggerSchulsongNewVersionNotification:', error);
    return { sent: false, error: errorMessage };
  }
}

/**
 * Notify the appropriate engineer when a Logic Project is uploaded.
 * - Schulsong upload -> notifies Micha (ENGINEER_MICHA_ID)
 * - Minimusiker upload -> notifies Jakob (ENGINEER_JAKOB_ID)
 */
export async function notifyEngineerOfUpload(
  eventId: string,
  projectType: 'schulsong' | 'minimusiker'
): Promise<void> {
  try {
    const airtable = getAirtableService();
    const event = await airtable.getEventByEventId(eventId);
    if (!event) {
      console.log(`[NotificationService] notifyEngineerOfUpload: Event not found: ${eventId}`);
      return;
    }

    // Determine which engineer to notify based on project type
    const engineerId = projectType === 'schulsong'
      ? process.env.ENGINEER_MICHA_ID
      : process.env.ENGINEER_JAKOB_ID;

    if (!engineerId) {
      console.warn(`[NotificationService] No engineer ID configured for ${projectType}`);
      return;
    }

    // Look up engineer from Personen table
    const engineer = await airtable.getPersonById(engineerId);
    if (!engineer || !engineer.email) {
      console.warn(`[NotificationService] Engineer ${engineerId} has no email, skipping notification`);
      return;
    }

    const eventDate = event.event_date
      ? new Date(event.event_date).toLocaleDateString('de-DE', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '';

    const engineerPortalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app'}/engineer/events/${eventId}`;

    const emailData = {
      engineerName: engineer.staff_name,
      schoolName: event.school_name,
      eventDate,
      eventId,
      engineerPortalUrl,
    };

    if (projectType === 'schulsong') {
      await sendEngineerSchulsongUploadedEmail(engineer.email, emailData);
    } else {
      await sendEngineerMinimusikerUploadedEmail(engineer.email, emailData);
    }

    console.log(`[NotificationService] Engineer ${projectType} uploaded notification sent to ${engineer.email} for event ${eventId}`);
  } catch (error) {
    console.error('[NotificationService] Error in notifyEngineerOfUpload:', error);
  }
}
