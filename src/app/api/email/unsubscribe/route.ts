/**
 * Email Unsubscribe Endpoint
 *
 * Handles both GET (browser click) and POST (RFC 8058 List-Unsubscribe-Post).
 * Verifies HMAC-signed email parameter, then sets parent's email_campaigns to 'no'.
 */

import { NextRequest } from 'next/server';
import { verifyUnsubscribeSignature } from '@/lib/utils/unsubscribe';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

function confirmationPage(): Response {
  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Abgemeldet – Minimusiker</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F9F6EE;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F9F6EE;">
    <tr>
      <td align="center" style="padding: 60px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="background-color: #1e3a4c; padding: 24px 32px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Minimusiker</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 32px; text-align: center;">
              <h2 style="margin: 0 0 16px 0; color: #2F4858; font-size: 20px;">Abmeldung erfolgreich</h2>
              <p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Du erh&auml;ltst ab sofort keine Kampagnen-E-Mails mehr von uns.
              </p>
              <p style="margin: 0; color: #a0aec0; font-size: 13px;">
                Wichtige Nachrichten zu deinen Bestellungen erh&auml;ltst du weiterhin.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function errorPage(): Response {
  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fehler – Minimusiker</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F9F6EE;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F9F6EE;">
    <tr>
      <td align="center" style="padding: 60px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="background-color: #1e3a4c; padding: 24px 32px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Minimusiker</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 32px; text-align: center;">
              <h2 style="margin: 0 0 16px 0; color: #2F4858; font-size: 20px;">Ung&uuml;ltiger Link</h2>
              <p style="margin: 0 0 24px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Dieser Abmelde-Link ist ung&uuml;ltig oder abgelaufen.
              </p>
              <p style="margin: 0; color: #a0aec0; font-size: 13px;">
                Bitte kontaktiere <a href="mailto:support@minimusiker.de" style="color: #a0aec0;">support@minimusiker.de</a> f&uuml;r Hilfe.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return new Response(html, {
    status: 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

async function handleUnsubscribe(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  const sig = searchParams.get('sig');

  if (!email || !sig) {
    return errorPage();
  }

  if (!verifyUnsubscribeSignature(email, sig)) {
    return errorPage();
  }

  try {
    const airtable = getAirtableService();
    await airtable.unsubscribeParentByEmail(email);
  } catch (error) {
    console.error('[Unsubscribe] Error updating parent record:', error);
    // Still show success page to avoid leaking information
  }

  return confirmationPage();
}

export async function GET(request: NextRequest): Promise<Response> {
  return handleUnsubscribe(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleUnsubscribe(request);
}
