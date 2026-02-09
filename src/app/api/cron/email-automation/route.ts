/**
 * Email Automation Cron Endpoint
 *
 * This endpoint is called by Vercel Cron to process automated email sending.
 * It runs every hour and only processes templates whose triggerHour matches
 * the current Europe/Berlin hour.
 *
 * @route POST /api/cron/email-automation
 * @security Protected by CRON_SECRET environment variable
 */

import { NextRequest, NextResponse } from 'next/server';
import { processEmailAutomation, processSchulsongReleaseEmails, getCurrentBerlinHour } from '@/lib/services/emailAutomationService';
import { CronAutomationResponse } from '@/lib/types/email-automation';

export const dynamic = 'force-dynamic';

/**
 * Verify the request is from Vercel Cron
 * Vercel sends the CRON_SECRET in the Authorization header as a Bearer token
 */
function verifyCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;

  // If no CRON_SECRET is configured, reject all requests
  if (!cronSecret) {
    console.error('[Email Automation Cron] CRON_SECRET environment variable not set');
    return false;
  }

  // Check for Bearer token format
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return token === cronSecret;
  }

  // Also check X-Cron-Secret header as fallback for manual testing
  const cronHeader = request.headers.get('X-Cron-Secret');
  if (cronHeader === cronSecret) {
    return true;
  }

  return false;
}

/**
 * POST /api/cron/email-automation
 * Process automated email sending based on active templates
 *
 * Query params:
 * - dryRun=true: Returns what would be sent without actually sending emails
 *
 * Headers:
 * - Authorization: Bearer <CRON_SECRET> (set by Vercel Cron)
 * - X-Cron-Secret: <CRON_SECRET> (for manual testing)
 */
export async function POST(request: NextRequest): Promise<NextResponse<CronAutomationResponse>> {
  const startTime = Date.now();

  try {
    // Verify authorization
    if (!verifyCronRequest(request)) {
      console.warn('[Email Automation Cron] Unauthorized request attempt');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check for dry run mode
    const { searchParams } = new URL(request.url);
    const isDryRun = searchParams.get('dryRun') === 'true';

    console.log(`[Email Automation Cron] Starting automation process (dryRun: ${isDryRun})`);

    // Process email automation
    const result = await processEmailAutomation(isDryRun);

    // Process schulsong release emails in the 6-8am Berlin window
    // (covers cron drift; dedup makes multiple runs safe)
    let schulsongResult: { sent: number; skipped: number; failed: number; errors: string[] } | undefined;
    const berlinHour = getCurrentBerlinHour();
    if (berlinHour >= 6 && berlinHour <= 8) {
      console.log(`[Email Automation Cron] Processing schulsong releases (Berlin hour: ${berlinHour})`);
      schulsongResult = await processSchulsongReleaseEmails(isDryRun);
      if (schulsongResult.errors.length > 0) {
        console.error('[Email Automation Cron] Schulsong errors:', schulsongResult.errors);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Email Automation Cron] Completed in ${duration}ms`);
    console.log(
      `[Email Automation Cron] Results: ${result.emailsSent} sent, ${result.emailsFailed} failed, ${result.emailsSkipped} skipped`
    );
    if (schulsongResult) {
      console.log(
        `[Email Automation Cron] Schulsong: ${schulsongResult.sent} sent, ${schulsongResult.skipped} skipped, ${schulsongResult.failed} failed`
      );
    }

    if (result.errors.length > 0) {
      console.error('[Email Automation Cron] Errors:', result.errors);
    }

    return NextResponse.json({
      success: true,
      mode: isDryRun ? 'dry-run' : 'live',
      result,
      schulsongResult,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Email Automation Cron] Fatal error after ${duration}ms:`, error);

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
 * GET /api/cron/email-automation
 * Returns information about the cron endpoint
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Verify authorization for status check as well
  if (!verifyCronRequest(request)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    endpoint: '/api/cron/email-automation',
    method: 'POST',
    description: 'Process automated email sending based on active templates',
    schedule: '0 * * * * (every hour)',
    queryParams: {
      dryRun: 'Set to "true" to preview what would be sent without actually sending',
    },
    headers: {
      Authorization: 'Bearer <CRON_SECRET> - Required for authentication',
    },
    features: [
      'Fetches active email templates from Airtable',
      'Finds events matching each template\'s trigger threshold',
      'Sends emails to teachers and/or parents based on template audience',
      'Logs all email sends to EMAIL_LOGS table for tracking',
      'Prevents duplicate sends by checking log history',
      'Rate limits at 500ms between sends to respect Resend limits',
    ],
  });
}
