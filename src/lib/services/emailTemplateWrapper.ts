/**
 * Email Template Wrapper
 *
 * Provides the branded HTML wrapper for campaign/trigger emails.
 * Extracted to its own module to avoid circular dependencies between
 * resendService and triggerTemplateService.
 */

export interface EmailTemplateOptions {
  showUnsubscribe?: boolean;
  unsubscribeUrl?: string;
}

/**
 * Generate the HTML email wrapper for campaign emails.
 * Provides consistent Minimusiker branding (header, footer, styling).
 */
export function getCampaignEmailTemplate(
  bodyHtml: string,
  options?: EmailTemplateOptions
): string {
  const year = new Date().getFullYear();
  const unsubscribeHtml = options?.showUnsubscribe && options?.unsubscribeUrl
    ? `<p style="margin: 6px 0 0 0;">
              <a href="${options.unsubscribeUrl}" style="color: #cbd5e0; font-size: 9px; text-decoration: none;">E-Mail-Einstellungen</a>
            </p>`
    : '';

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
                &copy; ${year} Minimusiker
              </p>
              <p style="margin: 8px 0 0 0; color: #a0aec0; font-size: 10px; line-height: 1.5;">
                Minimusiker &middot; powered by Guesstimate Nexus &middot; Polytope Management Group<br>
                Guesstimate Loftyard Studios &middot; Willdenowstra&szlig;e 4, 13353 Berlin<br>
                <a href="mailto:support@minimusiker.de" style="color: #a0aec0; text-decoration: none;">support@minimusiker.de</a>
              </p>
              ${unsubscribeHtml}
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
