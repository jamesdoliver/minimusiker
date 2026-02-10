/**
 * Unsubscribe URL Utility
 *
 * HMAC-signed unsubscribe URLs for parent email opt-out.
 * Follows the same crypto pattern as shopifyWebhook.ts.
 */

import crypto from 'crypto';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.minimusiker.de';

function getSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) {
    throw new Error('UNSUBSCRIBE_SECRET environment variable not configured');
  }
  return secret;
}

/**
 * Generate a signed unsubscribe URL for a parent email.
 */
export function generateUnsubscribeUrl(email: string): string {
  const normalizedEmail = email.toLowerCase();
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(normalizedEmail, 'utf8')
    .digest('hex');

  const params = new URLSearchParams({ email: normalizedEmail, sig });
  return `${BASE_URL}/api/email/unsubscribe?${params.toString()}`;
}

/**
 * Verify an unsubscribe URL signature.
 */
export function verifyUnsubscribeSignature(email: string, sig: string): boolean {
  try {
    const normalizedEmail = email.toLowerCase();
    const expected = crypto
      .createHmac('sha256', getSecret())
      .update(normalizedEmail, 'utf8')
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(sig)
    );
  } catch {
    return false;
  }
}
