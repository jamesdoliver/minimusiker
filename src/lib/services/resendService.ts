/**
 * Resend Email Service
 * Handles teacher magic link emails via Resend
 */

import { Resend } from 'resend';

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
