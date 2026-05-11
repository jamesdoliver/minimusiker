import type { EventActivity } from '@/lib/types/airtable';
import type { EmailLog } from '@/lib/types/email-automation';

/**
 * Merge EVENT_ACTIVITY rows with EMAIL_LOGS rows for unified timeline display.
 *
 * Dedup rule: an EMAIL_LOGS row is excluded if any activity has
 * `metadata.emailLogId === log.id`. Activities always win over their email-log
 * counterpart so we don't show two rows for the same send.
 *
 * Only logs with status='sent' become synthetic activities — failures and
 * skips stay in the EMAIL_LOGS table and surface through the diagnostic tab.
 */
export function mergeActivityWithEmailLogs(
  activities: EventActivity[],
  logs: EmailLog[],
): EventActivity[] {
  const referencedLogIds = new Set<string>();
  for (const a of activities) {
    const ref = (a.metadata as { emailLogId?: string } | undefined)?.emailLogId;
    if (ref) referencedLogIds.add(ref);
  }

  const synthesizedFromLogs: EventActivity[] = logs
    .filter((l) => l.status === 'sent' && !referencedLogIds.has(l.id))
    .map((l) => ({
      id: `emaillog:${l.id}`,
      activityId: 0,
      eventId: l.eventId,
      activityType: 'email_sent',
      description: `${l.templateName} sent to ${l.recipientEmail}`,
      actorEmail: 'system@minimusiker.de',
      actorType: 'system',
      metadata: {
        templateName: l.templateName,
        recipientEmail: l.recipientEmail,
        recipientType: l.recipientType,
        emailLogId: l.id,
        resendMessageId: l.resendMessageId,
        source: 'email_logs',
      },
      createdAt: l.sentAt,
    }));

  return [...activities, ...synthesizedFromLogs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
