/**
 * Notification Settings Types
 * Types for admin notification preferences stored in Airtable
 */

// Notification types that can be configured
export type NotificationType = 'new_booking' | 'date_change' | 'cancellation';

// Notification setting record from Airtable
export interface NotificationSetting {
  id: string;
  type: NotificationType;
  recipientEmails: string; // Comma-separated email addresses
  enabled: boolean;
}

// API response for fetching notification settings
export interface NotificationSettingsResponse {
  success: true;
  settings: NotificationSetting[];
}

// API request for updating a notification setting
export interface UpdateNotificationSettingRequest {
  type: NotificationType;
  recipientEmails: string;
  enabled: boolean;
}

// API response for updating a notification setting
export interface UpdateNotificationSettingResponse {
  success: true;
  setting: NotificationSetting;
}

// Error response
export interface NotificationSettingsErrorResponse {
  success: false;
  error: string;
}

// Booking data for notification emails
export interface BookingNotificationData {
  bookingId: string;
  schoolName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  eventDate: string;
  estimatedChildren?: number;
  region?: string;
  address?: string;
  city?: string;
}

// Date change notification data
export interface DateChangeNotificationData extends BookingNotificationData {
  oldDate: string;
  newDate: string;
}

// Cancellation notification data
export interface CancellationNotificationData extends BookingNotificationData {
  reason: 'cancelled' | 'deleted';
}

// Airtable table and field IDs for NotificationSettings
export const NOTIFICATION_SETTINGS_TABLE_ID = 'tbld82JxKX4Ju1XHP';

export const NOTIFICATION_SETTINGS_FIELD_IDS = {
  type: 'fldQGEm9CfxtoX9Ix',
  recipientEmails: 'fldc05iI9SDV6F8Wx',
  enabled: 'fldM2w0mGklqKsCbQ',
} as const;
