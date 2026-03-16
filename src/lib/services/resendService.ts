/**
 * Resend Email Service
 * Handles teacher magic link emails and admin notification emails via Resend
 */

import { Resend } from 'resend';
import {
  BookingNotificationData,
  DateChangeNotificationData,
  CancellationNotificationData,
  UnassignedStaffNotificationData,
} from '@/lib/types/notification-settings';
import {
  getTriggerTemplate,
  renderTriggerTemplate,
  renderFullTriggerEmail,
} from './triggerTemplateService';
import { getCampaignEmailTemplate, EmailTemplateOptions } from './emailTemplateWrapper';
import { generateUnsubscribeUrl } from '@/lib/utils/unsubscribe';
import { getActivityService } from '@/lib/services/activityService';

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface CampaignEmailOptions extends EmailTemplateOptions {
  headers?: Record<string, string>;
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
  html: string,
  options?: CampaignEmailOptions
): Promise<SendEmailResult> {
  // Wrap the HTML in the branded template
  const wrappedHtml = getCampaignEmailTemplate(html, options);

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
      headers: options?.headers,
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
  options?: { parentEmail?: string; eventRecordId?: string },
): Promise<SendEmailResult> {
  const trigger = await getTriggerTemplate(slug);
  if (!trigger.active) return { success: true, messageId: 'disabled' };

  // Build unsubscribe options for parent emails
  const isParent = !!options?.parentEmail;
  const unsubscribeUrl = isParent ? generateUnsubscribeUrl(options!.parentEmail!) : undefined;
  const templateOptions = isParent && unsubscribeUrl
    ? { showUnsubscribe: true, unsubscribeUrl }
    : undefined;

  const subject = renderTriggerTemplate(trigger.subject, variables);
  const html = renderFullTriggerEmail(trigger.bodyHtml, variables, templateOptions);

  const headers = isParent && unsubscribeUrl
    ? {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      }
    : undefined;

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
      headers,
    });

    if (error) {
      console.error(`Resend ${logLabel} error:`, error);
      return { success: false, error: error.message };
    }

    console.log(`[Notification] ${logLabel} sent to ${Array.isArray(to) ? to.length + ' recipients' : to}`);

    // Log email_sent activity (fire-and-forget)
    if (options?.eventRecordId) {
      getActivityService().logActivity({
        eventRecordId: options.eventRecordId,
        activityType: 'email_sent',
        description: `${logLabel} sent to ${Array.isArray(to) ? to.join(', ') : to}`,
        actorEmail: 'system@minimusiker.de',
        actorType: 'system',
        metadata: { slug, recipient: Array.isArray(to) ? to.join(', ') : to },
      });
    }

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
    status: data.status || '',
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

/**
 * Send unassigned staff alert to configured admin recipients
 */
export async function sendUnassignedStaffAlertEmail(
  recipients: string[],
  data: UnassignedStaffNotificationData
): Promise<SendEmailResult> {
  if (recipients.length === 0) return { success: true, messageId: 'no-recipients' };

  return sendTriggerEmail(recipients, 'unassigned_staff_alert', {
    schoolName: data.schoolName,
    eventDate: formatDateGerman(data.eventDate),
    region: data.region || 'Nicht angegeben',
    bookingId: data.bookingId,
    unitId: data.unitId || 'Nicht angegeben',
    reason: data.reason,
  }, 'Unassigned staff alert');
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

  const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app'}/admin/bookings`;
  return sendTriggerEmail(recipients, 'schulsong_teacher_approved', {
    schoolName: data.schoolName,
    eventDate: formatDateGerman(data.eventDate),
    adminUrl,
  }, 'Schulsong teacher approved');
}

export interface SchulsongTeacherRejectedData {
  schoolName: string;
  eventDate: string;
  eventId: string;
  teacherNotes?: string;
}

/**
 * Send schulsong teacher rejected notification to configured admin recipients
 */
export async function sendSchulsongTeacherRejectedNotification(
  recipients: string[],
  data: SchulsongTeacherRejectedData
): Promise<SendEmailResult> {
  if (recipients.length === 0) return { success: true, messageId: 'no-recipients' };

  const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app'}/admin/bookings`;
  return sendTriggerEmail(recipients, 'schulsong_teacher_rejected', {
    schoolName: data.schoolName,
    eventDate: formatDateGerman(data.eventDate),
    teacherNotes: data.teacherNotes || 'Keine Anmerkungen',
    adminUrl,
  }, 'Schulsong teacher rejected');
}

// ============================================================================
// SCHULSONG APPROVAL REMINDER + MERCH LAST CHANCE
// ============================================================================

/**
 * Send schulsong approval reminder to teacher and admin recipients
 */
export async function sendSchulsongApprovalReminderEmail(
  recipients: string[],
  data: { schoolName: string; eventDate: string; daysPending: string }
): Promise<SendEmailResult> {
  if (recipients.length === 0) return { success: true, messageId: 'no-recipients' };

  const teacherPortalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app'}/paedagogen`;
  return sendTriggerEmail(recipients, 'schulsong_approval_reminder', {
    schoolName: data.schoolName,
    eventDate: formatDateGerman(data.eventDate),
    teacherPortalUrl,
    daysPending: data.daysPending,
  }, 'Schulsong approval reminder');
}

/**
 * Send last chance merch email to a single parent recipient
 */
export async function sendSchulsongMerchLastChanceEmail(
  recipientEmail: string,
  data: { schoolName: string; parentName: string; cutoffDate: string }
): Promise<SendEmailResult> {
  const parentPortalLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app'}/familie`;
  return sendTriggerEmail(recipientEmail, 'schulsong_merch_last_chance', {
    schoolName: data.schoolName,
    parentName: data.parentName,
    parentPortalLink,
    cutoffDate: data.cutoffDate,
  }, 'Schulsong merch last chance', {
    parentEmail: recipientEmail,
  });
}

// ============================================================================
// SCHULSONG TEACHER REVIEW NOTIFICATIONS
// ============================================================================

export interface SchulsongTeacherActionData {
  schoolName: string;
  eventDate: string;
  eventId: string;
  action: 'approved' | 'rejected';
  teacherNotes?: string;
}

export interface SchulsongNewVersionData {
  schoolName: string;
  eventDate: string;
  teacherPortalUrl: string;
}

/**
 * Send notification to engineer when teacher approves or rejects schulsong
 */
export async function sendSchulsongTeacherActionEmail(
  engineerEmail: string,
  engineerName: string,
  data: SchulsongTeacherActionData
): Promise<SendEmailResult> {
  const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://minimusiker.app'}/admin/bookings`;
  return sendTriggerEmail(engineerEmail, 'schulsong_teacher_action', {
    engineerName,
    schoolName: data.schoolName,
    eventDate: formatDateGerman(data.eventDate),
    action: data.action === 'approved' ? 'freigegeben' : 'abgelehnt',
    teacherNotes: data.teacherNotes || 'Keine Anmerkungen',
    adminUrl,
  }, `Schulsong teacher ${data.action}`);
}

/**
 * Send notification to teacher when a new schulsong version is uploaded
 */
export async function sendSchulsongNewVersionEmail(
  teacherEmail: string,
  data: SchulsongNewVersionData
): Promise<SendEmailResult> {
  return sendTriggerEmail(teacherEmail, 'schulsong_new_version', {
    schoolName: data.schoolName,
    eventDate: formatDateGerman(data.eventDate),
    teacherPortalUrl: data.teacherPortalUrl,
  }, 'Schulsong new version');
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
  }, 'Parent welcome', { parentEmail: email });
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

/**
 * Send engineer notification when Schulsong Logic Project is uploaded
 */
export async function sendEngineerSchulsongUploadedEmail(
  email: string,
  data: EngineerAudioUploadedData
): Promise<SendEmailResult> {
  return sendTriggerEmail(email, 'engineer_schulsong_uploaded', {
    engineerName: data.engineerName,
    schoolName: data.schoolName,
    eventDate: data.eventDate,
    eventId: data.eventId,
    engineerPortalUrl: data.engineerPortalUrl,
  }, 'Engineer schulsong uploaded');
}

/**
 * Send engineer notification when MiniMusiker Logic Project is uploaded
 */
export async function sendEngineerMinimusikerUploadedEmail(
  email: string,
  data: EngineerAudioUploadedData
): Promise<SendEmailResult> {
  return sendTriggerEmail(email, 'engineer_minimusiker_uploaded', {
    engineerName: data.engineerName,
    schoolName: data.schoolName,
    eventDate: data.eventDate,
    eventId: data.eventId,
    engineerPortalUrl: data.engineerPortalUrl,
  }, 'Engineer minimusiker uploaded');
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

// ============================================================================
// TEACHER INVITE EMAIL
// ============================================================================

export interface TeacherInviteEmailData {
  inviterName: string;
  schoolName: string;
  eventDate: string;
  eventType: string;
  inviteUrl: string;
}

/**
 * Send invite email to a teacher being invited to an event
 */
export async function sendTeacherInviteEmail(
  email: string,
  data: TeacherInviteEmailData
): Promise<SendEmailResult> {
  return sendTriggerEmail(email, 'teacher_invite', {
    inviterName: data.inviterName,
    schoolName: data.schoolName,
    eventDate: formatDateGerman(data.eventDate),
    eventType: data.eventType,
    inviteUrl: data.inviteUrl,
  }, 'Teacher invite');
}
