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
} from '@/lib/types/notification-settings';
import {
  sendNewBookingNotification,
  sendDateChangeNotification,
  sendCancellationNotification,
} from './resendService';

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
