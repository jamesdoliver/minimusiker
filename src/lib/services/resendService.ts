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
 * Generate the HTML email template for teacher magic links
 */
function getTeacherMagicLinkTemplate(teacherName: string, magicLinkUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dein Login-Link</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F9F6EE;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F9F6EE;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">

          <!-- Header -->
          <tr>
            <td style="background-color: #1e3a4c; padding: 32px 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Minimusiker</h1>
              <p style="margin: 8px 0 0 0; color: #94B8B3; font-size: 14px;">Pädagogen-Portal</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px 0; color: #2F4858; font-size: 22px; font-weight: 600;">
                Hallo ${teacherName},
              </h2>

              <p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Du hast einen Login-Link für das Minimusiker Pädagogen-Portal angefordert.
                Klicke auf den Button unten, um dich anzumelden:
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 8px 0 32px 0;">
                    <a href="${magicLinkUrl}"
                       style="display: inline-block; background-color: #d85a6a; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(216, 90, 106, 0.3);">
                      Jetzt einloggen
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px 0; color: #718096; font-size: 14px; line-height: 1.6;">
                <strong>Hinweis:</strong> Dieser Link ist <strong>24 Stunden</strong> gültig und kann nur einmal verwendet werden.
              </p>

              <p style="margin: 0; color: #718096; font-size: 14px; line-height: 1.6;">
                Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br>
                <a href="${magicLinkUrl}" style="color: #d85a6a; word-break: break-all;">${magicLinkUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid #e8e8e8; margin: 0;">
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px 40px; text-align: center;">
              <p style="margin: 0 0 8px 0; color: #a0aec0; font-size: 13px;">
                Du hast diese E-Mail erhalten, weil jemand einen Login-Link für dein Konto angefordert hat.
              </p>
              <p style="margin: 0; color: #a0aec0; font-size: 13px;">
                Falls du das nicht warst, kannst du diese E-Mail ignorieren.
              </p>
              <p style="margin: 16px 0 0 0; color: #cbd5e0; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Minimusiker
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

/**
 * Generate the HTML email wrapper for campaign emails
 * Provides consistent Minimusiker branding (header, footer, styling)
 */
export function getCampaignEmailTemplate(bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Minimusiker</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F9F6EE;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F9F6EE;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">

          <!-- Header -->
          <tr>
            <td style="background-color: #1e3a4c; padding: 32px 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Minimusiker</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid #e8e8e8; margin: 0;">
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px 40px; text-align: center;">
              <p style="margin: 0; color: #cbd5e0; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Minimusiker
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

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
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error) {
    console.error('Resend campaign email error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown email error',
    };
  }
}

/**
 * Send magic link email to teacher for portal login
 */
export async function sendTeacherMagicLinkEmail(
  email: string,
  name: string,
  magicLinkUrl: string
): Promise<SendEmailResult> {
  // Development fallback - log instead of sending
  if (!process.env.RESEND_API_KEY) {
    console.log('========================================');
    console.log('EMAIL (Resend not configured):');
    console.log('To:', email);
    console.log('Name:', name);
    console.log('Magic Link URL:', magicLinkUrl);
    console.log('========================================');
    return { success: true, messageId: 'dev-mode' };
  }

  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: 'Dein Login-Link für das Minimusiker Pädagogen-Portal',
      html: getTeacherMagicLinkTemplate(name, magicLinkUrl),
    });

    if (error) {
      console.error('Resend email error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error) {
    console.error('Resend email error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown email error',
    };
  }
}

// ============================================================================
// Admin Notification Emails
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
 * Generate HTML template for new booking notification
 */
function getNewBookingNotificationTemplate(data: BookingNotificationData): string {
  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Neue Buchung</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F9F6EE;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F9F6EE;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">

          <!-- Header -->
          <tr>
            <td style="background-color: #1e3a4c; padding: 32px 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Minimusiker</h1>
              <p style="margin: 8px 0 0 0; color: #94B8B3; font-size: 14px;">Admin Benachrichtigung</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 24px 0; color: #2F4858; font-size: 22px; font-weight: 600;">
                Neue Buchung eingegangen
              </h2>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
                    <strong style="color: #2F4858;">Schule:</strong>
                    <span style="color: #4a5568; float: right;">${data.schoolName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
                    <strong style="color: #2F4858;">Datum:</strong>
                    <span style="color: #4a5568; float: right;">${formatDateGerman(data.eventDate)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
                    <strong style="color: #2F4858;">Kontaktperson:</strong>
                    <span style="color: #4a5568; float: right;">${data.contactName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
                    <strong style="color: #2F4858;">E-Mail:</strong>
                    <span style="color: #4a5568; float: right;">${data.contactEmail}</span>
                  </td>
                </tr>
                ${data.contactPhone ? `
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
                    <strong style="color: #2F4858;">Telefon:</strong>
                    <span style="color: #4a5568; float: right;">${data.contactPhone}</span>
                  </td>
                </tr>
                ` : ''}
                ${data.estimatedChildren ? `
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
                    <strong style="color: #2F4858;">Geschätzte Kinderzahl:</strong>
                    <span style="color: #4a5568; float: right;">${data.estimatedChildren}</span>
                  </td>
                </tr>
                ` : ''}
                ${data.region ? `
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
                    <strong style="color: #2F4858;">Region:</strong>
                    <span style="color: #4a5568; float: right;">${data.region}</span>
                  </td>
                </tr>
                ` : ''}
                ${data.address ? `
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
                    <strong style="color: #2F4858;">Adresse:</strong>
                    <span style="color: #4a5568; float: right;">${data.address}${data.city ? `, ${data.city}` : ''}</span>
                  </td>
                </tr>
                ` : ''}
              </table>

              <p style="margin: 0; color: #718096; font-size: 14px; line-height: 1.6;">
                Diese Buchung wurde automatisch im System erfasst.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px 40px; text-align: center; border-top: 1px solid #e8e8e8;">
              <p style="margin: 0; color: #cbd5e0; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Minimusiker - Admin Benachrichtigung
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

/**
 * Generate HTML template for date change notification
 */
function getDateChangeNotificationTemplate(data: DateChangeNotificationData): string {
  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terminänderung</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F9F6EE;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F9F6EE;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">

          <!-- Header -->
          <tr>
            <td style="background-color: #1e3a4c; padding: 32px 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Minimusiker</h1>
              <p style="margin: 8px 0 0 0; color: #94B8B3; font-size: 14px;">Admin Benachrichtigung</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 24px 0; color: #2F4858; font-size: 22px; font-weight: 600;">
                Terminänderung
              </h2>

              <!-- Date Change Highlight -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; background-color: #FFF3CD; border-radius: 8px; padding: 16px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0 0 8px 0; color: #856404; font-size: 14px;">
                      <strong>Alter Termin:</strong> <span style="text-decoration: line-through;">${formatDateGerman(data.oldDate)}</span>
                    </p>
                    <p style="margin: 0; color: #155724; font-size: 16px; font-weight: 600;">
                      <strong>Neuer Termin:</strong> ${formatDateGerman(data.newDate)}
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
                    <strong style="color: #2F4858;">Schule:</strong>
                    <span style="color: #4a5568; float: right;">${data.schoolName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
                    <strong style="color: #2F4858;">Kontaktperson:</strong>
                    <span style="color: #4a5568; float: right;">${data.contactName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
                    <strong style="color: #2F4858;">E-Mail:</strong>
                    <span style="color: #4a5568; float: right;">${data.contactEmail}</span>
                  </td>
                </tr>
                ${data.contactPhone ? `
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
                    <strong style="color: #2F4858;">Telefon:</strong>
                    <span style="color: #4a5568; float: right;">${data.contactPhone}</span>
                  </td>
                </tr>
                ` : ''}
              </table>

              <p style="margin: 0; color: #718096; font-size: 14px; line-height: 1.6;">
                Der Termin wurde im Admin- oder Pädagogen-Portal geändert.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px 40px; text-align: center; border-top: 1px solid #e8e8e8;">
              <p style="margin: 0; color: #cbd5e0; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Minimusiker - Admin Benachrichtigung
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

/**
 * Generate HTML template for cancellation notification
 */
function getCancellationNotificationTemplate(data: CancellationNotificationData): string {
  const isCancelled = data.reason === 'cancelled';
  const title = isCancelled ? 'Buchung storniert' : 'Buchung gelöscht';
  const message = isCancelled
    ? 'Diese Buchung wurde im System als storniert markiert.'
    : 'Diese Buchung wurde aus dem System gelöscht.';

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F9F6EE;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F9F6EE;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">

          <!-- Header -->
          <tr>
            <td style="background-color: #1e3a4c; padding: 32px 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Minimusiker</h1>
              <p style="margin: 8px 0 0 0; color: #94B8B3; font-size: 14px;">Admin Benachrichtigung</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 24px 0; color: #dc3545; font-size: 22px; font-weight: 600;">
                ${title}
              </h2>

              <!-- Warning Banner -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px; background-color: #f8d7da; border-radius: 8px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="margin: 0; color: #721c24; font-size: 14px;">
                      ${message}
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
                    <strong style="color: #2F4858;">Schule:</strong>
                    <span style="color: #4a5568; float: right;">${data.schoolName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
                    <strong style="color: #2F4858;">Geplantes Datum:</strong>
                    <span style="color: #4a5568; float: right;">${formatDateGerman(data.eventDate)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
                    <strong style="color: #2F4858;">Kontaktperson:</strong>
                    <span style="color: #4a5568; float: right;">${data.contactName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
                    <strong style="color: #2F4858;">E-Mail:</strong>
                    <span style="color: #4a5568; float: right;">${data.contactEmail}</span>
                  </td>
                </tr>
                ${data.contactPhone ? `
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
                    <strong style="color: #2F4858;">Telefon:</strong>
                    <span style="color: #4a5568; float: right;">${data.contactPhone}</span>
                  </td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px 40px; text-align: center; border-top: 1px solid #e8e8e8;">
              <p style="margin: 0; color: #cbd5e0; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Minimusiker - Admin Benachrichtigung
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

/**
 * Send new booking notification to configured recipients
 */
export async function sendNewBookingNotification(
  recipients: string[],
  data: BookingNotificationData
): Promise<SendEmailResult> {
  if (recipients.length === 0) {
    return { success: true, messageId: 'no-recipients' };
  }

  const html = getNewBookingNotificationTemplate(data);
  const subject = `Neue Buchung: ${data.schoolName} - ${formatDateGerman(data.eventDate)}`;

  // Development fallback
  if (!process.env.RESEND_API_KEY) {
    console.log('========================================');
    console.log('NEW BOOKING NOTIFICATION (Resend not configured):');
    console.log('To:', recipients.join(', '));
    console.log('Subject:', subject);
    console.log('School:', data.schoolName);
    console.log('Date:', data.eventDate);
    console.log('========================================');
    return { success: true, messageId: 'dev-mode' };
  }

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: recipients,
      subject,
      html,
    });

    if (error) {
      console.error('Resend new booking notification error:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Notification] New booking notification sent to ${recipients.length} recipients`);
    return { success: true, messageId: resendData?.id };
  } catch (error) {
    console.error('Resend new booking notification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown email error',
    };
  }
}

/**
 * Send date change notification to configured recipients
 */
export async function sendDateChangeNotification(
  recipients: string[],
  data: DateChangeNotificationData
): Promise<SendEmailResult> {
  if (recipients.length === 0) {
    return { success: true, messageId: 'no-recipients' };
  }

  const html = getDateChangeNotificationTemplate(data);
  const subject = `Terminänderung: ${data.schoolName} - ${formatDateGerman(data.oldDate)} → ${formatDateGerman(data.newDate)}`;

  // Development fallback
  if (!process.env.RESEND_API_KEY) {
    console.log('========================================');
    console.log('DATE CHANGE NOTIFICATION (Resend not configured):');
    console.log('To:', recipients.join(', '));
    console.log('Subject:', subject);
    console.log('School:', data.schoolName);
    console.log('Old Date:', data.oldDate);
    console.log('New Date:', data.newDate);
    console.log('========================================');
    return { success: true, messageId: 'dev-mode' };
  }

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: recipients,
      subject,
      html,
    });

    if (error) {
      console.error('Resend date change notification error:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Notification] Date change notification sent to ${recipients.length} recipients`);
    return { success: true, messageId: resendData?.id };
  } catch (error) {
    console.error('Resend date change notification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown email error',
    };
  }
}

/**
 * Send cancellation notification to configured recipients
 */
export async function sendCancellationNotification(
  recipients: string[],
  data: CancellationNotificationData
): Promise<SendEmailResult> {
  if (recipients.length === 0) {
    return { success: true, messageId: 'no-recipients' };
  }

  const html = getCancellationNotificationTemplate(data);
  const reasonText = data.reason === 'cancelled' ? 'Storniert' : 'Gelöscht';
  const subject = `Buchung ${reasonText}: ${data.schoolName} - ${formatDateGerman(data.eventDate)}`;

  // Development fallback
  if (!process.env.RESEND_API_KEY) {
    console.log('========================================');
    console.log('CANCELLATION NOTIFICATION (Resend not configured):');
    console.log('To:', recipients.join(', '));
    console.log('Subject:', subject);
    console.log('School:', data.schoolName);
    console.log('Reason:', data.reason);
    console.log('========================================');
    return { success: true, messageId: 'dev-mode' };
  }

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: recipients,
      subject,
      html,
    });

    if (error) {
      console.error('Resend cancellation notification error:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Notification] Cancellation notification sent to ${recipients.length} recipients`);
    return { success: true, messageId: resendData?.id };
  } catch (error) {
    console.error('Resend cancellation notification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown email error',
    };
  }
}

// ============================================================================
// SCHULSONG TEACHER APPROVED NOTIFICATION
// ============================================================================

export interface SchulsongTeacherApprovedData {
  schoolName: string;
  eventDate: string;
  eventId: string;
}

function getSchulsongTeacherApprovedTemplate(data: SchulsongTeacherApprovedData): string {
  const adminUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.minimusiker.de'}/admin/bookings`;
  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Schulsong freigegeben</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F9F6EE;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F9F6EE;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">

          <!-- Header -->
          <tr>
            <td style="background-color: #1e3a4c; padding: 32px 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Minimusiker</h1>
              <p style="margin: 8px 0 0 0; color: #94B8B3; font-size: 14px;">Admin Benachrichtigung</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 24px 0; color: #2F4858; font-size: 22px; font-weight: 600;">
                Schulsong vom Lehrer freigegeben
              </h2>

              <p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.5;">
                Der Lehrer hat den Schulsong freigegeben. Bitte prüfen und bestätigen Sie die Veröffentlichung.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
                    <strong style="color: #2F4858;">Schule:</strong>
                    <span style="color: #4a5568; float: right;">${data.schoolName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #e8e8e8;">
                    <strong style="color: #2F4858;">Datum:</strong>
                    <span style="color: #4a5568; float: right;">${formatDateGerman(data.eventDate)}</span>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 8px 0;">
                    <a href="${adminUrl}" style="display: inline-block; padding: 14px 32px; background-color: #1e3a4c; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Im Admin-Bereich prüfen
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px 32px 40px; text-align: center; border-top: 1px solid #e8e8e8;">
              <p style="margin: 0; color: #cbd5e0; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Minimusiker - Admin Benachrichtigung
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();
}

/**
 * Send schulsong teacher approved notification to configured recipients
 */
export async function sendSchulsongTeacherApprovedNotification(
  recipients: string[],
  data: SchulsongTeacherApprovedData
): Promise<SendEmailResult> {
  if (recipients.length === 0) {
    return { success: true, messageId: 'no-recipients' };
  }

  const html = getSchulsongTeacherApprovedTemplate(data);
  const subject = `Schulsong freigegeben: ${data.schoolName} - ${formatDateGerman(data.eventDate)}`;

  // Development fallback
  if (!process.env.RESEND_API_KEY) {
    console.log('========================================');
    console.log('SCHULSONG TEACHER APPROVED NOTIFICATION (Resend not configured):');
    console.log('To:', recipients.join(', '));
    console.log('Subject:', subject);
    console.log('School:', data.schoolName);
    console.log('Date:', data.eventDate);
    console.log('========================================');
    return { success: true, messageId: 'dev-mode' };
  }

  try {
    const resend = getResendClient();
    const { data: resendData, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: recipients,
      subject,
      html,
    });

    if (error) {
      console.error('Resend schulsong teacher approved notification error:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Notification] Schulsong teacher approved notification sent to ${recipients.length} recipients`);
    return { success: true, messageId: resendData?.id };
  } catch (error) {
    console.error('Resend schulsong teacher approved notification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown email error',
    };
  }
}
