/**
 * Data Integrity Service
 *
 * Scans Event records for invariants that silently break downstream
 * behaviour (typically: email routing). The current check is for the
 * mutually-exclusive tier flags is_plus and is_minimusikertag both being
 * true — a state the API normalisation prevents but direct Airtable edits
 * can still introduce.
 *
 * Runs weekly via event-readiness cron; emails admins when anything is flagged.
 */

import { getAirtableService } from './airtableService';
import { Event } from '@/lib/types/airtable';
import { Resend } from 'resend';
import Airtable from 'airtable';

const NOTIFICATION_SETTINGS_TABLE_ID = 'tbld82JxKX4Ju1XHP';
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@minimusiker.app';
const FROM_NAME = 'Minimusiker';

export interface IntegrityCheckResult {
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
  invalidCount?: number;
}

/**
 * Pure filter: returns events with invalid tier flag combinations that
 * are still "live" (not Cancelled, not Deleted).
 *
 * Invalid = is_plus AND is_minimusikertag both true (mutex violated).
 */
export function findInvalidTierFlagEvents(events: Event[]): Event[] {
  return events.filter((e) => {
    if (e.status === 'Cancelled' || e.status === 'Deleted') return false;
    return e.is_plus === true && e.is_minimusikertag === true;
  });
}

async function getAdminRecipients(): Promise<string[]> {
  try {
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
      process.env.AIRTABLE_BASE_ID!
    );
    const records = await base(NOTIFICATION_SETTINGS_TABLE_ID)
      .select({ filterByFormula: `{type} = "event_readiness"`, maxRecords: 1 })
      .firstPage();
    if (records.length === 0) return [];
    const enabled = records[0].fields['enabled'] as boolean;
    if (!enabled) return [];
    const emails = (records[0].fields['recipientEmails'] as string) || '';
    return emails
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  } catch (error) {
    console.error('[DataIntegrity] Error fetching admin recipients:', error);
    return [];
  }
}

function buildAlertHtml(invalidEvents: Event[]): string {
  const rows = invalidEvents
    .map(
      (e) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${e.school_name || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${e.event_date || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${e.status || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:ui-monospace,monospace;font-size:12px;">${e.event_id}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#111827;">
  <h2 style="font-size:18px;margin:0 0 8px 0;">Data-integrity alert — invalid event tier flags</h2>
  <p style="color:#6b7280;font-size:13px;margin:0 0 16px 0;">Weekly audit · ${new Date().toISOString().slice(0, 10)}</p>
  <p style="font-size:14px;line-height:1.55;">
    ${invalidEvents.length} event${invalidEvents.length === 1 ? '' : 's'}
    ha${invalidEvents.length === 1 ? 's' : 've'} both <code>is_plus=true</code> and <code>is_minimusikertag=true</code>.
    These flags are mutually exclusive. Events in this state can silently skip emails whose template tier doesn't match
    the resolved event tier (PLUS wins the priority chain). Typically caused by a direct Airtable edit that bypasses
    the admin API normalisation.
  </p>
  <table style="border-collapse:collapse;width:100%;background:#fff;border:1px solid #e5e7eb;margin:12px 0;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;">School</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;">Event date</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;">Status</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;">Event ID</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="font-size:13px;color:#6b7280;line-height:1.55;margin-top:16px;">
    <strong>How to fix:</strong> for each event, open <code>/admin/events/&lt;eventId&gt;</code> and decide whether
    the event is actually PLUS or Minimusikertag using the tier segmented control. Saving via the admin UI will
    normalise the flags.
  </p>
</body>
</html>`;
}

/**
 * Full integrity check: fetch events, find invalid combos, email admins.
 */
export async function checkDataIntegrityFlags(dryRun = false): Promise<IntegrityCheckResult> {
  const result: IntegrityCheckResult = { sent: 0, skipped: 0, failed: 0, errors: [] };

  try {
    const airtable = getAirtableService();
    const events = await airtable.getAllEvents();
    const invalid = findInvalidTierFlagEvents(events);
    result.invalidCount = invalid.length;

    console.log(`[DataIntegrity] Scanned ${events.length} events, found ${invalid.length} with invalid tier flags`);

    if (invalid.length === 0) {
      result.skipped++;
      return result;
    }

    if (dryRun) {
      console.log(`[DataIntegrity] DRY RUN — would alert about ${invalid.length} event(s)`);
      result.skipped++;
      return result;
    }

    const recipients = await getAdminRecipients();
    if (recipients.length === 0) {
      console.warn('[DataIntegrity] No admin recipients configured; skipping alert');
      result.skipped++;
      return result;
    }

    if (!process.env.RESEND_API_KEY) {
      console.warn('[DataIntegrity] RESEND_API_KEY not set; skipping alert');
      result.skipped++;
      return result;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: recipients,
      subject: `[Minimusiker] Data integrity alert — ${invalid.length} event${invalid.length === 1 ? '' : 's'} with invalid tier flags`,
      html: buildAlertHtml(invalid),
    });

    if (error) {
      result.failed++;
      result.errors.push(error.message);
      console.error('[DataIntegrity] Email send failed:', error);
    } else {
      result.sent++;
      console.log(`[DataIntegrity] Alert sent to ${recipients.length} recipient(s), id: ${data?.id}`);
    }
  } catch (error) {
    result.failed++;
    const msg = error instanceof Error ? error.message : String(error);
    result.errors.push(msg);
    console.error('[DataIntegrity] Fatal error:', msg);
  }

  return result;
}
