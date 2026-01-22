import { NextRequest, NextResponse } from 'next/server';
import { getEarlyBirdTargets, CampaignRecipient } from '@/lib/services/campaignService';
import { sendCampaignEmail } from '@/lib/services/resendService';

// Target schools for this campaign (access_codes, used for short URLs like minimusiker.app/24)
// - Grundschule am Römerbad (Zunzweier): 24
// - Schule an der Ruhr: 16
const TARGET_ACCESS_CODES = [24, 16];

/**
 * Generate email HTML for early bird reminder
 */
function getEmailHtml(recipient: CampaignRecipient): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Early Bird Reminder</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F9F6EE;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F9F6EE;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">

          <!-- Header -->
          <tr>
            <td style="background-color: #1e3a4c; padding: 32px 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">MiniMusiker</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; color: #2F4858; font-size: 18px; font-weight: 600;">
                Halli Hallo,
              </p>

              <p style="margin: 0 0 20px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                hier melden sich die Minimusiker, denn wir haben gesehen, dass du dein Kind bereits für den Minimusikertag an der <strong>${recipient.schoolName}</strong> registriert hast. Hurra!! Das wird total aufregend und auch wir Großen freuen uns schon sehr auf das Projekt.
              </p>

              <p style="margin: 0 0 20px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Bestimmt habt ihr nach erfolgreicher Registrierung gesehen, dass es in eurem Minimusiker-Familienportal einen eigenen Bereich gibt, wo die Aufnahmen und mehr bestellt werden kann. Dort findet ihr auch kostenfreie Tipps rund ums Üben und Singen. Vielleicht hast du ja Lust, das mit deinem Kind auszuprobieren!?
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 16px 0 24px 0;">
                    <a href="${recipient.loginLink}"
                       style="display: inline-block; background-color: #d85a6a; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(216, 90, 106, 0.3);">
                      Zum Familienportal
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 20px 0; color: #4a5568; font-size: 16px; line-height: 1.6; background-color: #FFF9E6; padding: 16px; border-radius: 8px; border-left: 4px solid #F6C942;">
                <strong>Hier allerdings ein wichtiger Hinweis:</strong> Der 10% Rabatt für deine Bestellung gilt nur noch heute bis Mitternacht. Wenn du also von günstigeren Preisen profitieren möchtest, dann schlage schnell zu und sicher dir jetzt schon eine minicard oder die CD mit den Liedern.
              </p>

              <p style="margin: 0 0 20px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Der 10%-Rabatt gilt auch für die individuellen Schul-T-Shirts und Schul-Hoodies, die extra für den Minimusikertag erstellt werden. Soll Dein Kind bereits im Minimusiker-Outfit am Projekttag teilnehmen, wäre eine Bestellung nur noch heute möglich, damit die Lieferung rechtzeitig vorher bei euch eintrifft. Alle späteren Bestellungen kommen dann erst nach dem Minimusikertag und zusammen mit den Tonträgern zu euch.
              </p>

              <!-- Second CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 8px 0 24px 0;">
                    <a href="${recipient.loginLink}"
                       style="display: inline-block; background-color: #d85a6a; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(216, 90, 106, 0.3);">
                      Jetzt bestellen
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                Wir senden musikalische Grüße<br>
                <strong>Lars & Till von den Minimusikern</strong>
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
              <p style="margin: 0; color: #cbd5e0; font-size: 12px;">
                &copy; ${new Date().getFullYear()} MiniMusiker
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generate email subject for early bird reminder
 */
function getEmailSubject(schoolName: string): string {
  return `Infos zum Minimusikertag an der ${schoolName} - Discount nur noch heute!`;
}

/**
 * POST /api/campaigns/early-bird-reminder
 * Send early bird reminder emails to registered parents who haven't ordered
 *
 * Query params:
 * - dryRun=true: Returns recipient list without sending emails
 *
 * Headers:
 * - X-Campaign-Secret: Must match CAMPAIGN_SECRET env var
 */
export async function POST(request: NextRequest) {
  try {
    // Verify campaign secret
    const secret = request.headers.get('X-Campaign-Secret');
    const expectedSecret = process.env.CAMPAIGN_SECRET;

    if (!expectedSecret) {
      console.error('CAMPAIGN_SECRET environment variable not set');
      return NextResponse.json(
        { success: false, error: 'Campaign endpoint not configured' },
        { status: 500 }
      );
    }

    if (secret !== expectedSecret) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check for dry run mode and email filter
    const { searchParams } = new URL(request.url);
    const isDryRun = searchParams.get('dryRun') === 'true';
    const emailFilter = searchParams.get('emails'); // comma-separated list of emails to filter

    console.log(`Early bird reminder campaign started (dryRun: ${isDryRun})`);
    console.log(`Target access codes: ${TARGET_ACCESS_CODES.join(', ')}`);

    // Get recipients
    let recipients = await getEarlyBirdTargets(TARGET_ACCESS_CODES);

    // Filter by specific emails if provided (for retrying failed sends)
    if (emailFilter) {
      const allowedEmails = new Set(emailFilter.toLowerCase().split(',').map(e => e.trim()));
      recipients = recipients.filter(r => allowedEmails.has(r.email.toLowerCase()));
      console.log(`Filtered to ${recipients.length} recipients from email list`);
    }

    if (isDryRun) {
      return NextResponse.json({
        success: true,
        mode: 'dry-run',
        totalRecipients: recipients.length,
        recipients: recipients.map(r => ({
          email: r.email,
          firstName: r.firstName,
          schoolName: r.schoolName,
          loginLink: r.loginLink,
        })),
      });
    }

    // Live send mode
    const results = {
      total: recipients.length,
      sent: 0,
      failed: 0,
      details: [] as { email: string; success: boolean; error?: string; messageId?: string }[],
    };

    for (const recipient of recipients) {
      const subject = getEmailSubject(recipient.schoolName);
      const html = getEmailHtml(recipient);

      const result = await sendCampaignEmail(recipient.email, subject, html);

      if (result.success) {
        results.sent++;
        results.details.push({
          email: recipient.email,
          success: true,
          messageId: result.messageId,
        });
      } else {
        results.failed++;
        results.details.push({
          email: recipient.email,
          success: false,
          error: result.error,
        });
      }

      // 500ms delay between emails to stay under Resend's 2 req/sec rate limit
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`Campaign complete: ${results.sent} sent, ${results.failed} failed`);

    return NextResponse.json({
      success: true,
      mode: 'live',
      summary: {
        total: results.total,
        sent: results.sent,
        failed: results.failed,
      },
      details: results.details,
    });
  } catch (error) {
    console.error('Campaign error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/campaigns/early-bird-reminder
 * Returns info about the campaign endpoint
 */
export async function GET(request: NextRequest) {
  // Verify campaign secret for GET as well
  const secret = request.headers.get('X-Campaign-Secret');
  const expectedSecret = process.env.CAMPAIGN_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    endpoint: '/api/campaigns/early-bird-reminder',
    method: 'POST',
    description: 'Send early bird reminder emails to registered parents who have not ordered',
    targetAccessCodes: TARGET_ACCESS_CODES,
    queryParams: {
      dryRun: 'Set to "true" to get recipient list without sending emails',
    },
    headers: {
      'X-Campaign-Secret': 'Required - must match CAMPAIGN_SECRET env var',
    },
  });
}
