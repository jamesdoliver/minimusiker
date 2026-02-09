/**
 * Resend Email Service
 * Handles teacher magic link emails and admin notification emails via Resend
 */

import { Resend } from 'resend';
import {
  BookingNotificationData,
  DateChangeNotificationData,
  CancellationNotificationData,
} from '@/lib/types/notification-settings';
import {
  getTriggerTemplate,
  renderTriggerTemplate,
  renderFullTriggerEmail,
} from './triggerTemplateService';
import { getCampaignEmailTemplate } from './emailTemplateWrapper';

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Lazy-initialize Resend client to avoid build-time errors
let resendInstance: Resend | null = null;

function getResendClient(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@minimusiker.app';
const FROM_NAME = 'Minimusiker';

/**
 * Send a generic campaign email
 */
export async function sendCampaignEmail(
  to: string,
  subject: string,
  html: string
): Promise<SendEmailResult> {
  // Wrap the HTML in the branded template
  const wrappedHtml = getCampaignEmailTemplate(html);

  // Development fallback - log instead of sending
  if (!process.env.RESEND_API_KEY) {
    console.log('========================================');
    console.log('CAMPAIGN EMAIL (Resend not configured):');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('HTML length:', wrappedHtml.length);
    console.log('========================================');
    return { success: true, messageId: 'dev-mode' };
  }

  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html: wrappedHtml,
    });

    if (error) {
      console.error('Resend campaign email error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Resend campaign email error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown email error',
    };
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format a date string for display in German format
 */
function formatDateGerman(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Internal helper: render trigger template and send via Resend.
 */
async function sendTriggerEmail(
  to: string | string[],
  slug: string,
  variables: Record<string, string>,
  logLabel: string,
): Promise<SendEmailResult> {
  const trigger = await getTriggerTemplate(slug);
  if (!trigger.active) return { success: true, messageId: 'disabled' };

  const subject = renderTriggerTemplate(trigger.subject, variables);
  const html = renderFullTriggerEmail(trigger.bodyHtml, variables);

  if (!process.env.RESEND_API_KEY) {
    console.log(`[${logLabel}] (dev) To: ${Array.isArray(to) ? to.join(', ') : to}, Subject: ${subject}`);
    return { success: true, messageId: 'dev-mode' };
  }

  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    });

    if (error) {
      console.error(`Resend ${logLabel} error:`, error);
      return { success: false, error: error.message };
    }

    console.log(`[Notification] ${logLabel} sent to ${Array.isArray(to) ? to.length + ' recipients' : to}`);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error(`Resend ${logLabel} error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown email error',
    };
  }
}

// ============================================================================
// Trigger Email Send Functions
// ============================================================================

/**
 * Send magic link email to teacher for portal login
 */
export async function sendTeacherMagicLinkEmail(
  email: string,
  name: string,
  magicLinkUrl: string
): Promise<SendEmailResult> {
  return sendTriggerEmail(email, 'teacher_magic_link', {
    teacherName: name,
    magicLinkUrl,
  }, 'Teacher magic link');
}

/**
 * Send new booking notification to configured recipients
 */
export async function sendNewBookingNotification(
  recipients: string[],
  data: BookingNotificationData
): Promise<SendEmailResult> {
  if (recipients.length === 0) return { success: true, messageId: 'no-recipients' };

  return sendTriggerEmail(recipients, 'new_booking_notification', {
    schoolName: data.schoolName,
    eventDate: formatDateGerman(data.eventDate),
    contactName: data.contactName,
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone || '',
    estimatedChildren: data.estimatedChildren?.toString() || '',
    region: data.region || '',
    address: data.address ? `${data.address}${data.city ? `, ${data.city}` : ''}` : '',
  }, 'New booking notification');
}

/**
 * Send date change notification to configured recipients
 */
export async function sendDateChangeNotification(
  recipients: string[],
  data: DateChangeNotificationData
): Promise<SendEmailResult> {
  if (recipients.length === 0) return { success: true, messageId: 'no-recipients' };

  return sendTriggerEmail(recipients, 'date_change_notification', {
    schoolName: data.schoolName,
    oldDate: formatDateGerman(data.oldDate),
    newDate: formatDateGerman(data.newDate),
    contactName: data.contactName,
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone || '',
  }, 'Date change notification');
}

/**
 * Send cancellation notification to configured recipients
 */
export async function sendCancellationNotification(
  recipients: string[],
  data: CancellationNotificationData
): Promise<SendEmailResult> {
  if (recipients.length === 0) return { success: true, messageId: 'no-recipients' };

  const isCancelled = data.reason === 'cancelled';
  return sendTriggerEmail(recipients, 'cancellation_notification', {
    schoolName: data.schoolName,
    eventDate: formatDateGerman(data.eventDate),
    contactName: data.contactName,
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone || '',
    title: isCancelled ? 'Buchung storniert' : 'Buchung gelöscht',
    message: isCancelled
      ? 'Diese Buchung wurde im System als storniert markiert.'
      : 'Diese Buchung wurde aus dem System gelöscht.',
    reasonText: isCancelled ? 'Storniert' : 'Gelöscht',
  }, 'Cancellation notification');
}

// ============================================================================
// SCHULSONG TEACHER APPROVED NOTIFICATION
// ============================================================================

export interface SchulsongTeacherApprovedData {
  schoolName: string;
  eventDate: string;
  eventId: string;
}

/**
 * Send schulsong teacher approved notification to configured recipients
 */
export async function sendSchulsongTeacherApprovedNotification(
  recipients: string[],
  data: SchulsongTeacherApprovedData
): Promise<SendEmailResult> {
  if (recipients.length === 0) return { success: true, messageId: 'no-recipients' };

  const adminUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.minimusiker.de'}/admin/bookings`;
  return sendTriggerEmail(recipients, 'schulsong_teacher_approved', {
    schoolName: data.schoolName,
    eventDate: formatDateGerman(data.eventDate),
    adminUrl,
  }, 'Schulsong teacher approved');
}

// ============================================================================
// MIGRATED BREVO EMAILS — Parent Welcome, Staff Booking Alert, Staff Reassignment
// ============================================================================

export interface ParentWelcomeData {
  parentName: string;
  childName: string;
  schoolName: string;
}

export interface StaffBookingAlertData {
  staffName: string;
  schoolName: string;
  contactName: string;
  contactEmail: string;
  bookingDate: string;
  estimatedChildren: number;
  region?: string;
}

export interface EngineerAudioUploadedData {
  engineerName: string;
  schoolName: string;
  eventDate: string;
  eventId: string;
  engineerPortalUrl: string;
}

export interface StaffReassignmentData {
  staffName: string;
  schoolName: string;
  eventDate: string;
  schoolAddress?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  staffPortalUrl: string;
}

/**
 * Send parent welcome email (migrated from Brevo)
 */
export async function sendParentWelcomeEmail(
  email: string,
  data: ParentWelcomeData
): Promise<SendEmailResult> {
  return sendTriggerEmail(email, 'parent_welcome', {
    parentName: data.parentName,
    childName: data.childName,
    schoolName: data.schoolName,
  }, 'Parent welcome');
}

/**
 * Send staff booking alert email (migrated from Brevo)
 */
export async function sendStaffBookingAlertEmail(
  email: string,
  name: string,
  data: StaffBookingAlertData
): Promise<SendEmailResult> {
  return sendTriggerEmail(email, 'staff_booking_alert', {
    staffName: data.staffName,
    schoolName: data.schoolName,
    contactName: data.contactName,
    contactEmail: data.contactEmail,
    bookingDate: data.bookingDate,
    estimatedChildren: data.estimatedChildren.toString(),
    region: data.region || '',
  }, 'Staff booking alert');
}

/**
 * Send staff reassignment email (migrated from Brevo)
 */
export async function sendStaffReassignmentEmail(
  email: string,
  name: string,
  data: StaffReassignmentData
): Promise<SendEmailResult> {
  return sendTriggerEmail(email, 'staff_reassignment', {
    staffName: data.staffName,
    schoolName: data.schoolName,
    eventDate: data.eventDate,
    schoolAddress: data.schoolAddress || '',
    contactPerson: data.contactPerson || '',
    contactEmail: data.contactEmail || '',
    contactPhone: data.contactPhone || '',
    staffPortalUrl: data.staffPortalUrl,
  }, 'Staff reassignment');
}

// ============================================================================
// ENGINEER AUDIO UPLOADED NOTIFICATION
// ============================================================================

/**
 * Send engineer audio uploaded notification
 */
export async function sendEngineerAudioUploadedEmail(
  email: string,
  data: EngineerAudioUploadedData
): Promise<SendEmailResult> {
  return sendTriggerEmail(email, 'engineer_audio_uploaded', {
    engineerName: data.engineerName,
    schoolName: data.schoolName,
    eventDate: data.eventDate,
    eventId: data.eventId,
    engineerPortalUrl: data.engineerPortalUrl,
  }, 'Engineer audio uploaded');
}

// ============================================================================
// SCHULSONG AUDIO RELEASE NOTIFICATION (Teacher)
// ============================================================================

export interface SchulsongAudioReleaseData {
  schoolName: string;
  eventLink: string;
  parentPortalLink: string;
}

/**
 * Send schulsong audio release notification to teacher
 */
export async function sendSchulsongAudioReleaseEmail(
  email: string,
  data: SchulsongAudioReleaseData
): Promise<SendEmailResult> {
  return sendTriggerEmail(email, 'schulsong_audio_release', {
    schoolName: data.schoolName,
    eventLink: data.eventLink,
    parentPortalLink: data.parentPortalLink,
  }, 'Schulsong audio release');
}
